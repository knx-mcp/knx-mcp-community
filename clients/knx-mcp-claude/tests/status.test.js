/**
 * KNX-MCP
 * Verifies transport health independently from call errors with synthetic loopback targets.
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { Connector, PROTOCOL } = require('../server/connector');
const { readManualConnections } = require('../server/connection-settings');
const { errorHint, serverMetadata } = require('../server/diagnostics');
const { clientInfo, VERSION } = require('../server/version');

async function fixture(t, name = 'Fixture', version = '1.2.0.4') {
  const state = { mode: 'success', calls: 0, initializations: 0, arguments: null, delay: 0 };
  const tools = ['device_update', 'telegram_get_recent', 'test_read'].map((name) => ({
    name,
    inputSchema: {
      type: 'object',
      properties: { device: { type: 'string' }, values: { type: 'array' } },
    },
    annotations: { readOnlyHint: name !== 'device_update' },
  }));
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.authorization, 'Bearer synthetic-test-key');
    let text = '';
    req.on('data', (chunk) => (text += chunk));
    req.on('end', () => {
      const body = JSON.parse(text);
      const reply = (result) => res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      if (body.method === 'initialize') {
        state.initializations++;
        res.setHeader('Mcp-Session-Id', 'session-' + state.initializations);
        return reply({
          protocolVersion: PROTOCOL,
          serverInfo: { name, version, ignored: 'not-public' },
          capabilities: { tools: {} },
        });
      }
      if (body.method === 'notifications/initialized') {
        res.writeHead(202);
        return res.end();
      }
      if (body.method === 'tools/list') return reply({ tools });
      state.calls++;
      state.arguments = body.params.arguments;
      if (state.mode === 'rpc')
        return res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: -32602, message: 'Synthetic invalid parameters' },
          }),
        );
      if (state.mode === 'disconnect') return req.socket.destroy();
      if (state.mode === 'tool')
        return reply({
          content: [{ type: 'text', text: 'Nothing was changed.' }],
          structuredContent: { error: { code: 'ETS_BUSY' }, warnings: ['fixture-warning'] },
          isError: true,
        });
      const result = {
        content: [{ type: 'text', text: 'read-result' }],
        structuredContent: { received: body.params.arguments },
        isError: false,
      };
      if (state.delay) setTimeout(() => reply(result), state.delay);
      else reply(result);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    return new Promise((resolve) => server.close(resolve));
  });
  const profile = readManualConnections({
    KNX_MCP_MANUAL_1_NAME: name,
    KNX_MCP_MANUAL_1_URL: `http://127.0.0.1:${server.address().port}/mcp`,
    KNX_MCP_MANUAL_1_TOKEN: 'synthetic-test-key',
    KNX_MCP_ALLOW_HTTP: 'true',
  })[0];
  return { profile, state };
}
async function connected(t, sites) {
  const c = new Connector(sites.map((site) => site.profile));
  t.after(() => c.close());
  c.initialized = true;
  await c.refresh();
  return c;
}
async function call(c, upstream = 'test_read', args = {}, target = 0) {
  const route = [...c.tools.values()].find(
    (route) => route.endpoint === c.endpoints[target] && route.upstream.name === upstream,
  );
  return c.handle({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: route.visible.name, arguments: args },
  });
}

test('JSON-RPC parameter error does not disconnect or force a new session', async (t) => {
  const site = await fixture(t);
  const c = await connected(t, [site]);
  site.state.mode = 'rpc';
  const result = await call(c);
  assert.equal(result.structuredContent.error.code, 'RPC_-32602');
  assert.equal(c.status()[0].connected, true);
  assert.equal(c.status()[0].state, 'ready');
  assert.equal(c.status()[0].error, null);
  assert.equal(c.status()[0].last_call_error, 'RPC_-32602');
  assert.match(c.status()[0].call_hint, /parameters/);
  site.state.mode = 'success';
  await call(c);
  assert.equal(c.status()[0].last_call_error, null);
  assert.equal(site.state.initializations, 1);
});
test('Application errors and warnings pass through without disconnecting', async (t) => {
  const site = await fixture(t);
  const c = await connected(t, [site]);
  site.state.mode = 'tool';
  assert.deepEqual(await call(c), {
    content: [{ type: 'text', text: 'Nothing was changed.' }],
    structuredContent: { error: { code: 'ETS_BUSY' }, warnings: ['fixture-warning'] },
    isError: true,
  });
  assert.equal(c.status()[0].connected, true);
  assert.equal(c.status()[0].last_call_error, 'TOOL_ERROR');
});
test('Actual transport failure goes offline without replaying an uncertain write', async (t) => {
  const site = await fixture(t);
  const c = await connected(t, [site]);
  site.state.mode = 'disconnect';
  const result = await call(c, 'device_update', { device: '1.1.1' });
  assert.equal(result.isError, true);
  assert.equal(site.state.calls, 1);
  assert.equal(c.status()[0].connected, false);
  assert.equal(c.status()[0].state, 'offline');
  assert(c.status()[0].transport_error);
  assert.equal(c.endpoints[0].session, null);
});
test('Status includes bounded server identity and independent client metadata', async (t) => {
  const a = await fixture(t, 'ETS5', '1.2.0.4');
  const b = await fixture(t, 'ETS6', '1.2.0.6');
  const c = await connected(t, [a, b]);
  const result = await c.handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'knx_connections' },
  });
  assert.equal(result.structuredContent.client.version, VERSION);
  assert.equal(result.structuredContent.client.publisher, 'Gerald Docenko');
  assert.deepEqual(
    result.structuredContent.connections.map((x) => x.server.version),
    ['1.2.0.4', '1.2.0.6'],
  );
  const raw = JSON.stringify(result);
  assert(!raw.includes('synthetic-test-key'));
  assert(!raw.includes('not-public'));
});
test('Current parameter names and nested arguments reach only the selected site', async (t) => {
  const a = await fixture(t, 'A');
  const b = await fixture(t, 'B');
  const c = await connected(t, [a, b]);
  const args = {
    device: '1.1.1',
    individual_address: '1.1.2',
    parent: '1.1',
    into: 'Room',
    to: 'Other room',
    values: [{ device_address: '1.1.3', parameter: 'x', value: 2 }],
  };
  await call(c, 'device_update', args, 1);
  assert.deepEqual(b.state.arguments, args);
  assert.equal(a.state.calls, 0);
});
test('A waiting telegram call does not block another endpoint', async (t) => {
  const a = await fixture(t, 'A');
  const b = await fixture(t, 'B');
  const c = await connected(t, [a, b]);
  a.state.delay = 150;
  let finished = false;
  const slow = call(c, 'telegram_get_recent', { wait_seconds: 120, since_sequence: 3 }, 0).then(
    () => {
      finished = true;
    },
  );
  await call(c, 'test_read', {}, 1);
  assert.equal(finished, false);
  await slow;
  assert.deepEqual(a.state.arguments, { wait_seconds: 120, since_sequence: 3 });
  // This short fixture does not claim 120 seconds of actual host acceptance.
});
test('Diagnostic guidance and server metadata are bounded and safe', () => {
  assert.equal(serverMetadata(null), null);
  const data = serverMetadata({ name: 'A\nB', version: '1'.repeat(200), secret: 'forbidden' });
  assert.equal(data.name, 'A B');
  assert.equal(data.version.length, 64);
  assert(!Object.hasOwn(data, 'secret'));
  assert.match(errorHint('MANUAL_1_COMPLETE_NAME_URL_TOKEN_REQUIRED'), /Name/);
  assert.match(errorHint('PROFILE_IDENTITY_CHANGED_SELECT_NEW_FILE'), /newly named/);
  assert(!errorHint('unknown-with-secret').includes('unknown-with-secret'));
  assert.equal(clientInfo().ets_app_baseline, '1.2.0.4');
});

test('Launch input diagnostics report presence without retaining paths, tokens or values', () => {
  const { launchInputs } = require('../server/diagnostics');
  const paths = [
    'C:\\private-profile.json',
    '',
    '${user_config.connection_files}',
    '\u2066hidden-path\u2069',
  ];
  const environment = {
    KNX_MCP_MANUAL_1_NAME: 'private-name',
    KNX_MCP_MANUAL_1_URL: 'https://private-host.example/mcp',
    KNX_MCP_MANUAL_1_TOKEN: 'private-token',
    KNX_MCP_MANUAL_2_NAME: '',
    KNX_MCP_MANUAL_2_URL: '${user_config.manual_2_url}',
    KNX_MCP_ALLOW_HTTP: 'false',
    UNRELATED_SECRET: 'unrelated-private-value',
  };
  const snapshot = launchInputs(paths, environment);
  assert.equal(snapshot.profile_argument_count, 4);
  assert.equal(snapshot.nonempty_profile_arguments, 3);
  assert.equal(snapshot.unresolved_profile_arguments, 1);
  assert.equal(snapshot.directional_profile_arguments, 1);
  assert.deepEqual(snapshot.manual_blocks, [
    { slot: 1, name: 'present', url: 'present', token: 'present' },
    { slot: 2, name: 'empty', url: 'unresolved', token: 'absent' },
  ]);
  assert.equal(snapshot.http_option, 'present');
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.manual_blocks));
  assert(Object.isFrozen(snapshot.manual_blocks[0]));
  const output = JSON.stringify(snapshot);
  for (const value of [...paths.filter(Boolean), ...Object.values(environment).filter(Boolean)]) {
    assert(!output.includes(value), 'Input values must not enter diagnostic metadata');
  }
  paths.push('new-private-path');
  delete environment.KNX_MCP_MANUAL_1_TOKEN;
  assert.equal(snapshot.profile_argument_count, 4);
  assert.equal(snapshot.manual_blocks[0].token, 'present');
});

test('Absent launch inputs differ from explicitly empty host settings', () => {
  const { launchInputs } = require('../server/diagnostics');
  const absent = launchInputs([], {});
  const supplied = launchInputs([], {
    KNX_MCP_MANUAL_1_TOKEN: '',
    KNX_MCP_ALLOW_HTTP: 'false',
  });
  assert.equal(absent.profile_argument_count, 0);
  assert.equal(absent.manual_blocks[0].token, 'absent');
  assert.equal(absent.http_option, 'absent');
  assert.equal(supplied.manual_blocks[0].token, 'empty');
  assert.equal(supplied.http_option, 'present');
  assert.match(errorHint('NO_CONNECTIONS_CONFIGURED'), /This process received no profile paths/);
  assert.match(errorHint('NO_CONNECTIONS_CONFIGURED'), /does not reload host settings/);
});

async function until(predicate) {
  const end = Date.now() + 3000;
  while (!predicate() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 10));
  assert(predicate(), 'Expected diagnostic response before deadline');
}
function request(method, params = {}) {
  return { jsonrpc: '2.0', id: 1, method, params };
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

test('Real stdio status identifies the same process before and after refresh without inventing configuration', async (t) => {
  const p = child(t);
  p.send(request('initialize'));
  await p.receive(1);
  p.send({ ...request('tools/call', { name: 'knx_connections' }), id: 2 });
  const first = (await p.receive(2)).result.structuredContent;
  const runtime = first.runtime;
  assert.match(runtime.instance_id, /^[0-9a-f]{16}$/);
  assert.equal(runtime.process_id, p.processChild.pid);
  assert.equal(runtime.node_version, process.versions.node);
  assert.equal(runtime.entry_point_argument_present, true);
  assert.equal(runtime.configuration_input.profile_argument_count, 0);
  assert.equal(runtime.configuration_input.manual_blocks[0].token, 'empty');
  assert(Number.isFinite(Date.parse(runtime.started_at)));
  p.send({ ...request('tools/call', { name: 'knx_refresh_connections' }), id: 3 });
  const refreshed = (await p.receive(3)).result.structuredContent;
  assert.deepEqual(refreshed.runtime, runtime);
  assert.deepEqual(refreshed.connections, []);
  assert.equal(refreshed.setup_errors[0].code, 'NO_CONNECTIONS_CONFIGURED');
  await until(() => p.state.errors.includes('knx_refresh_connections'));
  const diagnostics = p.state.errors
    .split('\n')
    .filter((line) => line.startsWith('KNX-MCP '))
    .map((line) => JSON.parse(line.slice(8)));
  assert(
    diagnostics.every(
      (line) => line.instance_id === runtime.instance_id && line.process_id === runtime.process_id,
    ),
  );
  assert(
    diagnostics.some((line) => line.event === 'local_request' && line.tool === 'knx_connections'),
  );
  assert(
    diagnostics.some(
      (line) => line.event === 'local_ready' && line.runtime.instance_id === runtime.instance_id,
    ),
  );
});

test('Separate real stdio instances distinguish missing inputs from two unreadable selected files', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-launch-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const missing = child(t);
  const files = [
    path.join(directory, 'private-one.json'),
    path.join(directory, 'private-two.json'),
  ];
  const selected = child(t, files);
  const replies = [];
  for (const p of [missing, selected]) {
    p.send(request('initialize'));
    await p.receive(1);
    p.send({ ...request('tools/call', { name: 'knx_connections' }), id: 2 });
    replies.push((await p.receive(2)).result.structuredContent);
  }
  assert.notEqual(replies[0].runtime.instance_id, replies[1].runtime.instance_id);
  assert.notEqual(replies[0].runtime.process_id, replies[1].runtime.process_id);
  assert.equal(replies[0].runtime.configuration_input.profile_argument_count, 0);
  assert.equal(replies[1].runtime.configuration_input.profile_argument_count, 2);
  assert.equal(replies[0].setup_errors[0].code, 'NO_CONNECTIONS_CONFIGURED');
  assert.equal(replies[1].setup_errors.length, 2);
  assert(replies[1].setup_errors.every((error) => error.code === 'PROFILE_FILE_UNREADABLE'));
  for (const p of [missing, selected]) {
    assert(!p.state.stdout.includes(directory));
    assert(!p.state.errors.includes(directory));
  }
});
