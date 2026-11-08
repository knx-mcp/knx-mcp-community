/**
 * KNX-MCP
 * Tests local lifecycle, independent site startup and safe configuration diagnostics.
 * All endpoints and credentials are generated fixtures on loopback only.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { Connector, PROTOCOL, RpcError } = require('../server/connector');
const { loadConfiguration } = require('../server/configuration');
const { readManualConnections } = require('../server/connection-settings');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-startup-'));
after(() => fs.rmSync(directory, { recursive: true, force: true }));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, ms = 2500) {
  const end = Date.now() + ms;
  while (!predicate() && Date.now() < end) await sleep(10);
  assert(predicate(), 'Expected condition before deadline');
}
function request(method, params = {}) {
  return { jsonrpc: '2.0', id: 1, method, params };
}
async function site(t, name, mode = 'ready', delay = 0, tls = null) {
  const state = { mode, received: [], sessions: new Set(), serial: 0 };
  const handler = (req, res) => {
    let text = '';
    req.on('data', (chunk) => (text += chunk));
    req.on('end', () => {
      const body = JSON.parse(text);
      state.received.push(body.method);
      if (state.mode === 'silent') return;
      const reply = () => {
        if (res.destroyed) return;
        if (state.mode === 'truncated') {
          res.writeHead(200, { 'content-length': 1000 });
          res.write('{');
          setTimeout(() => res.destroy(), 10);
          return;
        }
        if (body.method === 'initialize') {
          const session = name + '-' + ++state.serial;
          state.sessions.add(session);
          res.setHeader('mcp-session-id', session);
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: PROTOCOL,
                serverInfo: { name, version: 'fixture' },
                instructions: 'Instructions for ' + name,
                capabilities: { tools: {} },
              },
            }),
          );
        } else if (body.method === 'notifications/initialized') {
          res.writeHead(202);
          res.end();
        } else if (body.method === 'tools/list') {
          const result =
            state.mode === 'paged'
              ? { tools: [], nextCursor: 'page-' + state.received.length }
              : {
                  tools: [
                    {
                      name: 'test_read',
                      inputSchema: { type: 'object' },
                      annotations: { readOnlyHint: true },
                    },
                  ],
                };
          res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
        } else {
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { content: [{ type: 'text', text: name }], isError: false },
            }),
          );
        }
      };
      if (delay) setTimeout(reply, delay);
      else reply();
    });
  };
  const server = tls ? https.createServer(tls, handler) : http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const url = `${tls ? 'https' : 'http'}://127.0.0.1:${server.address().port}/mcp`;
  const profile = readManualConnections({
    KNX_MCP_MANUAL_1_NAME: name,
    KNX_MCP_MANUAL_1_URL: url,
    KNX_MCP_MANUAL_1_TOKEN: 'fixture-key',
    KNX_MCP_ALLOW_HTTP: 'true',
  })[0];
  return { profile, state };
}
function create(t, profiles, options = {}) {
  const c = new Connector(profiles, options);
  t.after(() => c.close());
  return c;
}
function child(t, files = [], environment = {}) {
  const env = {
    ...process.env,
    KNX_MCP_MANUAL_1_NAME: '',
    KNX_MCP_MANUAL_1_URL: '',
    KNX_MCP_MANUAL_1_TOKEN: '',
    KNX_MCP_MANUAL_2_NAME: '',
    KNX_MCP_MANUAL_2_URL: '',
    KNX_MCP_MANUAL_2_TOKEN: '',
    KNX_MCP_ALLOW_HTTP: 'false',
    ...environment,
  };
  const processChild = spawn(
    process.execPath,
    [path.resolve(__dirname, '../server/index.js'), ...files],
    { env, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  t.after(() => processChild.kill());
  const state = { lines: [], errors: '', stdout: '' };
  let pending = '';
  processChild.stdout.on('data', (data) => {
    state.stdout += data;
    pending += data;
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      state.lines.push(JSON.parse(pending.slice(0, end)));
      pending = pending.slice(end + 1);
    }
  });
  processChild.stderr.on('data', (data) => (state.errors += data));
  const send = (value) => processChild.stdin.write(JSON.stringify(value) + '\n');
  const receive = async (id) => {
    await until(() => state.lines.some((line) => line.id === id));
    return state.lines.find((line) => line.id === id);
  };
  return { processChild, state, send, receive };
}
function jsonFile(data) {
  const file = path.join(directory, crypto.randomUUID() + '.json');
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}

test('Local initialize and ping never wait for four silent sites or contact them before initialized', async (t) => {
  const sites = await Promise.all([1, 2, 3, 4].map((n) => site(t, 'offline-' + n, 'silent')));
  const c = create(
    t,
    sites.map((s) => s.profile),
    { setupTimeoutMs: 150 },
  );
  const started = Date.now();
  const result = await c.handle(request('initialize', { protocolVersion: PROTOCOL }));
  assert(Date.now() - started < 250);
  assert.equal(result.capabilities.tools.listChanged, true);
  assert.deepEqual(await c.handle(request('ping')), {});
  assert.equal((await c.handle(request('tools/list'))).tools.length, 2);
  assert(sites.every((s) => !s.state.received.length));
  c.initializedNotification();
  await until(() => c.status().every((s) => s.state === 'offline'));
  assert(c.status().every((s) => s.error === 'CONNECTION_SETUP_TIMEOUT'));
  assert.equal((await c.handle(request('tools/list'))).tools.length, 2);
});

test('Two healthy sites stay usable while two silent sites are still connecting', async (t) => {
  const sites = await Promise.all([
    site(t, 'ETS5'),
    site(t, 'ETS6'),
    site(t, 'absent-a', 'silent'),
    site(t, 'absent-b', 'silent'),
  ]);
  const notices = [],
    diagnostics = [];
  const c = create(
    t,
    sites.map((s) => s.profile),
    {
      setupTimeoutMs: 1500,
      notify: (n) => notices.push(n),
      diagnostic: (d) => diagnostics.push(d),
    },
  );
  await c.handle(request('initialize', { protocolVersion: PROTOCOL }));
  c.initializedNotification();
  await until(() => c.status().filter((s) => s.connected).length === 2);
  assert(c.status().filter((s) => s.state === 'connecting').length === 2);
  assert.equal(c.tools.size, 2);
  for (const route of c.tools.values()) {
    const result = await c.handle(
      request('tools/call', { name: route.visible.name, arguments: {} }),
    );
    assert.equal(result.content[0].text, route.endpoint.profile.name);
  }
  await until(() => notices.length > 0);
  assert(notices.every((n) => n.method === 'notifications/tools/list_changed'));
  assert(!JSON.stringify(diagnostics).includes('fixture-key'));
  assert(diagnostics.some((d) => d.event === 'connection_ready'));
  assert(diagnostics.some((d) => d.phase === 'tools/list'));
});

test('Status and refresh helpers answer immediately and repeated refreshes coalesce', async (t) => {
  const s = await site(t, 'offline', 'silent');
  const c = create(t, [s.profile], { setupTimeoutMs: 200 });
  await c.handle(request('initialize'));
  c.initializedNotification();
  const started = Date.now();
  for (let n = 0; n < 5; n++)
    await c.handle(request('tools/call', { name: 'knx_refresh_connections', arguments: {} }));
  const status = await c.handle(request('tools/call', { name: 'knx_connections' }));
  assert(Date.now() - started < 250);
  assert.equal(status.isError, false);
  await until(() => s.state.received.length > 0);
  assert.equal(s.state.received.filter((m) => m === 'initialize').length, 1);
});

test('A later-ready site is published without restarting Claude or touching another target', async (t) => {
  const a = await site(t, 'online'),
    b = await site(t, 'later', 'silent');
  const notices = [];
  const c = create(t, [a.profile, b.profile], {
    setupTimeoutMs: 100,
    notify: (n) => notices.push(n),
  });
  await c.handle(request('initialize'));
  c.initializedNotification();
  await until(() => c.status()[1].state === 'offline');
  const callsBefore = a.state.received.length;
  b.state.mode = 'ready';
  const reply = await c.handle(
    request('tools/call', {
      name: 'knx_refresh_connections',
      arguments: { connection: b.profile.id },
    }),
  );
  assert.equal(reply.isError, false);
  await until(() => c.status()[1].connected);
  assert.equal(c.tools.size, 2);
  assert.equal(a.state.received.length, callsBefore);
  assert(c.status()[1].instructions.includes('later'));
});

test('Total setup deadline bounds paginated catalog discovery, not just individual HTTP messages', async (t) => {
  const a = await site(t, 'pages', 'paged', 30);
  const c = create(t, [a.profile], { setupTimeoutMs: 170 });
  await c.handle(request('initialize'));
  c.initializedNotification();
  await until(() => c.status()[0].state === 'offline');
  assert.equal(c.status()[0].error, 'CONNECTION_SETUP_TIMEOUT');
  assert(a.state.received.filter((m) => m === 'tools/list').length < 16);
  assert.equal(c.tools.size, 0);
});

test('Premature response close completes the promise without waiting for setup timeout', async (t) => {
  const a = await site(t, 'truncated', 'truncated');
  const c = create(t, [a.profile], { setupTimeoutMs: 2000 });
  await c.handle(request('initialize'));
  c.initializedNotification();
  await until(() => c.status()[0].state === 'offline', 1000);
  assert.notEqual(c.status()[0].error, 'CONNECTION_SETUP_TIMEOUT');
});

test('Closing during setup aborts sockets and prevents late tools/list_changed output', async (t) => {
  const a = await site(t, 'closing', 'silent');
  const notices = [];
  const c = create(t, [a.profile], { notify: (n) => notices.push(n) });
  await c.handle(request('initialize'));
  c.initializedNotification();
  await until(() => a.state.received.length === 1);
  const pending = c.endpoints[0].refreshing;
  c.close();
  await pending;
  assert.equal(c.endpoints[0].pending.size, 0);
  await sleep(20);
  assert.equal(notices.length, 0);
});

test('Unsupported discovery returns method-not-found without initializing an ETS connection', async (t) => {
  const a = await site(t, 'probe');
  const c = create(t, [a.profile]);
  await assert.rejects(
    c.handle(request('server/discover')),
    (e) => e instanceof RpcError && e.rpcCode === -32601,
  );
  assert.equal(a.state.received.length, 0);
  assert.equal(c.initialized, false);
});

test('Configuration loader keeps a healthy manual connection beside an old and unreadable profile', async (t) => {
  const a = await site(t, 'valid');
  const old = jsonFile({ format: 'knx-mcp-connection/v2', access_key: 'DO_NOT_LOG_OLD_KEY' });
  const config = loadConfiguration([old, path.join(directory, 'missing.json')], {
    KNX_MCP_MANUAL_1_NAME: 'Current ETS',
    KNX_MCP_MANUAL_1_URL: a.profile.url.href,
    KNX_MCP_MANUAL_1_TOKEN: 'private-manual-key',
    KNX_MCP_ALLOW_HTTP: 'true',
  });
  assert.equal(config.connections.length, 1);
  assert.equal(config.connections[0].name, 'Current ETS');
  assert.deepEqual(
    config.errors.map((e) => [e.source, e.code]),
    [
      ['profile:1', 'PROFILE_REEXPORT_FROM_ETS'],
      ['profile:2', 'PROFILE_FILE_UNREADABLE'],
    ],
  );
  assert(!JSON.stringify(config.errors).includes('DO_NOT_LOG_OLD_KEY'));
  assert(!JSON.stringify(config.errors).includes(directory));
});

test('Ambiguous duplicate targets disable both inputs, not an unrelated valid connection', () => {
  const env = {
    KNX_MCP_ALLOW_HTTP: 'true',
    KNX_MCP_MANUAL_1_NAME: 'A',
    KNX_MCP_MANUAL_1_URL: 'http://127.0.0.1:1/mcp',
    KNX_MCP_MANUAL_1_TOKEN: 'a',
    KNX_MCP_MANUAL_2_NAME: 'B',
    KNX_MCP_MANUAL_2_URL: 'http://127.0.0.1:1/mcp',
    KNX_MCP_MANUAL_2_TOKEN: 'b',
  };
  const config = loadConfiguration([], env);
  assert.equal(config.connections.length, 0);
  assert.equal(config.errors.length, 2);
  assert(config.errors.every((e) => e.code === 'DUPLICATE_ENDPOINT'));
});

test('No configuration remains a usable local MCP server with actionable status', async (t) => {
  const p = child(t);
  p.send(request('initialize'));
  const init = await p.receive(1);
  assert.equal(init.result.serverInfo.version, require('../manifest.json').version);
  p.send({ ...request('tools/call', { name: 'knx_connections' }), id: 2 });
  const status = await p.receive(2);
  assert.equal(status.result.structuredContent.setup_errors[0].code, 'NO_CONNECTIONS_CONFIGURED');
  assert.deepEqual(status.result.structuredContent.connections, []);
});

test('Old profile returns clear setup status over stdio instead of leaving the host handshake unanswered', async (t) => {
  const secret = 'DO_NOT_PRINT_THIS_KEY';
  const old = jsonFile({ format: 'knx-mcp-connection/v2', access_key: secret });
  const p = child(t, [old]);
  p.send(request('initialize'));
  await p.receive(1);
  p.send({ ...request('tools/call', { name: 'knx_connections' }), id: 2 });
  const reply = await p.receive(2);
  assert.equal(reply.result.structuredContent.setup_errors[0].code, 'PROFILE_REEXPORT_FROM_ETS');
  assert(reply.result.structuredContent.setup_errors[0].message.includes('knx-mcp-claude/v1'));
  assert(!p.state.stdout.includes(secret));
  assert(!p.state.errors.includes(secret));
  assert(!p.state.errors.includes(directory));
});

test('Real stdio discovery receives -32601 before initialize even when configuration is absent', async (t) => {
  const p = child(t);
  p.send({ ...request('server/discover'), id: 42 });
  const reply = await p.receive(42);
  assert.deepEqual(reply.error, { code: -32601, message: 'Method not found.' });
  p.send(request('initialize'));
  assert((await p.receive(1)).result.serverInfo);
});

test('Real stdio publishes tools only after initialized and keeps status responsive during setup', async (t) => {
  const a = await site(t, 'visible', 'ready', 25);
  const p = child(t, [], {
    KNX_MCP_MANUAL_1_NAME: 'Visible ETS',
    KNX_MCP_MANUAL_1_URL: a.profile.url.href,
    KNX_MCP_MANUAL_1_TOKEN: 'stdio-secret',
    KNX_MCP_ALLOW_HTTP: 'true',
  });
  p.send(request('initialize'));
  await p.receive(1);
  assert.equal(a.state.received.length, 0);
  p.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  p.send({ ...request('tools/list'), id: 2 });
  assert.equal((await p.receive(2)).result.tools.length, 3);
  await until(() =>
    p.state.lines.some((line) => line.method === 'notifications/tools/list_changed'),
  );
  p.send({ ...request('tools/list'), id: 3 });
  const listed = await p.receive(3);
  assert.equal(listed.result.tools.length, 3);
  assert(listed.result.tools[2].title.includes('Visible ETS'));
  assert(!p.state.stdout.includes('stdio-secret'));
  assert(!p.state.errors.includes('stdio-secret'));
});

function manualEnvironment(a, b) {
  const env = { KNX_MCP_ALLOW_HTTP: 'true' };
  [a, b].filter(Boolean).forEach((s, index) => {
    const prefix = 'KNX_MCP_MANUAL_' + (index + 1) + '_';
    env[prefix + 'NAME'] = s.profile.name;
    env[prefix + 'URL'] = s.profile.url.href;
    env[prefix + 'TOKEN'] = 'catalog-fixture-key';
  });
  return env;
}
async function startChild(p) {
  p.send(request('initialize'));
  await p.receive(1);
  p.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
}
let catalogTls;
function catalogTlsFixture() {
  if (catalogTls) return catalogTls;
  const openssl =
    process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Git\\usr\\bin\\openssl.exe')
      ? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
      : 'openssl';
  const keyFile = path.join(directory, 'catalog-key.pem');
  const certFile = path.join(directory, 'catalog-cert.pem');
  execFileSync(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
      '-addext',
      'basicConstraints=critical,CA:FALSE',
      '-addext',
      'extendedKeyUsage=serverAuth',
      '-days',
      '2',
      '-keyout',
      keyFile,
      '-out',
      certFile,
    ],
    { stdio: 'ignore' },
  );
  catalogTls = { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile, 'utf8') };
  return catalogTls;
}
function selectedProfile(s, tls) {
  return jsonFile({
    format: 'knx-mcp-claude/v1',
    id: crypto.randomBytes(16).toString('hex'),
    name: s.profile.name,
    endpoint: s.profile.url.href,
    access_key: 'catalog-fixture-key',
    tls: {
      certificate_pem: tls.cert,
      sha256: new crypto.X509Certificate(tls.cert).fingerprint256.replace(/:/g, ''),
    },
  });
}

test('First stdio list includes both ready sites even when the host ignores notifications', async (t) => {
  const a = await site(t, 'ETS5-first', 'ready', 15);
  const b = await site(t, 'ETS6-first', 'ready', 30);
  const p = child(t, [], manualEnvironment(a, b));
  await startChild(p);
  const started = Date.now();
  p.send({ ...request('tools/list'), id: 2 });
  const listed = (await p.receive(2)).result.tools;
  assert.equal(listed.length, 4);
  assert(Date.now() - started < 900, 'Do not sleep a fixed second when all targets are ready');
  // Do not follow list_changed. A first-snapshot-only host can still call each route.
  for (let index = 2; index < listed.length; index++) {
    p.send({ ...request('tools/call', { name: listed[index].name }), id: index + 10 });
    const called = await p.receive(index + 10);
    assert.equal(called.result.isError, false);
    assert(['ETS5-first', 'ETS6-first'].includes(called.result.content[0].text));
  }
  await until(() => p.state.errors.includes('local_catalog_returned'));
  assert(p.state.errors.includes('"tools":4'));
  assert(p.state.errors.includes('local_tools_changed'));
  assert(!p.state.errors.includes('catalog-fixture-key'));
  assert(!p.state.errors.includes(a.profile.url.href));
});

test('Four selected profiles share one catalog window and healthy routes remain callable', async (t) => {
  const tls = catalogTlsFixture();
  const sites = await Promise.all([
    site(t, 'online-1', 'ready', 15, tls),
    site(t, 'online-2', 'ready', 25, tls),
    site(t, 'silent-1', 'silent', 0, tls),
    site(t, 'silent-2', 'silent', 0, tls),
  ]);
  const p = child(
    t,
    sites.map((s) => selectedProfile(s, tls)),
  );
  await startChild(p);
  const started = Date.now();
  p.send({ ...request('tools/list'), id: 2 });
  p.send({ ...request('tools/list'), id: 3 });
  p.send({ ...request('ping'), id: 4 });
  p.send({ ...request('tools/call', { name: 'knx_connections' }), id: 5 });
  assert.deepEqual((await p.receive(4)).result, {});
  assert.equal((await p.receive(5)).result.structuredContent.connections.length, 4);
  assert(Date.now() - started < 500, 'Local control must not wait behind catalog discovery');
  const first = (await p.receive(2)).result.tools;
  assert.equal(first.length, 4);
  assert.equal((await p.receive(3)).result.tools.length, 4);
  assert(Date.now() - started >= 800);
  assert(Date.now() - started < 1800, 'One global window, not one timeout per target');
  const again = Date.now();
  p.send({ ...request('tools/list'), id: 6 });
  assert.equal((await p.receive(6)).result.tools.length, 4);
  assert(Date.now() - again < 300, 'Subsequent lists must not repeat the startup wait');
  for (let n = 2; n < first.length; n++) {
    p.send({ ...request('tools/call', { name: first[n].name }), id: 10 + n });
    assert.equal((await p.receive(10 + n)).result.isError, false);
  }
  assert(!p.state.errors.includes(directory));
});

test('Four silent profiles return helpers within one window without delaying initialize', async (t) => {
  const tls = catalogTlsFixture();
  const sites = await Promise.all(
    [1, 2, 3, 4].map((n) => site(t, 'silent-all-' + n, 'silent', 0, tls)),
  );
  const p = child(
    t,
    sites.map((s) => selectedProfile(s, tls)),
  );
  p.send(request('initialize'));
  await p.receive(1);
  assert(sites.every((s) => s.state.received.length === 0));
  p.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const started = Date.now();
  p.send({ ...request('tools/list'), id: 2 });
  assert.equal((await p.receive(2)).result.tools.length, 2);
  assert(Date.now() - started >= 800);
  assert(Date.now() - started < 1800);
});

test('Empty configuration has no initial catalog delay', async (t) => {
  const p = child(t);
  await startChild(p);
  const started = Date.now();
  p.send({ ...request('tools/list'), id: 2 });
  assert.equal((await p.receive(2)).result.tools.length, 2);
  assert(Date.now() - started < 300);
});

test('Cancelling one catalog request preserves the shared wait and other requests', async (t) => {
  const s = await site(t, 'cancel-list', 'silent');
  const p = child(t, [], manualEnvironment(s));
  await startChild(p);
  const started = Date.now();
  p.send({ ...request('tools/list'), id: 2 });
  await until(() => p.state.errors.includes('"method":"tools/list"'));
  p.send({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 2 } });
  assert.equal((await p.receive(2)).error.message, 'REQUEST_CANCELLED');
  assert(Date.now() - started < 500);
  await sleep(400);
  p.send({ ...request('tools/list'), id: 3 });
  assert.equal((await p.receive(3)).result.tools.length, 2);
  assert(Date.now() - started < 1350, 'Cancellation must not start a new one-second window');
});

test('Closing stdio during the catalog wait releases the timer and active sockets', async (t) => {
  const s = await site(t, 'close-list', 'silent');
  const p = child(t, [], manualEnvironment(s));
  await startChild(p);
  p.send({ ...request('tools/list'), id: 2 });
  await until(() => p.state.errors.includes('"method":"tools/list"'));
  const ended = new Promise((resolve) => p.processChild.once('exit', resolve));
  const started = Date.now();
  p.processChild.stdin.end();
  await Promise.race([
    ended,
    sleep(1200).then(() => assert.fail('Process did not close after stdin EOF')),
  ]);
  assert(Date.now() - started < 800);
  assert(!p.state.lines.some((line) => line.id === 2));
});

test('Targets ready after the initial window still notify and appear on a subsequent list', async (t) => {
  const s = await site(t, 'late-catalog', 'ready', 430);
  const p = child(t, [], manualEnvironment(s));
  await startChild(p);
  p.send({ ...request('tools/list'), id: 2 });
  assert.equal((await p.receive(2)).result.tools.length, 2);
  await until(() => p.state.errors.includes('connection_ready'));
  await until(() =>
    p.state.lines.some((line) => line.method === 'notifications/tools/list_changed'),
  );
  p.send({ ...request('tools/list'), id: 3 });
  assert.equal((await p.receive(3)).result.tools.length, 3);
});
