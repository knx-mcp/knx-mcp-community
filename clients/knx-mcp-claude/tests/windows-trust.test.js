/**
 * KNX-MCP
 * Verifies native Windows trust using a test-owned certificate on an isolated runner.
 * Explicit opt-in is required; the temporary trust entry is removed in finally.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const { execFileSync, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const enabled = process.platform === 'win32' && process.env.KNX_MCP_TEST_WINDOWS_TRUST === 'true';

test(
  'Native Windows Trusted root store is used for manual HTTPS without changing profile trust',
  { skip: !enabled, timeout: 60000 },
  async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knx-native-trust-'));
    const openssl = fs.existsSync('C:\\Program Files\\Git\\usr\\bin\\openssl.exe')
      ? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe'
      : 'openssl';
    const certFile = path.join(dir, 'leaf.pem'),
      keyFile = path.join(dir, 'key.pem');
    let installed = false,
      server;
    const storeCommand = (operation) => {
      // This utility is confined to an opted-in disposable runner, never the runtime.
      const thumbprint = new crypto.X509Certificate(
        fs.readFileSync(certFile),
      ).fingerprint.replaceAll(':', '');
      assert.match(thumbprint, /^[0-9A-F]{40}$/);
      if (operation === 'add') {
        const script =
          "$ErrorActionPreference='Stop'; if (Test-Path -LiteralPath ('Cert:\\LocalMachine\\Root\\'+$env:KNX_TEST_THUMBPRINT)) { throw 'Fixture already trusted' }";
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
          env: { ...process.env, KNX_TEST_THUMBPRINT: thumbprint },
          timeout: 15000,
          stdio: 'pipe',
        });
        installed = true; // Cleanup also runs if the import process fails after adding the leaf.
        execFileSync('certutil.exe', ['-f', '-addstore', 'Root', certFile], {
          timeout: 15000,
          stdio: 'pipe',
        });
      } else {
        const script =
          "$ErrorActionPreference='Stop'; $store=[System.Security.Cryptography.X509Certificates.X509Store]::new('Root','LocalMachine'); $store.Open('ReadWrite'); try { foreach($item in $store.Certificates.Find('FindByThumbprint',$env:KNX_TEST_THUMBPRINT,$false)) { $store.Remove($item) } } finally { $store.Close() }";
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
          env: { ...process.env, KNX_TEST_THUMBPRINT: thumbprint },
          timeout: 15000,
          stdio: 'pipe',
        });
      }
    };
    try {
      execFileSync(
        openssl,
        [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-subj',
          '/CN=KNX-MCP isolated trust test ' + crypto.randomUUID(),
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
        { stdio: 'ignore', timeout: 15000 },
      );
      let requests = 0;
      server = https.createServer(
        { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) },
        (req, res) => {
          requests++;
          res.writeHead(405);
          res.end();
        },
      );
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const url = 'https://127.0.0.1:' + server.address().port + '/mcp';
      const childScript = `const {readManualConnections}=require(process.env.KNX_TEST_SETTINGS); const {createTransport}=require(process.env.KNX_TEST_TRANSPORT); const p=readManualConnections({KNX_MCP_MANUAL_1_NAME:'Native trust',KNX_MCP_MANUAL_1_URL:process.env.KNX_TEST_URL,KNX_MCP_MANUAL_1_TOKEN:'synthetic'}); const t=createTransport(p[0]); const r=t.client.request(p[0].url,{agent:t.agent},res=>{res.resume();res.on('end',()=>{process.stdout.write('HTTP_'+res.statusCode);t.agent.destroy()})}); r.on('error',e=>{process.stdout.write(e.code);t.agent.destroy()});r.end();`;
      const probe = () =>
        new Promise((resolve, reject) => {
          // A new process is intentional: Node may cache native authority enumeration.
          const child = spawn(process.execPath, ['-e', childScript], {
            env: {
              ...process.env,
              KNX_TEST_SETTINGS: path.resolve(__dirname, '../server/connection-settings.js'),
              KNX_TEST_TRANSPORT: path.resolve(__dirname, '../server/transport.js'),
              KNX_TEST_URL: url,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          let output = '',
            error = '';
          child.stdout.on('data', (b) => (output += b));
          child.stderr.on('data', (b) => (error += b));
          child.once('error', reject);
          const timer = setTimeout(() => {
            child.kill();
            reject(new Error('Trust probe timed out'));
          }, 15000);
          child.on('exit', (code) => {
            clearTimeout(timer);
            code === 0
              ? resolve(output)
              : reject(new Error('Trust fixture process failed: ' + error));
          });
        });
      console.log('NATIVE_TRUST probing untrusted certificate');
      const before = await probe();
      assert.notEqual(before, 'HTTP_405');
      assert.equal(requests, 0);
      console.log('NATIVE_TRUST importing only the test-owned certificate');
      storeCommand('add');
      installed = true;
      console.log('NATIVE_TRUST probing trusted certificate');
      assert.equal(await probe(), 'HTTP_405');
      assert.equal(requests, 1);
      console.log('NATIVE_TRUST removing only the test-owned certificate');
      storeCommand('remove');
      installed = false;
      console.log('NATIVE_TRUST probing removed certificate');
      assert.notEqual(await probe(), 'HTTP_405');
      assert.equal(requests, 1);
    } finally {
      if (installed) storeCommand('remove');
      if (server) {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
);
