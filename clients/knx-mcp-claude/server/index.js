/**
 * KNX-MCP
 * Runs the local stdio endpoint using host-managed settings and private profile files.
 * Standard output carries JSON-RPC only; diagnostics never include credentials.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';
const {
  Connector,
  ConnectorError,
  RpcError,
  transportCode,
  MESSAGE_LIMIT,
  VERSION,
} = require('./connector');
const { loadConfiguration, setupIssue } = require('./configuration');
const { TextDecoder } = require('node:util');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { launchInputs } = require('./diagnostics');
// Distinguish settings/discovery workers from the process that receives chat calls.
// The identifier is per-process and never serves as a credential or saved configuration.
const runtime = Object.freeze({
  instance_id: randomBytes(8).toString('hex'),
  process_id: process.pid,
  started_at: new Date().toISOString(),
  node_version: process.versions.node,
  embedded_runtime: typeof process.versions.electron === 'string',
  entry_point_argument_present:
    typeof process.argv[1] === 'string' && path.resolve(process.argv[1]) === __filename,
  configuration_input: launchInputs(process.argv.slice(2), process.env),
});
let connector;
function diagnostic(value) {
  // Values come only from fixed phase/status codes, counts and non-secret routing IDs.
  try {
    process.stderr.write(
      'KNX-MCP ' +
        JSON.stringify({
          time: new Date().toISOString(),
          instance_id: runtime.instance_id,
          process_id: runtime.process_id,
          ...value,
        }) +
        '\n',
    );
  } catch {}
}
let configuration;
try {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 16)) throw new ConnectorError('NODE_22_16_REQUIRED');
  configuration = loadConfiguration(process.argv.slice(2));
} catch (error) {
  configuration = { connections: [], errors: [setupIssue('configuration', error)] };
} finally {
  delete process.env.KNX_MCP_MANUAL_1_TOKEN;
  delete process.env.KNX_MCP_MANUAL_2_TOKEN;
}
// Keep the MCP control channel available even with no valid configured endpoints.
connector = new Connector(configuration.connections, {
  setupErrors: configuration.errors,
  notify: (message) => {
    diagnostic({ event: 'local_tools_changed', tools: connector.tools.size + 2 });
    write(message);
  },
  diagnostic,
});
diagnostic({
  event: 'local_ready',
  version: VERSION,
  connections: connector.endpoints.length,
  setup_errors: connector.setupErrors.length,
  runtime,
});
for (const issue of connector.setupErrors)
  diagnostic({ event: 'configuration_error', source: issue.source, code: issue.code });
let pending = Buffer.alloc(0),
  stopped = false,
  active = new Map();
const FIRST_CATALOG_WAIT_MS = 1000;
let firstCatalogWait = null,
  finishCatalogWait = null;

async function waitForFirstCatalog(signal) {
  // Some hosts retain only the first tools/list snapshot despite listChanged support.
  // Keep initialize and status immediate; bound this one shared catalog window instead.
  if (!connector.clientReady) return;
  if (signal.aborted) throw new ConnectorError('REQUEST_CANCELLED');
  if (!firstCatalogWait) {
    const attempts = connector.endpoints.map((endpoint) => endpoint.refreshing).filter(Boolean);
    firstCatalogWait = new Promise((resolve) => {
      if (!attempts.length) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        finishCatalogWait = null;
        resolve();
      };
      const timer = setTimeout(finish, FIRST_CATALOG_WAIT_MS);
      finishCatalogWait = finish;
      Promise.allSettled(attempts).then(finish);
    });
  }
  // Cancelling one list request must not cancel shared endpoint discovery or reset its budget.
  await new Promise((resolve, reject) => {
    const cancel = () => {
      signal.removeEventListener('abort', cancel);
      reject(new ConnectorError('REQUEST_CANCELLED'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    firstCatalogWait.then(() => {
      signal.removeEventListener('abort', cancel);
      if (stopped) reject(new ConnectorError('CONNECTOR_STOPPED'));
      else resolve();
    });
  });
}
function write(value) {
  if (stopped) return;
  if (process.stdout.writableLength > 2 * MESSAGE_LIMIT) {
    stop();
    return;
  }
  let line = JSON.stringify(value);
  if (Buffer.byteLength(line) > MESSAGE_LIMIT)
    line = JSON.stringify({
      jsonrpc: '2.0',
      id: value.id,
      error: {
        code: -32603,
        message: 'RESPONSE_TOO_LARGE: do not automatically repeat a modifying call.',
      },
    });
  process.stdout.write(line + '\n');
}
function stop() {
  if (stopped) return;
  stopped = true;
  finishCatalogWait?.();
  for (const controller of active.values()) controller.abort();
  connector.close();
  pending = Buffer.alloc(0);
  process.stdin.pause();
}
async function receive(line) {
  let request;
  try {
    request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(line));
  } catch {
    write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON.' } });
    return;
  }
  const id = request?.id;
  if (id === undefined) {
    if (request?.jsonrpc !== '2.0') return;
    if (request.method === 'notifications/initialized') connector.initializedNotification();
    if (request?.method === 'notifications/cancelled')
      active.get(JSON.stringify(request.params?.requestId))?.abort();
    // Notifications never invoke tools. There is no interactive prompt on stdio.
    return;
  }
  if (
    !request ||
    request.jsonrpc !== '2.0' ||
    typeof request.method !== 'string' ||
    (typeof id !== 'string' && !Number.isSafeInteger(id)) ||
    (typeof id === 'string' && id.length > 256)
  ) {
    write({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request.' } });
    return;
  }
  const key = JSON.stringify(id);
  if (active.has(key) || active.size >= 32) {
    write({
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: 'REQUEST_CAPACITY_OR_DUPLICATE_ID' },
    });
    return;
  }
  const abort = new AbortController();
  active.set(key, abort);
  try {
    const started = Date.now();
    const localHelper =
      request.method === 'tools/call' &&
      ['knx_connections', 'knx_refresh_connections'].includes(request.params?.name);
    if (request.method === 'initialize' || request.method === 'tools/list' || localHelper)
      diagnostic({
        event: 'local_request',
        method: request.method,
        ...(localHelper ? { tool: request.params.name } : {}),
        connections: connector.endpoints.length,
        setup_errors: connector.setupErrors.length,
      });
    if (request.method === 'tools/list') await waitForFirstCatalog(abort.signal);
    let result = await connector.handle(request, abort.signal);
    if (request.method === 'tools/list')
      diagnostic({
        event: 'local_catalog_returned',
        tools: result.tools.length,
        duration_ms: Date.now() - started,
      });
    if (localHelper) {
      // Only local control tools receive process metadata; upstream tool results stay unchanged.
      const data = { ...result.structuredContent, runtime };
      result = {
        ...result,
        structuredContent: data,
        content: [{ type: 'text', text: JSON.stringify(data) }],
      };
    }
    write({ jsonrpc: '2.0', id, result });
  } catch (e) {
    const code =
      e instanceof RpcError
        ? e.rpcCode
        : e.code === 'INITIALIZE_REQUIRED'
          ? -32002
          : ['ARGUMENTS_INVALID', 'UNKNOWN_TOOL', 'UNKNOWN_CONNECTION'].includes(e.code)
            ? -32602
            : -32603;
    write({
      jsonrpc: '2.0',
      id,
      error: { code, message: e instanceof RpcError ? e.message : transportCode(e) },
    });
  } finally {
    active.delete(key);
  }
}
process.stdin.on('data', (chunk) => {
  if (stopped) return;
  pending = Buffer.concat([pending, chunk]);
  let end;
  while ((end = pending.indexOf(10)) >= 0) {
    const line = pending.subarray(0, end);
    pending = pending.subarray(end + 1);
    if (line.length > MESSAGE_LIMIT) {
      process.stderr.write('KNX-MCP: REQUEST_TOO_LARGE\n');
      stop();
      return;
    }
    if (line.length) receive(line);
  }
  if (pending.length > MESSAGE_LIMIT) {
    process.stderr.write('KNX-MCP: REQUEST_TOO_LARGE\n');
    stop();
  }
});
process.stdin.on('end', stop);
process.stdin.on('error', stop);
process.stdout.on('error', stop);
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
