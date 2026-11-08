/**
 * KNX-MCP
 * Creates isolated HTTP or HTTPS transports for validated connections.
 * No redirects, automatic TLS downgrade, trust-store writes or proxy discovery.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';

const http = require('node:http');
const https = require('node:https');
const tls = require('node:tls');
const { ConnectorError, requireValue, hash } = require('./connection-settings');

/** Read host trust only for manual HTTPS; never add it to a profile's pinned trust. */
function systemAuthorities() {
  requireValue(typeof tls.getCACertificates === 'function', 'SYSTEM_TRUST_API_UNAVAILABLE');
  try {
    return [...new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])];
  } catch {
    throw new ConnectorError('SYSTEM_TRUST_UNAVAILABLE');
  }
}

function createTransport(profile) {
  const common = { keepAlive: false, maxSockets: 2 };
  if (profile.trust === 'http') {
    requireValue(profile.url.protocol === 'http:', 'TRANSPORT_POLICY_MISMATCH');
    return { client: http, agent: new http.Agent(common) };
  }
  requireValue(profile.url.protocol === 'https:', 'HTTPS_MCP_ENDPOINT_REQUIRED');
  if (profile.trust === 'system') {
    return {
      client: https,
      agent: new https.Agent({
        ...common,
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
        ca: systemAuthorities(),
        allowPartialTrustChain: true,
        checkServerIdentity: tls.checkServerIdentity,
      }),
    };
  }
  requireValue(
    profile.trust === 'profile' && profile.pem && profile.fingerprint,
    'PROFILE_TRUST_REQUIRED',
  );
  return {
    client: https,
    agent: new https.Agent({
      ...common,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      ca: profile.pem,
      allowPartialTrustChain: true,
      checkServerIdentity(host, certificate) {
        const error = tls.checkServerIdentity(host, certificate);
        if (error) return error;
        if (!certificate.raw || hash(certificate.raw).toUpperCase() !== profile.fingerprint) {
          return new ConnectorError('SERVER_IDENTITY_CHANGED');
        }
        return undefined;
      },
    }),
  };
}

module.exports = { createTransport, systemAuthorities };
