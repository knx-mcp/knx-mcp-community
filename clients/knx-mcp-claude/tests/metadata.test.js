/**
 * KNX-MCP
 * Isolated regression checks using generated fixtures, never customer endpoints.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isReadOnly, toolMetadata } = require('../server/tool-metadata');
const { Connector, Endpoint, VERSION, PROTOCOL } = require('../server/connector');

test('KNX-MCP display uses the Claude technical identity and two named test blocks and profile input', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.equal(manifest.name, 'knx-mcp-claude');
  assert.equal(manifest.display_name, 'KNX-MCP');
  assert.equal(manifest.version, VERSION);
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
  for (const locale of ['en', 'de', 'fr', 'cs', 'it', 'ru']) {
    const value = JSON.parse(fs.readFileSync(path.join(root, 'locales', locale + '.json')));
    assert.equal(value.display_name, 'KNX-MCP');
    assert(value.long_description.includes('1.2.0.4'));
    assert.deepEqual(Object.keys(value.user_config), [
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
test('Presentation title is distinct from transport identity', async () => {
  const c = new Connector([]);
  const reply = await c.handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: PROTOCOL },
  });
  assert.equal(reply.serverInfo.name, 'knx-mcp-claude');
  assert.equal(reply.serverInfo.title, 'KNX-MCP');
  c.close();
});
test('Both local helper tools have titles and explicit non-destructive read annotations', async () => {
  const c = new Connector([]);
  c.initialized = true;
  const { tools } = await c.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(tools.length, 2);
  for (const tool of tools) {
    assert(tool.title);
    assert.equal(tool.annotations.title, tool.title);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
  }
  c.close();
});
test('Routed tools keep exact names, schemas and endpoint routing while adding a site title', () => {
  const upstream = {
    name: 'device_get_list',
    title: 'Devices',
    inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  };
  const c = new Connector([]);
  c.endpoints = [{ profile: { name: 'Site ETS6', id: 'a'.repeat(32) }, catalog: [upstream] }];
  c.rebuildTools();
  const route = [...c.tools.values()][0];
  assert.equal(route.visible.title, '[Site ETS6] Devices');
  assert.equal(route.upstream, upstream);
  assert.equal(route.visible.inputSchema, upstream.inputSchema);
  assert(route.visible.name.length <= 64);
  assert.equal(route.visible.annotations.openWorldHint, false);
  assert.equal(upstream.annotations.title, undefined);
});
test('Unclassified or contradictory annotations are effectful, never guessed read-only by tool name', () => {
  for (const annotations of [
    undefined,
    {},
    { readOnlyHint: 'true' },
    { readOnlyHint: true, destructiveHint: true },
    { readOnlyHint: false, destructiveHint: false },
  ]) {
    const tool = { name: 'device_get_list', annotations };
    assert.equal(isReadOnly(tool), false);
    const out = toolMetadata(tool);
    assert.equal(out.annotations.readOnlyHint, false);
    assert.equal(out.annotations.destructiveHint, true);
  }
});
test('Metadata fallback is bounded and does not mutate upstream schemas or trusted hints', () => {
  const input = {
    name: 'device_get_list',
    annotations: { title: '  Devices\ncurrent\t  ', readOnlyHint: true },
    inputSchema: { type: 'object' },
  };
  const copy = JSON.stringify(input);
  const output = toolMetadata(input, 'A'.repeat(500));
  assert(output.title.endsWith('Devices current'));
  assert(output.title.length <= 323);
  assert.equal(JSON.stringify(input), copy);
  assert.equal(output.annotations.readOnlyHint, true);
  assert.equal(toolMetadata({ name: 'ga_get_list' }).title, 'ga get list');
});
test('Conflicting read and destructive hints keep the recovery write barrier', async () => {
  // No network or real ETS. Exercise the actual Endpoint.call decision using a bounded fake context.
  const tool = {
    name: 'read_named_but_effectful',
    inputSchema: { type: 'object' },
    annotations: { readOnlyHint: true, destructiveHint: true },
  };
  let posted = 0;
  const endpoint = {
    admittedCalls: 0,
    session: 'existing',
    recovered: true,
    changeWarned: false,
    catalog: [tool],
    enqueue: (action) => action(),
    checkedProjects: new Map(),
    profile: { name: 'Fixture' },
    post: async () => {
      posted++;
      return { content: [], isError: false };
    },
  };
  const result = await Endpoint.prototype.call.call(endpoint, tool.name, {}, '{"type":"object"}');
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error.code, 'PROJECT_RECHECK_REQUIRED');
  assert.equal(posted, 0);
});

function namedEndpoint(
  name,
  id,
  names = ['ets_list_projects', 'project_get_undo_list', 'ga_create_range'],
) {
  return {
    profile: { name, id },
    catalog: names.map((name) => ({ name, inputSchema: { type: 'object' } })),
  };
}
function namedConnector(endpoints) {
  const connector = new Connector([]);
  connector.initialized = true;
  connector.endpoints = endpoints;
  connector.rebuildTools();
  return connector;
}
function namesByEndpoint(connector) {
  return new Map([...connector.tools.values()].map((r) => [r.endpoint.profile.id, r.visible.name]));
}

test('ETS5 and ETS6 retain complete connection names without routine hash suffixes', async () => {
  const five = namedEndpoint('TEST-PC-knx-ets5', 'b'.repeat(32));
  const six = namedEndpoint('TEST-PC-knx-ets6', 'f'.repeat(32));
  const connector = namedConnector([five, six]);
  const { tools } = await connector.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(tools.length, 8);
  for (const endpoint of [five, six]) {
    for (const upstream of endpoint.catalog) {
      const name = endpoint.profile.name + '__' + upstream.name;
      const route = connector.tools.get(name);
      assert(route, 'The full configured name and upstream tool must identify the route');
      assert.equal(route.endpoint, endpoint);
      assert.equal(route.upstream, upstream);
      assert.equal(
        route.visible.title,
        '[' + endpoint.profile.name + '] ' + upstream.name.replaceAll('_', ' '),
      );
      assert.equal(route.visible.annotations.title, route.visible.title);
      assert.equal(route.visible.inputSchema, upstream.inputSchema);
      assert(name.length <= 64);
    }
  }
});

test('Readable aliases forward the original name, arguments and schema only to the selected endpoint', async () => {
  const endpoints = [namedEndpoint('ETS5', 'a'.repeat(32)), namedEndpoint('ETS6', 'b'.repeat(32))];
  const calls = [];
  for (const endpoint of endpoints)
    endpoint.call = async (...args) => {
      calls.push({ endpoint, args });
      return { content: [], isError: false };
    };
  const connector = namedConnector(endpoints);
  const args = { project: 'synthetic-project', parent: '31', number: 6 };
  const result = await connector.handle({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'ETS6__ga_create_range',
      arguments: args,
    },
  });
  assert.equal(result.isError, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, endpoints[1]);
  assert.equal(calls[0].args[0], 'ga_create_range');
  assert.equal(calls[0].args[1], args);
  assert.equal(calls[0].args[2], '{"type":"object"}');
  assert.equal(
    connector.tools.get('ETS6__ga_create_range').visible.annotations.readOnlyHint,
    false,
  );
});

test('Duplicate connection names reserve distinct namespaces even while one catalog is offline', () => {
  const first = namedEndpoint('Same ETS6', 'a'.repeat(32), ['test_read']);
  const second = namedEndpoint('Same ETS6', 'b'.repeat(32), []);
  const connector = namedConnector([first, second]);
  const original = namesByEndpoint(connector).get(first.profile.id);
  second.catalog = first.catalog;
  connector.rebuildTools();
  const both = namesByEndpoint(connector);
  assert.equal(both.get(first.profile.id), original);
  assert.notEqual(both.get(second.profile.id), original);
  connector.endpoints.reverse();
  connector.rebuildTools();
  assert.deepEqual(namesByEndpoint(connector), both);
  first.catalog = [];
  connector.rebuildTools();
  assert.equal(namesByEndpoint(connector).get(second.profile.id), both.get(second.profile.id));
});

test('Case and character normalization cannot merge similarly named connections', () => {
  const endpoints = ['Site A', 'Site_A', 'site_a', 'Síte A'].map((name, i) =>
    namedEndpoint(name, String(i + 1).repeat(32), ['test_read']),
  );
  const connector = namedConnector(endpoints);
  const names = [...connector.tools.keys()];
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, endpoints.length);
  for (const route of connector.tools.values()) {
    assert.match(route.visible.name, /^[A-Za-z0-9_-]{1,64}$/);
    assert(route.visible.title.startsWith('[' + route.endpoint.profile.name + '] '));
  }
});

test('Long and non-Latin names have bounded distinct aliases and retain full display titles', () => {
  const longTool = 'device_' + 'detailed_'.repeat(10) + 'list';
  const names = ['Building-'.repeat(6) + 'ETS5', 'Building-'.repeat(6) + 'ETS6', 'Дом', '家'];
  const connector = namedConnector(
    names.map((name, i) => namedEndpoint(name, String(i + 1).repeat(32), [longTool])),
  );
  assert.equal(connector.tools.size, names.length);
  for (const route of connector.tools.values()) {
    assert.match(route.visible.name, /^[A-Za-z0-9_-]{1,64}$/);
    assert.equal(route.upstream.name, longTool);
    assert(route.visible.title.startsWith('[' + route.endpoint.profile.name + '] '));
  }
});

test('Changed or shortened upstream names never replace an existing tool route', () => {
  const longTool = 'x'.repeat(128);
  const endpoint = namedEndpoint('ETS6', 'a'.repeat(32), ['a.b', 'a_b', longTool]);
  const connector = namedConnector([endpoint]);
  assert.equal(connector.tools.size, 3);
  assert(connector.tools.has('ETS6__a_b'));
  for (const name of connector.tools.keys()) assert.match(name, /^[A-Za-z0-9_-]{1,64}$/);
  const longRoute = [...connector.tools.values()].find((route) => route.upstream.name === longTool);
  const suffix = longRoute.visible.name.slice('ETS6__'.length);
  endpoint.catalog.push({ name: suffix, inputSchema: { type: 'object' } });
  assert.throws(
    () => connector.rebuildTools(),
    (error) => error.code === 'TOOL_ROUTE_COLLISION',
  );
  assert.equal(connector.tools.get(longRoute.visible.name).upstream.name, longTool);
});

test('Ambiguous connection namespace collisions fail closed instead of selecting another endpoint', () => {
  const endpoints = [
    namedEndpoint('Same', '12345678' + 'a'.repeat(24)),
    namedEndpoint('Same', '12345678' + 'b'.repeat(24)),
  ];
  assert.throws(
    () => namedConnector(endpoints),
    (error) => error.code === 'TOOL_ROUTE_COLLISION',
  );
});

test('A stale hashed alias is rejected without executing a modifying operation', async () => {
  const endpoint = namedEndpoint('TEST-PC-knx-ets6', 'a'.repeat(32));
  let called = false;
  endpoint.call = async () => {
    called = true;
    return { content: [] };
  };
  const connector = namedConnector([endpoint]);
  await assert.rejects(
    connector.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'test_pc_knx_ets_aaaaaaaa__ga_create_range_b77ed0',
        arguments: {},
      },
    }),
    (error) => error.code === 'UNKNOWN_TOOL',
  );
  assert.equal(called, false);
});

test('Thirty-four configured endpoints retain distinct routing for complete tool catalogs', () => {
  const upstream = Array.from({ length: 99 }, (_, i) => 'test_read_' + i);
  const endpoints = Array.from({ length: 34 }, (_, i) =>
    namedEndpoint('Site-' + (i + 1) + '-ETS6', (i + 1).toString(16).padStart(32, '0'), upstream),
  );
  const connector = namedConnector(endpoints);
  assert.equal(connector.tools.size, 34 * 99);
  for (const route of connector.tools.values()) {
    assert.match(route.visible.name, /^[A-Za-z0-9_-]{1,64}$/);
    assert.equal(route.visible.name, route.endpoint.profile.name + '__' + route.upstream.name);
  }
});

test('Packaged configuration labels contain no directional isolate controls', () => {
  const root = path.resolve(__dirname, '..');
  for (const relative of [
    'manifest.json',
    ...['en', 'de', 'fr', 'cs', 'it', 'ru'].map((locale) => 'locales/' + locale + '.json'),
  ]) {
    const value = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
    assert(!/[\u2066-\u2069]/.test(JSON.stringify(value)), relative);
  }
});
