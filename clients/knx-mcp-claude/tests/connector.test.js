/**
 * KNX-MCP
 * Isolated regression checks using generated fixtures, never customer endpoints.
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
const https = require('node:https');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { Connector, readProfiles, rememberProfiles, PROTOCOL } = require('../server/connector');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-connector-test-'));
const servers = [];
let pem, key, issuedPem;
before(() => {
  const openssl =
    process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Git\\usr\\bin\\openssl.exe')
      ? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
      : 'openssl';
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
      path.join(tmp, 'key.pem'),
      '-out',
      path.join(tmp, 'cert.pem'),
    ],
    { stdio: 'ignore' },
  );
  pem = fs.readFileSync(path.join(tmp, 'cert.pem'), 'utf8');
  key = fs.readFileSync(path.join(tmp, 'key.pem'));
  execFileSync(
    openssl,
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-subj',
      '/CN=Test issuer',
      '-addext',
      'basicConstraints=critical,CA:TRUE',
      '-days',
      '2',
      '-keyout',
      path.join(tmp, 'issuer.key'),
      '-out',
      path.join(tmp, 'issuer.pem'),
    ],
    { stdio: 'ignore' },
  );
  execFileSync(
    openssl,
    [
      'req',
      '-new',
      '-key',
      path.join(tmp, 'key.pem'),
      '-subj',
      '/CN=localhost',
      '-out',
      path.join(tmp, 'leaf.csr'),
    ],
    { stdio: 'ignore' },
  );
  fs.writeFileSync(
    path.join(tmp, 'extensions.cnf'),
    'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n',
  );
  execFileSync(
    openssl,
    [
      'x509',
      '-req',
      '-in',
      path.join(tmp, 'leaf.csr'),
      '-CA',
      path.join(tmp, 'issuer.pem'),
      '-CAkey',
      path.join(tmp, 'issuer.key'),
      '-CAcreateserial',
      '-days',
      '2',
      '-extfile',
      path.join(tmp, 'extensions.cnf'),
      '-out',
      path.join(tmp, 'issued.pem'),
    ],
    { stdio: 'ignore' },
  );
  issuedPem = fs.readFileSync(path.join(tmp, 'issued.pem'), 'utf8');
});
after(async () => {
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});
async function mock(name, accessKey, certificate = pem) {
  const state = {
    sessions: new Set(),
    reads: 0,
    writes: 0,
    init: 0,
    rejectWrites: false,
    seen: [],
  };
  const tools = [
    {
      name: 'test_read',
      description: 'Read current fixture',
      inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'test_write',
      description: 'Change fixture',
      inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
      annotations: { readOnlyHint: false },
    },
    {
      name: 'ets_list_projects',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
    },
  ];
  const server = https.createServer(
    { key, cert: certificate, minVersion: 'TLSv1.2' },
    (req, res) => {
      let text = '';
      req.on('data', (chunk) => (text += chunk));
      req.on('end', () => {
        const body = JSON.parse(text);
        state.seen.push({
          method: body.method,
          name: body.params?.name,
          session: req.headers['mcp-session-id'],
          userAgent: req.headers['user-agent'],
          clientInfo: body.params?.clientInfo,
        });
        function reply(status, result, session) {
          res.writeHead(status, {
            'content-type': 'application/json',
            ...(session ? { 'mcp-session-id': session } : {}),
          });
          res.end(status === 202 ? '' : JSON.stringify(result));
        }
        if (req.headers.authorization !== 'Bearer ' + accessKey) {
          reply(401, { error: 'invalid_or_missing_access_key' });
          return;
        }
        if (body.method === 'initialize') {
          const session = name + '-' + ++state.init;
          state.sessions.add(session);
          reply(
            200,
            {
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: PROTOCOL,
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: 'knx-mcp', version: 'test' },
                instructions: 'Fixture ' + name,
              },
            },
            session,
          );
          return;
        }
        if (!state.sessions.has(req.headers['mcp-session-id'])) {
          reply(404, { error: 'session_not_found' });
          return;
        }
        if (body.method === 'notifications/initialized') {
          reply(202);
          return;
        }
        let result;
        if (body.method === 'tools/list') result = { tools };
        else if (body.method === 'tools/call') {
          const tool = body.params.name;
          if (tool === 'test_write') {
            state.writes++;
            if (state.rejectWrites) {
              req.socket.destroy();
              return;
            }
          } else state.reads++;
          const data =
            tool === 'ets_list_projects'
              ? { projects: [{ name, key: name + '-key' }] }
              : { site: name, answer: 42 };
          result = {
            content: [{ type: 'text', text: JSON.stringify({ data }) }],
            structuredContent: { data },
            isError: false,
          };
        } else result = {};
        reply(200, { jsonrpc: '2.0', id: body.id, result });
      });
    },
  );
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { ...state, state, port: server.address().port, tools };
}
function profile(port, id, accessKey = 'key', name = 'Site ETS') {
  return {
    format: 'knx-mcp-claude/v1',
    id: id.repeat(32),
    name,
    endpoint: 'https://127.0.0.1:' + port + '/mcp',
    access_key: accessKey,
    tls: {
      certificate_pem: pem,
      sha256: new crypto.X509Certificate(pem).fingerprint256.replace(/:/g, ''),
    },
  };
}
function file(value, name = crypto.randomUUID()) {
  const p = path.join(tmp, name + '.json');
  fs.writeFileSync(p, JSON.stringify(value));
  return p;
}
async function initialized(paths) {
  const connector = new Connector(readProfiles(paths));
  await connector.handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: PROTOCOL },
  });
  await connector.refresh();
  return connector;
}
function route(c, suffix, id) {
  return [...c.tools.values()].find(
    (r) => r.upstream.name === suffix && (!id || r.endpoint.profile.id === id.repeat(32)),
  ).visible.name;
}
function call(c, name, args = {}) {
  return c.handle({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name, arguments: args },
  });
}

test('Two identically named sites retain separate credentials, routes, sessions and results', async () => {
  const a = await mock('alpha', 'alpha-key'),
    b = await mock('beta', 'beta-key');
  const c = await initialized([
    file(profile(a.port, 'a', 'alpha-key')),
    file(profile(b.port, 'b', 'beta-key')),
  ]);
  try {
    assert.equal(c.status().filter((x) => x.connected).length, 2);
    assert.equal(c.tools.size, 6);
    const results = await Promise.all([
      call(c, route(c, 'test_read', 'a')),
      call(c, route(c, 'test_read', 'b')),
    ]);
    assert.equal(results[0].structuredContent.data.site, 'alpha');
    assert.equal(results[1].structuredContent.data.site, 'beta');
    assert.notEqual(c.endpoints[0].session, c.endpoints[1].session);
    assert([...c.tools.keys()].every((k) => k.length <= 64));
  } finally {
    c.close();
  }
});
test('Session 404 reinitializes once and repeats only a classified read', async () => {
  const a = await mock('recover', 'key');
  const c = await initialized([file(profile(a.port, 'c'))]);
  try {
    a.state.sessions.clear();
    const reply = await call(c, route(c, 'test_read'));
    assert.equal(a.state.init, 2);
    assert.equal(a.state.reads, 1);
    assert(reply.content.some((x) => x.text.includes('SESSION_RECOVERED')));
  } finally {
    c.close();
  }
});
test('A write after 404 is withheld; fresh project discovery and read precede an explicit repeat', async () => {
  const a = await mock('change', 'key');
  const c = await initialized([file(profile(a.port, 'd'))]);
  try {
    a.state.sessions.clear();
    const write = route(c, 'test_write'),
      read = route(c, 'test_read');
    assert.equal(
      (await call(c, write, { project: 'change-key' })).structuredContent.error.code,
      'PROJECT_RECHECK_REQUIRED',
    );
    assert.equal(a.state.writes, 0);
    assert((await call(c, write, { project: 'change-key' })).isError);
    await call(c, route(c, 'ets_list_projects'));
    await call(c, read, { project: 'change-key' });
    assert((await call(c, write, { project: 'wrong-key' })).isError);
    assert.equal((await call(c, write, { project: 'change-key' })).isError, false);
    assert.equal(a.state.writes, 1);
  } finally {
    c.close();
  }
});
test('Lost write responses are not replayed and their outcome remains uncertain', async () => {
  const a = await mock('lost', 'key');
  const c = await initialized([file(profile(a.port, 'e'))]);
  try {
    a.state.rejectWrites = true;
    const reply = await call(c, route(c, 'test_write'));
    assert(reply.isError);
    assert.equal(a.state.writes, 1);
    assert.equal(a.state.init, 1);
    assert(reply.content[0].text.includes('may already have executed'));
  } finally {
    c.close();
  }
});
test('An offline site does not redirect calls to an online site', async () => {
  const a = await mock('online', 'key');
  const c = await initialized([file(profile(a.port, 'f')), file(profile(1, '0', 'other-key'))]);
  try {
    assert.equal(c.status().filter((s) => s.connected).length, 1);
    assert.equal((await call(c, route(c, 'test_read', 'f'))).structuredContent.data.site, 'online');
    assert.equal(a.state.reads, 1);
  } finally {
    c.close();
  }
});
test('Invalid profile, wrong name, fingerprint, duplicate IDs and missing access key are refused before connection', () => {
  const valid = profile(12345, '1');
  for (const bad of [
    { ...valid, endpoint: 'http://127.0.0.1/mcp' },
    { ...valid, endpoint: 'https://other.test/mcp' },
    { ...valid, endpoint: 'https://key@localhost/mcp' },
    { ...valid, access_key: '' },
    { ...valid, tls: { ...valid.tls, sha256: '0'.repeat(64) } },
  ])
    assert.throws(() => readProfiles([file(bad)]));
  assert.throws(() => readProfiles([file(valid), file(valid)]));
});
test('Scoped certificate trust does not install global trust and rejects a replaced leaf', async () => {
  const a = await mock('pin', 'key');
  const p = readProfiles([file(profile(a.port, '2'))])[0];
  const c = new Connector([{ ...p, fingerprint: '0'.repeat(64) }]);
  try {
    await c.refresh();
    assert.equal(c.status()[0].connected, false);
    assert.equal(a.state.init, 0);
  } finally {
    c.close();
  }
});
test('Selected profile identity cannot silently change; renaming the display is harmless', () => {
  const input = file(profile(12345, '3'));
  const dir = path.join(tmp, 'identity');
  const p = readProfiles([input]);
  rememberProfiles(p, [input], dir);
  rememberProfiles([{ ...p[0], name: 'New display' }], [input], dir);
  assert.throws(
    () =>
      rememberProfiles([{ ...p[0], url: new URL('https://127.0.0.1:12346/mcp') }], [input], dir),
    /PROFILE_IDENTITY_CHANGED/,
  );
  rememberProfiles([{ ...p[0], key: 'rotated-secret' }], [input], dir);
  const contents = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]), 'utf8');
  assert(!contents.includes('"key"'));
});
test('Manifest-selected files start via real stdio with no system-trust installation or stdout chatter', async () => {
  const a = await mock('stdio', 'stdio-key');
  const input = file(profile(a.port, '4', 'stdio-key'));
  const child = spawn(process.execPath, [path.resolve(__dirname, '../server/index.js'), input], {
    env: { ...process.env, LOCALAPPDATA: path.join(tmp, 'stdio-data') },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '',
    err = '';
  child.stdout.on('data', (b) => (output += b));
  child.stderr.on('data', (b) => (err += b));
  child.stdin.write(
    JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL },
    }) + '\n',
  );
  try {
    const until = Date.now() + 10000;
    while (!output.includes('\n') && Date.now() < until)
      await new Promise((r) => setTimeout(r, 20));
    const response = JSON.parse(output.trim());
    assert.equal(response.result.serverInfo.name, 'knx-mcp-claude');
    assert(!output.includes('stdio-key'));
    assert(err.includes('local_ready'));
    assert(!err.includes('stdio-key'));
  } finally {
    child.stdin.end();
    await new Promise((r) => child.on('exit', r));
  }
});

test('An explicitly pinned issuer-signed leaf works without trusting its issuer globally', async () => {
  const a = await mock('issued', 'key', issuedPem);
  const input = profile(a.port, '5');
  input.tls = {
    certificate_pem: issuedPem,
    sha256: new crypto.X509Certificate(issuedPem).fingerprint256.replace(/:/g, ''),
  };
  const c = await initialized([file(input)]);
  try {
    assert.equal(c.status()[0].connected, true);
    assert.equal((await call(c, route(c, 'test_read'))).structuredContent.data.site, 'issued');
  } finally {
    c.close();
  }
});

test('Already queued reads and writes cannot discharge the recovery barrier', async () => {
  const a = await mock('queued', 'key');
  const c = await initialized([file(profile(a.port, '6'))]);
  try {
    a.state.sessions.clear();
    const actions = [
      call(c, route(c, 'test_write'), { project: 'queued-key' }),
      call(c, route(c, 'ets_list_projects')),
      call(c, route(c, 'test_read'), { project: 'queued-key' }),
      call(c, route(c, 'test_write'), { project: 'queued-key' }),
    ];
    const replies = await Promise.all(actions);
    assert(replies[0].isError);
    assert(replies[3].isError);
    assert.equal(a.state.writes, 0);
    await call(c, route(c, 'test_read'), { project: 'queued-key' });
    assert.equal((await call(c, route(c, 'test_write'), { project: 'queued-key' })).isError, false);
    assert.equal(a.state.writes, 1);
  } finally {
    c.close();
  }
});

test('Single-file credentials override no environment values and never enter status or identity records', async () => {
  const secret = 'private-"quoted"-back\\slash';
  const a = await mock('private-file', secret);
  const input = file(profile(a.port, '7', secret));
  const profiles = readProfiles([input], { KNX_MCP_KEY_1: 'wrong-environment-key' });
  const records = path.join(tmp, 'private-records');
  rememberProfiles(profiles, [input], records);
  const c = new Connector(profiles);
  try {
    await c.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL },
    });
    await c.refresh();
    assert.equal(c.status()[0].connected, true);
    const status = await call(c, 'knx_connections');
    for (const value of [
      JSON.stringify(status),
      ...fs.readdirSync(records).map((n) => fs.readFileSync(path.join(records, n), 'utf8')),
    ]) {
      assert(!value.includes(secret));
      assert(!value.includes('access_key'));
      assert(!value.includes('credentialSlot'));
    }
  } finally {
    c.close();
  }
});

test('Old profiles require explicit re-export; absent or malformed embedded keys have no environment fallback', () => {
  const valid = profile(12345, '8');
  const old = { ...valid, format: 'knx-mcp-connection/v1', credential_slot: 1 };
  delete old.access_key;
  for (const format of ['knx-mcp-connection/v1', 'knx-mcp-connection/v2']) {
    assert.throws(() => readProfiles([file({ ...old, format })]), /PROFILE_REEXPORT_FROM_ETS/);
  }
  assert.throws(
    () => readProfiles([file({ ...valid, format: 'knx-mcp-claude/v2' })]),
    /PROFILE_FORMAT_UNSUPPORTED/,
  );
  for (const access_key of [
    undefined,
    null,
    '',
    23,
    ' key',
    'key ',
    'bad\r\nheader',
    'bad-\u0100',
    'x'.repeat(4097),
  ]) {
    assert.throws(
      () => readProfiles([file({ ...valid, access_key })], { KNX_MCP_KEY_1: 'key' }),
      /ACCESS_KEY_REQUIRED_IN_PROFILE/,
    );
  }
  assert.equal(
    readProfiles([file({ ...valid, access_key: 'x'.repeat(4096) })])[0].key.length,
    4096,
  );
});

test('Public identity records migrate from old key-slot metadata while retaining the exact endpoint pin', () => {
  const input = file(profile(12345, '9'));
  const profiles = readProfiles([input]);
  const p = profiles[0];
  const dir = path.join(tmp, 'old-identity');
  rememberProfiles(profiles, [input], dir);
  const marker = path.join(dir, fs.readdirSync(dir)[0]);
  fs.writeFileSync(
    marker,
    JSON.stringify({
      id: p.id,
      endpoint: p.url.href,
      fingerprint: p.fingerprint,
      credentialSlot: 8,
    }),
  );
  rememberProfiles([{ ...p, key: 'new-key' }], [input], dir);
  assert(!fs.readFileSync(marker, 'utf8').includes('new-key'));
  assert.throws(
    () => rememberProfiles([{ ...p, fingerprint: '0'.repeat(64) }], [input], dir),
    /PROFILE_IDENTITY_CHANGED/,
  );
});

test('More than eight distinct keys and profile limit remain independent of removed key slots', async () => {
  const paths = [],
    expected = [];
  for (let i = 0; i < 9; i++) {
    const secret = 'unique-key-' + i;
    const target = await mock('site-' + i, secret);
    paths.push(file(profile(target.port, i.toString(16), secret)));
    expected.push(secret);
  }
  const c = await initialized(paths);
  try {
    assert.equal(c.status().filter((s) => s.connected).length, 9);
    assert.equal(new Set(c.endpoints.map((e) => e.profile.key)).size, 9);
  } finally {
    c.close();
  }
  assert.throws(() => readProfiles(Array(33).fill(paths[0])), /SELECT_1_TO_32_CONNECTION_PROFILES/);
});

test('Setup failures never echo malformed private profile content on stdout or stderr', async () => {
  const secret = 'do-not-log-private-profile';
  const input = path.join(tmp, 'malformed-private.json');
  fs.writeFileSync(input, '{"access_key":"' + secret + '" invalid-json');
  const child = spawn(process.execPath, [path.resolve(__dirname, '../server/index.js'), input], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '',
    errors = '';
  child.stdout.on('data', (b) => (output += b));
  child.stderr.on('data', (b) => (errors += b));
  try {
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: PROTOCOL },
      }) + '\n',
    );
    const until = Date.now() + 3000;
    while (!output.includes('"id":1') && Date.now() < until)
      await new Promise((r) => setTimeout(r, 10));
    assert(JSON.parse(output.trim()).result.serverInfo);
    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'knx_connections' },
      }) + '\n',
    );
    while (!output.includes('"id":2') && Date.now() < until)
      await new Promise((r) => setTimeout(r, 10));
    assert(output.includes('PROFILE_FILE_UNREADABLE'));
    assert(!output.includes(secret));
    assert(!errors.includes(secret));
    assert(errors.includes('PROFILE_FILE_UNREADABLE'));
  } finally {
    child.stdin.end();
    await new Promise((resolve) => child.on('exit', resolve));
  }
});

test('MCPB configuration supports files and two named tests and includes the original app icon', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, require('../server/connector').VERSION);
  assert.deepEqual(Object.keys(manifest.user_config), [
    'connection_files',
    'manual_1_name',
    'manual_1_url',
    'manual_1_token',
    'manual_2_name',
    'manual_2_url',
    'manual_2_token',
    'allow_insecure_http',
  ]);
  assert.equal(manifest.user_config.connection_files.multiple, true);
  assert.equal(
    manifest.server.mcp_config.env.KNX_MCP_MANUAL_1_TOKEN,
    '${user_config.manual_1_token}',
  );
  assert.equal(manifest.icon, 'assets/icon.png');
  const png = fs.readFileSync(path.join(root, manifest.icon));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const blob = crypto
    .createHash('sha1')
    .update('blob ' + png.length + '\0')
    .update(png)
    .digest('hex');
  assert.equal(blob, '568b31f55231fa370ccd1122751a10b5a72d9838');
  for (const locale of ['en', 'de', 'cs', 'it', 'ru']) {
    const text = JSON.parse(fs.readFileSync(path.join(root, 'locales', locale + '.json'), 'utf8'));
    assert.deepEqual(Object.keys(text.user_config), [
      'connection_files',
      'manual_1_name',
      'manual_1_url',
      'manual_1_token',
      'manual_2_name',
      'manual_2_url',
      'manual_2_token',
      'allow_insecure_http',
    ]);
  }
});

test('Claude technical identity is sent upstream without changing the MCP protocol version', async () => {
  const a = await mock('identity', 'key');
  const c = await initialized([file(profile(a.port, 'a'))]);
  try {
    const request = a.state.seen.find((x) => x.method === 'initialize');
    assert.equal(request.clientInfo.name, 'knx-mcp-claude');
    assert.equal(request.userAgent, 'knx-mcp-claude/' + require('../server/connector').VERSION);
    assert.equal(PROTOCOL, '2025-06-18');
  } finally {
    c.close();
  }
});
test('Claude v1 profiles never downgrade to plaintext HTTP', () => {
  const input = profile(12345, 'b');
  input.endpoint = 'http://127.0.0.1:12345/mcp';
  assert.throws(() => readProfiles([file(input)]), /HTTPS_MCP_ENDPOINT_REQUIRED/);
});
