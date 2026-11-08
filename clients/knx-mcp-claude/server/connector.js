/**
 * KNX-MCP
 * Routes MCP requests to named ETS endpoints with isolated sessions and bounded messages.
 * Recovery never automatically replays modifying calls with uncertain outcomes.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';

const { TextDecoder } = require('node:util');
const { isReadOnly, toolMetadata } = require('./tool-metadata');
const {
  ConnectorError,
  requireValue,
  hash,
  canonical,
  readProfiles,
  rememberProfiles,
} = require('./connection-settings');
const { createTransport } = require('./transport');

const { VERSION, clientInfo } = require('./version');
const { errorHint, serverMetadata } = require('./diagnostics');
const SETUP_TIMEOUT_MS = 15000;
const PROTOCOL = '2025-06-18';
const MESSAGE_LIMIT = 16 * 1024 * 1024;
const READ_NOTICE =
  'SESSION_RECOVERED: This ETS connection was initialized again. Recheck the current project and objects before changes; previous results may be stale.';
const WRITE_NOTICE =
  'PROJECT_RECHECK_REQUIRED: This call was not executed. The ETS connection was initialized again. List its current projects and read the affected objects using the current project key, then consciously repeat the intended change with that project key. An earlier operation with a lost response may already have executed.';

function toolError(code, message) {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent: { error: { code, message } },
    isError: true,
  };
}
class RpcError extends Error {
  constructor(rpcCode, message) {
    super(message);
    this.rpcCode = rpcCode;
  }
}
function transportCode(error) {
  if (error instanceof ConnectorError) return error.code;
  const allowed = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EHOSTUNREACH',
    'CERT_HAS_EXPIRED',
    'CERT_NOT_YET_VALID',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'ERR_TLS_CERT_ALTNAME_INVALID',
  ]);
  return allowed.has(error?.code) ? error.code : 'TLS_OR_NETWORK_FAILURE';
}

class Endpoint {
  constructor(profile, options = {}) {
    this.profile = profile;
    this.state = 'not_started';
    this.phase = null;
    this.refreshing = null;
    this.setupController = null;
    this.setupTimeout = options.setupTimeoutMs || SETUP_TIMEOUT_MS;
    this.changed = options.changed || (() => {});
    this.diagnostic = options.diagnostic || (() => {});
    this.session = null;
    this.protocol = PROTOCOL;
    this.serial = 0;
    this.pending = new Set();
    this.closed = false;
    this.catalog = [];
    this.instructions = '';
    this.serverInfo = null;
    this.lastTransportError = null;
    this.lastCallError = null;
    this.chain = Promise.resolve();
    this.started = false;
    this.recovered = false;
    this.changeWarned = false;
    this.checkedProjects = new Map();
    this.admittedCalls = 0;
    this.recoveryBarrier = 0;
    this.knownProjectKeys = new Set();
    this.noticePending = false;
    const transport = createTransport(profile);
    this.transport = transport.client;
    this.agent = transport.agent;
  }
  report(event, extra = {}) {
    try {
      this.diagnostic({ event, target: this.profile.id.slice(0, 8), ...extra });
    } catch {}
  }
  // Serialize each endpoint independently; a slow/offline site cannot select another target.
  enqueue(action) {
    const pending = this.chain.then(() => {
      requireValue(!this.closed, 'CONNECTOR_STOPPED');
      return action();
    });
    this.chain = pending.catch(() => {});
    return pending;
  }
  async post(method, params, notification = false, signal) {
    requireValue(!this.closed, 'CONNECTOR_STOPPED');
    if (signal?.aborted)
      throw signal.reason instanceof ConnectorError
        ? signal.reason
        : new ConnectorError('REQUEST_CANCELLED');
    const started = Date.now();
    this.phase = method;
    this.report('request_started', { phase: method });
    const id = notification ? undefined : ++this.serial;
    const bytes = Buffer.from(
      JSON.stringify({
        jsonrpc: '2.0',
        ...(notification ? {} : { id }),
        method,
        ...(params === undefined ? {} : { params }),
      }),
    );
    requireValue(bytes.length <= MESSAGE_LIMIT, 'REQUEST_TOO_LARGE');
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'Content-Length': bytes.length,
      Authorization: 'Bearer ' + this.profile.key,
      'User-Agent': 'knx-mcp-claude/' + VERSION,
    };
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    if (method !== 'initialize') headers['MCP-Protocol-Version'] = this.protocol;
    return new Promise((resolve, reject) => {
      let settled = false;
      const req = this.transport.request(
        this.profile.url,
        { method: 'POST', headers, agent: this.agent },
        (res) => {
          // Refuse redirects before reading a body. Credentials never follow Location.
          if (res.statusCode >= 300 && res.statusCode < 400) {
            req.destroy(new ConnectorError('REDIRECT_REFUSED'));
            finishError(new ConnectorError('REDIRECT_REFUSED'));
            return;
          }
          let total = 0;
          const chunks = [];
          res.on('data', (chunk) => {
            total += chunk.length;
            if (total > MESSAGE_LIMIT) req.destroy(new ConnectorError('RESPONSE_TOO_LARGE'));
            else chunks.push(chunk);
          });
          res.on('error', finishError);
          res.on('close', () => {
            if (!res.complete) finishError(new ConnectorError('RESPONSE_INCOMPLETE'));
          });
          res.on('end', () => {
            if (settled) return;
            try {
              const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
              let body = null;
              if (text) body = JSON.parse(text);
              if (
                res.statusCode === 404 &&
                ['session_not_found', 'session_refused'].includes(body?.error)
              )
                throw new ConnectorError('SESSION_EXPIRED', 404);
              if (res.statusCode < 200 || res.statusCode >= 300)
                throw new ConnectorError('HTTP_' + res.statusCode, res.statusCode);
              if (notification) {
                requireValue(
                  res.statusCode === 202 || (body && body.result),
                  'NOTIFICATION_RESPONSE_INVALID',
                );
                finish(null);
                return;
              }
              requireValue(
                body && body.jsonrpc === '2.0' && body.id === id,
                'RPC_RESPONSE_INVALID',
              );
              if (body.error)
                throw new ConnectorError(
                  'RPC_' + (Number.isInteger(body.error.code) ? body.error.code : 'ERROR'),
                );
              requireValue(Object.hasOwn(body, 'result'), 'RPC_RESULT_MISSING');
              const session = res.headers['mcp-session-id'];
              if (method === 'initialize') {
                requireValue(
                  typeof session === 'string' && /^[\x21-\x7e]{1,128}$/.test(session),
                  'SESSION_HEADER_REQUIRED',
                );
                this.session = session;
              } else if (session && session !== this.session)
                throw new ConnectorError('SESSION_CHANGED_UNEXPECTEDLY');
              finish(body.result);
            } catch (e) {
              finishError(e instanceof ConnectorError ? e : new ConnectorError('RESPONSE_INVALID'));
            }
          });
        },
      );
      const timer = setTimeout(
        () => req.destroy(new ConnectorError('REQUEST_TIMEOUT')),
        method === 'tools/call' ? 180000 : 15000,
      );
      const abort = () =>
        req.destroy(
          signal?.reason instanceof ConnectorError
            ? signal.reason
            : new ConnectorError('REQUEST_CANCELLED'),
        );
      function cleanup() {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
      const endpoint = this;
      function finish(value) {
        if (settled) return;
        settled = true;
        cleanup();
        endpoint.pending.delete(req);
        endpoint.report('request_completed', { phase: method, duration_ms: Date.now() - started });
        resolve(value);
      }
      function finishError(error) {
        if (settled) return;
        settled = true;
        cleanup();
        endpoint.pending.delete(req);
        endpoint.report('request_failed', {
          phase: method,
          code: transportCode(error),
          duration_ms: Date.now() - started,
        });
        reject(error);
      }
      this.pending.add(req);
      req.on('error', finishError);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      else req.end(bytes);
    });
  }
  async initialize(parentSignal) {
    const controller = new AbortController();
    this.setupController = controller;
    const parentAbort = () => controller.abort(parentSignal.reason);
    parentSignal?.addEventListener('abort', parentAbort, { once: true });
    if (parentSignal?.aborted) parentAbort();
    this.state = 'connecting';
    this.lastTransportError = null;
    const timer = setTimeout(
      () => controller.abort(new ConnectorError('CONNECTION_SETUP_TIMEOUT')),
      this.setupTimeout,
    );
    this.report('connection_started');
    try {
      await this.initializeWithinDeadline(controller.signal);
      this.state = 'ready';
      this.phase = null;
      this.report('connection_ready', { tools: this.catalog.length });
    } catch (error) {
      this.session = null;
      this.catalog = [];
      this.lastTransportError = transportCode(error);
      this.state = 'offline';
      this.report('connection_failed', { code: this.lastTransportError, phase: this.phase });
      throw error;
    } finally {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', parentAbort);
      if (this.setupController === controller) this.setupController = null;
      this.changed();
    }
  }
  async initializeWithinDeadline(signal) {
    this.session = null;
    const result = await this.post(
      'initialize',
      {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: 'knx-mcp-claude', title: 'KNX-MCP', version: VERSION },
      },
      false,
      signal,
    );
    requireValue(
      ['2024-11-05', '2025-03-26', PROTOCOL].includes(result.protocolVersion),
      'PROTOCOL_UNSUPPORTED',
    );
    this.protocol = result.protocolVersion;
    this.instructions =
      typeof result.instructions === 'string' ? result.instructions.slice(0, 32768) : '';
    this.serverInfo = serverMetadata(result.serverInfo);
    await this.post('notifications/initialized', undefined, true, signal);
    await this.loadCatalog(signal);
    if (signal.aborted) throw signal.reason;
    this.lastTransportError = null;
    if (this.started) {
      this.recovered = true;
      this.changeWarned = false;
      this.checkedProjects.clear();
      this.recoveryBarrier = this.admittedCalls;
      this.knownProjectKeys.clear();
      this.noticePending = true;
    }
    this.started = true;
  }
  async loadCatalog(signal) {
    const collected = [];
    const cursors = new Set();
    let cursor;
    for (let page = 0; page < 16; page++) {
      const result = await this.post('tools/list', cursor ? { cursor } : {}, false, signal);
      requireValue(Array.isArray(result.tools), 'TOOL_CATALOG_INVALID');
      for (const tool of result.tools) {
        requireValue(
          typeof tool.name === 'string' &&
            /^[\w.\-]{1,128}$/.test(tool.name) &&
            tool.inputSchema?.type === 'object',
          'TOOL_DEFINITION_INVALID',
        );
        requireValue(!collected.some((t) => t.name === tool.name), 'DUPLICATE_UPSTREAM_TOOL');
        collected.push(tool);
        requireValue(collected.length <= 2048, 'TOO_MANY_TOOLS');
      }
      cursor = result.nextCursor;
      if (!cursor) {
        if (signal?.aborted) throw signal.reason;
        this.catalog = collected;
        return;
      }
      requireValue(
        typeof cursor === 'string' && cursor.length <= 2048 && !cursors.has(cursor),
        'TOOL_CURSOR_INVALID',
      );
      cursors.add(cursor);
    }
    throw new ConnectorError('TOO_MANY_TOOL_PAGES');
  }
  refresh() {
    if (this.refreshing) return this.refreshing;
    const work = this.enqueue(async () => {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new ConnectorError('CONNECTION_SETUP_TIMEOUT')),
        this.setupTimeout,
      );
      this.setupController = controller;
      try {
        if (!this.session) await this.initialize(controller.signal);
        else {
          try {
            await this.loadCatalog(controller.signal);
          } catch (e) {
            if (e.code !== 'SESSION_EXPIRED') throw e;
            // Reinitialization shares this refresh deadline and never retries a write.
            await this.initialize(controller.signal);
          }
        }
        this.lastTransportError = null;
        this.state = 'ready';
        this.phase = null;
      } catch (e) {
        this.lastTransportError = transportCode(e);
        this.state = 'offline';
        this.session = null;
        this.catalog = [];
      } finally {
        clearTimeout(timer);
        if (this.setupController === controller) this.setupController = null;
      }
    });
    this.refreshing = work
      .catch(() => {})
      .finally(() => {
        this.refreshing = null;
        this.changed();
      });
    return this.refreshing;
  }
  async call(name, args, advertisedSchema, signal) {
    // Record admission before queuing so old queued calls cannot clear the recovery barrier.
    const sequence = ++this.admittedCalls;
    return this.enqueue(async () => {
      try {
        if (!this.session) await this.initialize(signal);
        let tool = this.catalog.find((t) => t.name === name);
        requireValue(
          tool && canonical(tool.inputSchema) === advertisedSchema,
          'TOOL_CATALOG_CHANGED',
        );
        const readOnly = isReadOnly(tool);
        if (this.recovered && !readOnly) {
          if (!this.changeWarned) {
            this.changeWarned = true;
            this.recoveryBarrier = this.admittedCalls;
            return toolError('PROJECT_RECHECK_REQUIRED', WRITE_NOTICE);
          }
          if (
            typeof args.project !== 'string' ||
            !this.checkedProjects.has(args.project) ||
            sequence <= this.checkedProjects.get(args.project)
          )
            return toolError('PROJECT_RECHECK_REQUIRED', WRITE_NOTICE);
        }
        let result;
        try {
          result = await this.post('tools/call', { name, arguments: args }, false, signal);
        } catch (e) {
          if (e.code !== 'SESSION_EXPIRED') throw e;
          await this.initialize(signal);
          tool = this.catalog.find((t) => t.name === name);
          requireValue(
            tool && canonical(tool.inputSchema) === advertisedSchema,
            'TOOL_CATALOG_CHANGED',
          );
          if (!readOnly || !isReadOnly(tool)) {
            this.changeWarned = true;
            this.recoveryBarrier = this.admittedCalls;
            return toolError('PROJECT_RECHECK_REQUIRED', WRITE_NOTICE);
          }
          result = await this.post('tools/call', { name, arguments: args }, false, signal); // One explicit pre-dispatch 404 only, never an uncertain network failure.
        }
        requireValue(result && Array.isArray(result.content), 'TOOL_RESULT_INVALID');
        if (!result.isError && readOnly && this.recovered) {
          if (name === 'ets_list_projects') {
            let payload = result.structuredContent;
            if (!payload) {
              try {
                payload = JSON.parse(result.content.find((c) => c.type === 'text')?.text || 'null');
              } catch {}
            }
            if (Array.isArray(payload?.data?.projects) && payload.data.projects.length <= 256)
              this.knownProjectKeys = new Set(
                payload.data.projects
                  .map((p) => p.key)
                  .filter((k) => typeof k === 'string' && k.length <= 256),
              );
          }
          if (
            this.changeWarned &&
            sequence > this.recoveryBarrier &&
            this.knownProjectKeys.has(args.project) &&
            this.checkedProjects.size < 256
          )
            this.checkedProjects.set(args.project, sequence);
          if (this.noticePending) {
            this.noticePending = false;
            result = {
              ...result,
              content: [...result.content, { type: 'text', text: READ_NOTICE }],
            };
          }
        }
        // An application error is an answered call, not evidence of a broken connection.
        this.lastTransportError = null;
        this.lastCallError = result.isError ? 'TOOL_ERROR' : null;
        this.state = 'ready';
        this.phase = null;
        return result;
      } catch (e) {
        const code = transportCode(e);
        this.lastCallError = code;
        const operationError =
          /^RPC_-?\d+$/.test(code) ||
          ['TOOL_CATALOG_CHANGED', 'REQUEST_TOO_LARGE', 'REQUEST_CANCELLED'].includes(code);
        if (!operationError) {
          // Delivery is uncertain after a failed transport. Never replay a write here.
          // A later explicit call establishes a new context and retains the recovery barrier.
          this.lastTransportError = code;
          this.state = 'offline';
          this.session = null;
        }
        this.phase = null;
        return toolError(
          code,
          this.profile.name +
            ': ' +
            code +
            '. ' +
            errorHint(code) +
            (operationError
              ? ''
              : ' A modifying operation may already have executed; read the current state before repeating it.'),
        );
      }
    });
  }
  close() {
    this.closed = true;
    this.setupController?.abort(new ConnectorError('CONNECTOR_STOPPED'));
    for (const req of this.pending) req.destroy(new ConnectorError('CONNECTOR_STOPPED'));
    this.agent.destroy();
  }
}

// Preserve the distinguishing end of a long connection name, such as its ETS version.
function shortenName(value, limit) {
  if (value.length <= limit) return value;
  const head = Math.ceil((limit - 1) / 2);
  return value.slice(0, head) + '-' + value.slice(-(limit - head - 1));
}
function connectionNamespaces(endpoints) {
  const entries = endpoints.map((endpoint) => ({
    endpoint,
    label:
      endpoint.profile.name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'ETS',
  }));
  const counts = new Map();
  for (const { label } of entries) {
    const key = label.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const used = new Set();
  return new Map(
    entries.map(({ endpoint, label }) => {
      // Reserve namespaces for all configured endpoints, including those still offline.
      // Catalog completion order must never change an existing route's target.
      const name =
        label.length <= 32 && counts.get(label.toLowerCase()) === 1
          ? label
          : shortenName(label, 23) + '_' + endpoint.profile.id.slice(0, 8);
      requireValue(!used.has(name.toLowerCase()), 'TOOL_ROUTE_COLLISION');
      used.add(name.toLowerCase());
      return [endpoint, name];
    }),
  );
}
function routedToolName(namespace, upstreamName) {
  const budget = 64 - namespace.length - 2;
  const readable = upstreamName.replace(/[^A-Za-z0-9_-]/g, '_');
  const suffix =
    readable === upstreamName && readable.length <= budget
      ? readable
      : readable.slice(0, budget - 9) + '_' + hash(upstreamName).slice(0, 8);
  return namespace + '__' + suffix;
}

class Connector {
  constructor(profiles, options = {}) {
    this.closed = false;
    this.clientReady = false;
    this.notificationScheduled = false;
    this.catalogSignature = '';
    this.notify = options.notify || (() => {});
    this.setupErrors = [...(options.setupErrors || [])];
    this.endpoints = [];
    for (const profile of profiles) {
      try {
        this.endpoints.push(
          new Endpoint(profile, { ...options, changed: () => this.endpointChanged() }),
        );
      } catch (error) {
        this.setupErrors.push({
          source: profile.source || 'connection',
          code: transportCode(error),
          message: 'Connection transport could not be created. Other targets remain available.',
        });
      }
    }
    this.tools = new Map();
    this.initialized = false;
    this.initializing = false;
  }
  async refresh() {
    await Promise.all(this.endpoints.map((endpoint) => endpoint.refresh()));
    this.rebuildTools();
  }
  endpointChanged() {
    if (this.closed) return;
    this.rebuildTools();
  }
  // Control tools schedule independent attempts, rather than waiting for every location.
  beginRefresh(id) {
    const targets =
      id === undefined ? this.endpoints : this.endpoints.filter((e) => e.profile.id === id);
    requireValue(id === undefined || targets.length === 1, 'UNKNOWN_CONNECTION');
    for (const endpoint of targets)
      endpoint
        .refresh()
        .catch((error) => endpoint.report('refresh_failed', { code: transportCode(error) }));
  }
  initializedNotification() {
    if (!this.initialized || this.clientReady || this.closed) return;
    this.clientReady = true;
    this.beginRefresh();
  }
  // Names are presentation; the endpoint ID is the actual route discriminator.
  rebuildTools() {
    const tools = new Map();
    const namespaces = connectionNamespaces(this.endpoints);
    for (const endpoint of this.endpoints) {
      for (const upstream of endpoint.catalog) {
        const name = routedToolName(namespaces.get(endpoint), upstream.name);
        requireValue(!tools.has(name), 'TOOL_ROUTE_COLLISION');
        const visible = toolMetadata(
          {
            ...upstream,
            name,
            title:
              upstream.title ||
              upstream.annotations?.title ||
              upstream.name.replace(/[_.-]+/g, ' '),
            description: '[' + endpoint.profile.name + '] ' + (upstream.description || ''),
          },
          endpoint.profile.name,
        );
        tools.set(name, {
          endpoint,
          upstream,
          visible,
          schema: canonical(upstream.inputSchema),
        });
      }
    }
    this.tools = tools;
    const signature = canonical([...tools.values()].map((route) => route.visible));
    if (signature !== this.catalogSignature) {
      this.catalogSignature = signature;
      // Publish each ready site's catalogue independently, after the host's initialized notification.
      if (this.clientReady && !this.notificationScheduled && !this.closed) {
        this.notificationScheduled = true;
        setImmediate(() => {
          this.notificationScheduled = false;
          if (!this.closed) {
            try {
              this.notify({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
            } catch {}
          }
        });
      }
    }
  }
  status() {
    return this.endpoints.map((e) => ({
      id: e.profile.id,
      name: e.profile.name,
      connected: e.state === 'ready' && !!e.session && !e.lastTransportError,
      state: e.state,
      phase: e.phase,
      source: e.profile.source || null,
      refreshing: !!e.refreshing,
      instructions: e.instructions,
      // Retain error as a transport-only compatibility alias.
      error: e.lastTransportError,
      transport_error: e.lastTransportError,
      transport_hint: e.lastTransportError ? errorHint(e.lastTransportError) : null,
      last_call_error: e.lastCallError,
      call_hint: e.lastCallError ? errorHint(e.lastCallError) : null,
      server: e.serverInfo,
      tools: e.catalog.length,
      protocol: e.protocol,
      recovered: e.recovered,
      transport: e.profile.url.protocol.slice(0, -1),
      trust: e.profile.trust,
    }));
  }
  async handle(request, signal) {
    if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string')
      throw new ConnectorError('INVALID_REQUEST');
    const params = request.params || {};
    if (
      !['initialize', 'notifications/initialized', 'ping', 'tools/list', 'tools/call'].includes(
        request.method,
      )
    )
      throw new RpcError(-32601, 'Method not found.');
    if (request.method === 'ping') return {};
    if (request.method === 'initialize') {
      requireValue(!this.initialized && !this.initializing, 'ALREADY_INITIALIZED');
      // A local handshake is independent of upstream availability and configuration errors.
      this.initialized = true;
      return {
        protocolVersion: ['2024-11-05', '2025-03-26', PROTOCOL].includes(params.protocolVersion)
          ? params.protocolVersion
          : PROTOCOL,
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: 'knx-mcp-claude', title: 'KNX-MCP', version: VERSION },
        instructions:
          'Each tool prefix names exactly one configured ETS endpoint. Never substitute another endpoint when one is unavailable. Select the current project explicitly before changes. After recovery, read current projects and objects and obey PROJECT_RECHECK_REQUIRED; do not replay uncertain writes. knx_connections reports connection states, configuration errors and per-target server instructions. Read the current target instructions before using its tools. Invalid profiles must be exported again as knx-mcp-claude/v1. knx_refresh_connections schedules retries without waiting for other sites. Tools are announced as each site becomes ready; offline sites never block local status.\n' +
          this.endpoints.map((e) => '[' + e.profile.name + ']\n' + e.instructions).join('\n'),
      };
    }
    requireValue(this.initialized, 'INITIALIZE_REQUIRED');
    if (request.method === 'notifications/initialized') {
      this.initializedNotification();
      return null;
    }
    if (request.method === 'ping') return {};
    if (request.method === 'tools/list')
      return {
        tools: [
          toolMetadata({
            name: 'knx_connections',
            title: 'KNX-MCP connections',
            description:
              'Lists configured ETS states, configuration errors, tool counts and server usage instructions without credentials.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, openWorldHint: false },
          }),
          toolMetadata({
            name: 'knx_refresh_connections',
            title: 'Refresh KNX-MCP connections',
            description:
              'Schedules connection and catalog refresh without waiting for other sites. Optionally select a connection ID from knx_connections. Does not modify ETS projects. Tools appear through list_changed when each target is ready.',
            inputSchema: {
              type: 'object',
              properties: { connection: { type: 'string', maxLength: 32 } },
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, openWorldHint: true },
          }),
          ...Array.from(this.tools.values(), (route) => route.visible),
        ],
      };
    if (request.method === 'tools/call') {
      if (params.name === 'knx_connections' || params.name === 'knx_refresh_connections') {
        if (params.name === 'knx_refresh_connections') {
          const args = params.arguments || {};
          requireValue(
            typeof args === 'object' &&
              !Array.isArray(args) &&
              Object.keys(args).every((key) => key === 'connection') &&
              (args.connection === undefined || typeof args.connection === 'string'),
            'ARGUMENTS_INVALID',
          );
          this.beginRefresh(args.connection);
        }
        const data = {
          client: clientInfo(),
          connections: this.status(),
          setup_errors: this.setupErrors,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(data) }],
          structuredContent: data,
          isError: false,
        };
      }
      const route = this.tools.get(params.name);
      requireValue(route, 'UNKNOWN_TOOL');
      requireValue(
        params.arguments === undefined ||
          (params.arguments &&
            typeof params.arguments === 'object' &&
            !Array.isArray(params.arguments)),
        'ARGUMENTS_INVALID',
      );
      return route.endpoint.call(route.upstream.name, params.arguments || {}, route.schema, signal);
    }
    throw new RpcError(-32601, 'Method not found.');
  }
  close() {
    this.closed = true;
    for (const endpoint of this.endpoints) endpoint.close();
  }
}
module.exports = {
  Connector,
  Endpoint,
  RpcError,
  SETUP_TIMEOUT_MS,
  ConnectorError,
  readProfiles,
  toolError,
  transportCode,
  rememberProfiles,
  MESSAGE_LIMIT,
  VERSION,
  PROTOCOL,
};
