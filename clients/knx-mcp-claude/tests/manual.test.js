/**
 * KNX-MCP
 * Tests named manual connections, HTTP consent and isolated trust using local fixtures.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const { execFileSync, spawn } = require('node:child_process');
const { readConnections, readManualConnections, hash } = require('../server/connection-settings');
const { Connector, PROTOCOL } = require('../server/connector');
const { createTransport, systemAuthorities } = require('../server/transport');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-manual-'));
const servers = [];
let pem, privateKey;
before(() => {
  const binary =
    process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Git\\usr\\bin\\openssl.exe')
      ? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
      : 'openssl';
  execFileSync(
    binary,
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
      path.join(directory, 'key.pem'),
      '-out',
      path.join(directory, 'cert.pem'),
    ],
    { stdio: 'ignore' },
  );
  pem = fs.readFileSync(path.join(directory, 'cert.pem'), 'utf8');
  privateKey = fs.readFileSync(path.join(directory, 'key.pem'));
});
after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  fs.rmSync(directory, { recursive: true, force: true });
});

function settings(slot, name, url, token) {
  return {
    [`KNX_MCP_MANUAL_${slot}_NAME`]: name,
    [`KNX_MCP_MANUAL_${slot}_URL`]: url,
    [`KNX_MCP_MANUAL_${slot}_TOKEN`]: token,
  };
}
function load(environment, files = []) {
  return readConnections(files, environment).connections;
}
function profile(url, key, name = 'Profile ETS') {
  const file = path.join(directory, crypto.randomUUID() + '.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      format: 'knx-mcp-claude/v1',
      id: hash(url).slice(0, 32),
      name,
      endpoint: url,
      access_key: key,
      tls: {
        certificate_pem: pem,
        sha256: new crypto.X509Certificate(pem).fingerprint256.replaceAll(':', ''),
      },
    }),
  );
  return file;
}
async function mock(name, key, secure = false, redirect = null) {
  const state = {
    reads: 0,
    writes: 0,
    initialized: 0,
    calls: 0,
    sessions: new Set(),
    dropWrite: false,
  };
  const tools = [
    {
      name: 'ets_list_projects',
      inputSchema: { type: 'object' },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'test_read',
      title: 'Read fixture',
      inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'test_write',
      inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
      annotations: { readOnlyHint: false },
    },
  ];
  const handler = (request, response) => {
    state.calls++;
    if (redirect) {
      response.writeHead(307, { location: redirect });
      response.end();
      return;
    }
    let raw = '';
    request.on('data', (part) => (raw += part));
    request.on('end', () => {
      if (request.headers.authorization !== 'Bearer ' + key) {
        response.writeHead(401);
        response.end('{"error":"unauthorized"}');
        return;
      }
      const body = JSON.parse(raw);
      if (body.method === 'initialize') {
        const session = name + '-' + ++state.initialized;
        state.sessions.add(session);
        response.writeHead(200, { 'mcp-session-id': session, 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              protocolVersion: PROTOCOL,
              capabilities: { tools: {} },
              serverInfo: { name: 'fixture', version: '1' },
            },
          }),
        );
        return;
      }
      if (!state.sessions.has(request.headers['mcp-session-id'])) {
        response.writeHead(404);
        response.end('{"error":"session_not_found"}');
        return;
      }
      if (body.method === 'notifications/initialized') {
        response.writeHead(202);
        response.end();
        return;
      }
      let result = { tools };
      if (body.method === 'tools/call') {
        if (body.params.name === 'test_write') {
          state.writes++;
          if (state.dropWrite) {
            request.socket.destroy();
            return;
          }
        } else {
          state.reads++;
        }
        const data =
          body.params.name === 'ets_list_projects'
            ? { projects: [{ key: name + '-project', name }] }
            : { site: name };
        result = {
          content: [{ type: 'text', text: JSON.stringify({ data }) }],
          structuredContent: { data },
          isError: false,
        };
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    });
  };
  const server = secure
    ? https.createServer({ key: privateKey, cert: pem }, handler)
    : http.createServer(handler);
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `${secure ? 'https' : 'http'}://127.0.0.1:${server.address().port}/mcp`, state };
}
async function connect(connections) {
  const connector = new Connector(connections);
  await connector.handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: PROTOCOL },
  });
  await connector.refresh();
  return connector;
}
function route(connector, upstream, display) {
  return [...connector.tools.values()].find(
    (value) =>
      value.upstream.name === upstream && (!display || value.endpoint.profile.name === display),
  );
}
function call(connector, name, args = {}) {
  return connector.handle({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

// Configuration is validated as a whole before opening a network connection.
test('Optional files support manual-only setup, but an empty setup is rejected', () => {
  assert.throws(() => readConnections([], {}), /SELECT_PROFILES_OR_COMPLETE_A_MANUAL_CONNECTION/);
  const environment = settings(1, 'Lab ETS6', 'https://localhost:51900/mcp', 'secret');
  assert.equal(readConnections([''], environment).connections.length, 1);
  assert.equal(readConnections([], environment).files.length, 0);
  assert.throws(
    () => readConnections(['${user_config.connection_files}'], environment),
    /PROFILE_SELECTION_UNRESOLVED/,
  );
});
test('Exactly two optional blocks require Name then URL and token without secret-bearing errors', () => {
  const secret = 'NeverPrintThis';
  for (const args of [
    ['name', '', secret],
    ['', 'https://localhost/mcp', secret],
    ['name', 'https://localhost/mcp', ''],
  ]) {
    assert.throws(
      () => load(settings(1, ...args)),
      (error) =>
        error.code === 'MANUAL_1_COMPLETE_NAME_URL_TOKEN_REQUIRED' &&
        !error.message.includes(secret),
    );
  }
  assert.equal(readManualConnections({}).length, 0);
  assert.equal(
    readManualConnections({
      ...settings(1, 'A', 'https://localhost:1/mcp', 'a'),
      ...settings(2, 'B', 'https://localhost:2/mcp', 'b'),
    }).length,
    2,
  );
  assert.throws(
    () => load(settings(2, 'x\nname', 'https://localhost/mcp', secret)),
    /MANUAL_2_NAME_INVALID/,
  );
  assert.throws(
    () => load(settings(2, 'name', 'https://localhost/mcp', 'x\r\nHeader')),
    /MANUAL_2_TOKEN_INVALID/,
  );
});
test('Manual URLs require an explicit scheme, bounded endpoint and no hidden credentials', () => {
  for (const url of [
    'PC:51900',
    'file:///mcp',
    'https://key@localhost/mcp',
    'https://localhost/mcp?key=secret',
    'https://localhost/mcp#secret',
    'https://localhost/else',
    'https://local host/mcp',
    'https://localhost\\evil/mcp',
  ]) {
    assert.throws(() => load(settings(1, 'test', url, 'key')));
  }
  const p = load(settings(1, 'test', 'https://LOCALHOST:51900', 'key'))[0];
  assert.equal(p.url.href, 'https://localhost:51900/mcp');
  assert.equal(p.trust, 'system');
});
test('HTTP needs explicit consent even on loopback; profiles cannot inherit that consent', () => {
  const environment = settings(1, 'Local ETS', 'http://127.0.0.1:51950/mcp', 'key');
  assert.throws(() => load(environment), /HTTP_REQUIRES_EXPLICIT_CONSENT/);
  assert.throws(
    () => load({ ...environment, KNX_MCP_ALLOW_HTTP: 'false' }),
    /HTTP_REQUIRES_EXPLICIT_CONSENT/,
  );
  assert.throws(() => load({ ...environment, KNX_MCP_ALLOW_HTTP: 'yes' }), /HTTP_CONSENT_INVALID/);
  assert.equal(load({ ...environment, KNX_MCP_ALLOW_HTTP: 'true' })[0].trust, 'http');
  assert.throws(
    () => load({ KNX_MCP_ALLOW_HTTP: 'true' }, [profile('http://127.0.0.1:51950/mcp', 'key')]),
    /HTTPS_MCP_ENDPOINT_REQUIRED/,
  );
});
test('Changing a name or key preserves endpoint identity but not another endpoint', () => {
  const a = load(settings(1, 'Old name', 'https://localhost:51900/mcp', 'old'))[0];
  const b = load(settings(2, 'New name', 'https://localhost:51900/mcp', 'new'))[0];
  assert.equal(a.id, b.id);
  assert.notEqual(a.id, load(settings(1, 'New name', 'https://localhost:51950/mcp', 'new'))[0].id);
});
test('Duplicate endpoints across files and manual blocks are refused without precedence', () => {
  const url = 'https://localhost:51900/mcp';
  assert.throws(
    () => load(settings(1, 'Manual', url, 'key'), [profile(url, 'other')]),
    /DUPLICATE_ENDPOINT/,
  );
  assert.throws(
    () =>
      load({
        ...settings(1, 'A', url, 'key'),
        ...settings(2, 'B', 'https://LOCALHOST:51900', 'other'),
      }),
    /DUPLICATE_ENDPOINT/,
  );
});
test('Two HTTP test targets keep names in tool titles, separate keys and sessions', async (t) => {
  const a = await mock('a', 'key-a'),
    b = await mock('b', 'key-b');
  const c = await connect(
    load({
      ...settings(1, 'Garching ETS5', a.url, 'key-a'),
      ...settings(2, 'Garching ETS6', b.url, 'key-b'),
      KNX_MCP_ALLOW_HTTP: 'true',
    }),
  );
  t.after(() => c.close());
  assert.equal(c.status().filter((s) => s.connected).length, 2);
  assert.notEqual(c.endpoints[0].session, c.endpoints[1].session);
  for (const [name, result] of [
    ['Garching ETS5', 'a'],
    ['Garching ETS6', 'b'],
  ]) {
    const tool = route(c, 'test_read', name);
    assert.equal(tool.visible.title, `[${name}] Read fixture`);
    assert.equal((await call(c, tool.visible.name)).structuredContent.data.site, result);
  }
  assert(!JSON.stringify(c.status()).includes('key-a'));
  assert(c.status().every((s) => s.transport === 'http' && s.trust === 'http'));
});
test('Profile HTTPS and manual HTTP can run together without shared trust or routing', async (t) => {
  const a = await mock('pinned', 'pin', true),
    b = await mock('manual', 'manual');
  const c = await connect(
    load({ ...settings(1, 'Manual ETS', b.url, 'manual'), KNX_MCP_ALLOW_HTTP: 'true' }, [
      profile(a.url, 'pin'),
    ]),
  );
  t.after(() => c.close());
  assert.equal(c.status().filter((x) => x.connected).length, 2);
  assert.equal(c.endpoints[0].profile.trust, 'profile');
  assert.equal(c.endpoints[1].profile.trust, 'http');
});
test('HTTP session 404 recovers reads, but withholds writes until a fresh explicit project read', async (t) => {
  const server = await mock('recovery', 'key');
  const c = await connect(
    load({ ...settings(1, 'Recover ETS', server.url, 'key'), KNX_MCP_ALLOW_HTTP: 'true' }),
  );
  t.after(() => c.close());
  server.state.sessions.clear();
  const result = await call(c, route(c, 'test_read').visible.name);
  assert(result.content.some((item) => item.text.includes('SESSION_RECOVERED')));
  assert.equal(server.state.initialized, 2);
  const write = route(c, 'test_write').visible.name;
  assert.equal(
    (await call(c, write, { project: 'recovery-project' })).structuredContent.error.code,
    'PROJECT_RECHECK_REQUIRED',
  );
  assert.equal(server.state.writes, 0);
  await call(c, route(c, 'ets_list_projects').visible.name);
  await call(c, route(c, 'test_read').visible.name, { project: 'recovery-project' });
  assert.equal((await call(c, write, { project: 'recovery-project' })).isError, false);
  assert.equal(server.state.writes, 1);
});
test('A lost HTTP write response is never retried automatically', async (t) => {
  const server = await mock('lost', 'key');
  const c = await connect(
    load({ ...settings(1, 'Test', server.url, 'key'), KNX_MCP_ALLOW_HTTP: 'true' }),
  );
  t.after(() => c.close());
  server.state.dropWrite = true;
  const result = await call(c, route(c, 'test_write').visible.name);
  assert(result.isError);
  assert.equal(server.state.writes, 1);
  assert(result.content[0].text.includes('may already have executed'));
});
test('Redirects are rejected without sending credentials to their destination', async (t) => {
  const destination = await mock('destination', 'key');
  const source = await mock('redirect', 'key', false, destination.url);
  const c = await connect(
    load({ ...settings(1, 'Redirect', source.url, 'key'), KNX_MCP_ALLOW_HTTP: 'true' }),
  );
  t.after(() => c.close());
  assert.equal(c.status()[0].error, 'REDIRECT_REFUSED');
  assert.equal(destination.state.calls, 0);
});
test('Manual HTTPS combines default and system authorities only in its own transport', async (t) => {
  const calls = [];
  t.mock.method(tls, 'getCACertificates', (type) => {
    calls.push(type);
    return type === 'system' ? [pem] : [];
  });
  const server = await mock('trusted', 'key', true);
  const c = await connect(load(settings(1, 'Trusted ETS', server.url, 'key')));
  t.after(() => c.close());
  assert(c.status()[0].connected);
  assert.deepEqual(calls, ['default', 'system']);
  assert.equal(c.endpoints[0].agent.options.rejectUnauthorized, true);
  assert.equal(c.endpoints[0].agent.options.minVersion, 'TLSv1.2');
  const pinned = load({}, [profile(server.url, 'key')])[0];
  const transport = createTransport(pinned);
  t.after(() => transport.agent.destroy());
  assert.deepEqual(calls, ['default', 'system']);
  assert.equal(transport.agent.options.ca, pem);
});
test('Manual HTTPS refuses untrusted certificates before any HTTP request', async (t) => {
  t.mock.method(tls, 'getCACertificates', () => []);
  const server = await mock('untrusted', 'key', true);
  const c = await connect(load(settings(1, 'Untrusted ETS', server.url, 'key')));
  t.after(() => c.close());
  assert.equal(c.status()[0].connected, false);
  assert.equal(server.state.calls, 0);
});
test('System-trusted HTTPS still rejects a different hostname and has no HTTP fallback', async (t) => {
  t.mock.method(tls, 'getCACertificates', () => [pem]);
  const p = load(settings(1, 'test', 'https://localhost:51900/mcp', 'key'))[0];
  const transport = createTransport(p);
  t.after(() => transport.agent.destroy());
  const certificate = { subjectaltname: new crypto.X509Certificate(pem).subjectAltName };
  assert.equal(
    transport.agent.options.checkServerIdentity('other.example', certificate).code,
    'ERR_TLS_CERT_ALTNAME_INVALID',
  );
  assert.throws(
    () => createTransport({ ...p, url: new URL('http://localhost:51900/mcp') }),
    /HTTPS_MCP_ENDPOINT_REQUIRED/,
  );
});
test('A failed system trust read is a fixed error, never an empty-trust bypass', (t) => {
  t.mock.method(tls, 'getCACertificates', () => {
    throw new Error('secret fixture');
  });
  assert.throws(
    () => systemAuthorities(),
    (e) => e.code === 'SYSTEM_TRUST_UNAVAILABLE' && !e.message.includes('secret'),
  );
});
test('Manifest has exactly two ordered name URL token blocks, localized and sensitive', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  const expected = [
    'connection_files',
    'manual_1_name',
    'manual_1_url',
    'manual_1_token',
    'manual_2_name',
    'manual_2_url',
    'manual_2_token',
    'allow_insecure_http',
  ];
  assert.deepEqual(Object.keys(manifest.user_config), expected);
  assert.equal(manifest.user_config.connection_files.required, false);
  assert.equal(manifest.user_config.allow_insecure_http.default, false);
  for (const slot of [1, 2]) {
    assert.equal(manifest.user_config[`manual_${slot}_token`].sensitive, true);
    assert(!JSON.stringify(manifest.server.mcp_config.args).includes('token'));
  }
  for (const locale of ['en', 'de', 'cs', 'it', 'ru']) {
    const values = JSON.parse(fs.readFileSync(path.join(root, 'locales', locale + '.json')));
    assert.deepEqual(Object.keys(values.user_config), expected);
    for (const value of Object.values(values.user_config)) assert(value.title && value.description);
  }
});
test('Manual-only settings start over real stdio without keys in output or stored identities', async (t) => {
  const server = await mock('stdio', 'fixture-secret');
  const privateDir = path.join(directory, 'manual-only');
  fs.mkdirSync(privateDir);
  const environment = {
    ...process.env,
    ...settings(1, 'Manual stdio', server.url, 'fixture-secret'),
    KNX_MCP_ALLOW_HTTP: 'true',
    KNX_MCP_MANUAL_2_NAME: '',
    KNX_MCP_MANUAL_2_URL: '',
    KNX_MCP_MANUAL_2_TOKEN: '',
    LOCALAPPDATA: privateDir,
  };
  const child = spawn(process.execPath, [path.resolve(__dirname, '../server/index.js')], {
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk));
  child.stderr.on('data', (chunk) => (stderr += chunk));
  child.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL },
    }) + '\n',
  );
  const started = Date.now();
  while (!stdout.includes('\n') && Date.now() - started < 8000)
    await new Promise((r) => setTimeout(r, 20));
  assert(stdout.includes('\n'));
  const reply = JSON.parse(stdout.trim());
  assert.equal(reply.id, 1);
  assert(reply.result.instructions.includes('Manual stdio'));
  child.stdin.end();
  await new Promise((resolve) => child.on('exit', resolve));
  assert(!stdout.includes('fixture-secret'));
  assert(!stderr.includes('fixture-secret'));
  assert.deepEqual(fs.readdirSync(privateDir), []);
});
test('Partial manual startup errors cannot expose a token through stderr', async (t) => {
  const child = spawn(process.execPath, [path.resolve(__dirname, '../server/index.js')], {
    env: {
      ...process.env,
      ...settings(1, 'Private', '', 'DO_NOT_PRINT_TOKEN'),
      KNX_MCP_ALLOW_HTTP: 'false',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (b) => (stdout += b));
  child.stderr.on('data', (b) => (stderr += b));
  child.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL },
    }) + '\n',
  );
  const until = Date.now() + 3000;
  while (!stdout.includes('\n') && Date.now() < until) await new Promise((r) => setTimeout(r, 10));
  assert(JSON.parse(stdout.trim()).result.serverInfo);
  child.stdin.end();
  const code = await new Promise((resolve) => child.on('exit', resolve));
  assert.equal(code, 0);
  assert(!stdout.includes('DO_NOT_PRINT_TOKEN'));
  assert(!stderr.includes('DO_NOT_PRINT_TOKEN'));
  assert(stderr.includes('MANUAL_1_COMPLETE_NAME_URL_TOKEN_REQUIRED'));
});
