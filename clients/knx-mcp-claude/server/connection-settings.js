/**
 * KNX-MCP
 * Validates private connection profiles and optional named test connections.
 * Credentials remain in memory; stored identity records contain no access keys.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const tls = require('node:tls');
const crypto = require('node:crypto');

const PROFILES_LIMIT = 32;
const MANUAL_LIMIT = 2;

class ConnectorError extends Error {
  constructor(code, status = 0) {
    super(code);
    this.name = 'ConnectorError';
    this.code = code;
    this.status = status;
  }
}
function requireValue(condition, code) {
  if (!condition) throw new ConnectorError(code);
}
function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function cleanName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 64 &&
    !/[\x00-\x1f\x7f]/.test(name)
  );
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(value[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}
function readProfiles(paths) {
  requireValue(
    Array.isArray(paths) && paths.length > 0 && paths.length <= PROFILES_LIMIT,
    'SELECT_1_TO_32_CONNECTION_PROFILES',
  );
  const ids = new Set(),
    endpoints = new Set();
  return paths.map((file) => {
    let profile;
    try {
      const stat = fs.statSync(file);
      requireValue(stat.isFile() && stat.size <= 128 * 1024, 'PROFILE_FILE_TOO_LARGE');
      profile = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      if (e instanceof ConnectorError) throw e;
      throw new ConnectorError('PROFILE_FILE_UNREADABLE');
    }
    requireValue(
      !['knx-mcp-connection/v1', 'knx-mcp-connection/v2'].includes(profile?.format),
      'PROFILE_REEXPORT_FROM_ETS',
    );
    requireValue(profile && profile.format === 'knx-mcp-claude/v1', 'PROFILE_FORMAT_UNSUPPORTED');
    requireValue(
      /^[a-f0-9]{32}$/.test(profile.id) && cleanName(profile.name),
      'PROFILE_ID_OR_NAME_INVALID',
    );
    requireValue(!ids.has(profile.id), 'DUPLICATE_PROFILE_ID');
    ids.add(profile.id);
    let url;
    try {
      url = new URL(profile.endpoint);
    } catch {
      throw new ConnectorError('ENDPOINT_INVALID');
    }
    requireValue(
      url.protocol === 'https:' &&
        url.pathname === '/mcp' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash,
      'HTTPS_MCP_ENDPOINT_REQUIRED',
    );
    requireValue(!endpoints.has(url.href), 'DUPLICATE_ENDPOINT');
    endpoints.add(url.href);
    const key = profile.access_key;
    requireValue(
      typeof key === 'string' &&
        key.length > 0 &&
        key.length <= 4096 &&
        key === key.trim() &&
        /^[\x20-\x7e]+$/.test(key),
      'ACCESS_KEY_REQUIRED_IN_PROFILE',
    );
    requireValue(
      profile.tls &&
        typeof profile.tls.certificate_pem === 'string' &&
        profile.tls.certificate_pem.length <= 32768,
      'PUBLIC_CERTIFICATE_REQUIRED',
    );
    requireValue(
      !profile.tls.certificate_pem.includes('PRIVATE KEY') &&
        (profile.tls.certificate_pem.match(/BEGIN CERTIFICATE/g) || []).length === 1,
      'ONE_PUBLIC_CERTIFICATE_REQUIRED',
    );
    let certificate;
    try {
      certificate = new crypto.X509Certificate(profile.tls.certificate_pem);
    } catch {
      throw new ConnectorError('PUBLIC_CERTIFICATE_INVALID');
    }
    const fingerprint = certificate.fingerprint256.replace(/:/g, '').toUpperCase();
    requireValue(
      /^[0-9A-Fa-f]{64}$/.test(profile.tls.sha256 || '') &&
        fingerprint === profile.tls.sha256.toUpperCase(),
      'CERTIFICATE_FINGERPRINT_MISMATCH',
    );
    requireValue(!certificate.ca, 'SERVER_LEAF_CERTIFICATE_REQUIRED');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    requireValue(
      !tls.checkServerIdentity(host, { subjectaltname: certificate.subjectAltName }),
      'CERTIFICATE_NAME_MISMATCH',
    );
    requireValue(
      Date.now() >= Date.parse(certificate.validFrom) &&
        Date.now() <= Date.parse(certificate.validTo),
      'CERTIFICATE_EXPIRED_OR_NOT_YET_VALID',
    );
    return Object.freeze({
      id: profile.id,
      name: profile.name,
      url,
      key,
      pem: profile.tls.certificate_pem,
      fingerprint,
      trust: 'profile',
    });
  });
}
// Remember only public identities on the agent computer. Reusing a selected file path
// for a different server requires a new, consciously selected profile file.
function rememberProfiles(
  profiles,
  paths,
  directory = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'),
    'KNX-MCP',
    'Claude',
    'identities',
  ),
) {
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    profiles.forEach((profile, index) => {
      const selected = path.resolve(paths[index]);
      const record = path.join(
        directory,
        hash(process.platform === 'win32' ? selected.toLowerCase() : selected) + '.json',
      );
      const identity = canonical({
        id: profile.id,
        endpoint: profile.url.href,
        fingerprint: profile.fingerprint,
      });
      let fd;
      try {
        fd = fs.openSync(record, 'wx', 0o600);
        fs.writeFileSync(fd, identity);
        fs.fsyncSync(fd);
      } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        requireValue(fs.statSync(record).size <= 4096, 'PROFILE_IDENTITY_CHANGED_SELECT_NEW_FILE');
        let previous;
        try {
          previous = JSON.parse(fs.readFileSync(record, 'utf8'));
        } catch {
          throw new ConnectorError('PROFILE_IDENTITY_CHANGED_SELECT_NEW_FILE');
        }
        // Compare only the server identity; credentials and display names are not persisted.
        requireValue(
          previous &&
            canonical({
              id: previous.id,
              endpoint: previous.endpoint,
              fingerprint: previous.fingerprint,
            }) === identity,
          'PROFILE_IDENTITY_CHANGED_SELECT_NEW_FILE',
        );
      } finally {
        if (fd !== undefined) fs.closeSync(fd);
      }
    });
  } catch (e) {
    if (e instanceof ConnectorError) throw e;
    throw new ConnectorError('PUBLIC_IDENTITY_RECORD_UNAVAILABLE');
  }
}

/** Read only the six declared manual fields and the explicit HTTP consent flag. */
function readManualConnections(environment = process.env) {
  const rawConsent = environment.KNX_MCP_ALLOW_HTTP;
  requireValue(
    rawConsent === undefined ||
      rawConsent === '' ||
      rawConsent === 'true' ||
      rawConsent === 'false',
    'HTTP_CONSENT_INVALID',
  );
  const allowHttp = rawConsent === 'true';
  const connections = [];
  for (let slot = 1; slot <= MANUAL_LIMIT; slot++) {
    const value = (field) => environment['KNX_MCP_MANUAL_' + slot + '_' + field] ?? '';
    const name = value('NAME'),
      address = value('URL'),
      key = value('TOKEN');
    const code = (suffix) => 'MANUAL_' + slot + '_' + suffix;
    requireValue(
      [name, address, key].every((x) => typeof x === 'string'),
      code('SETTINGS_INVALID'),
    );
    // An unused block must be completely empty. Partial blocks never borrow a key.
    if (name === '' && address === '' && key === '') continue;
    requireValue(
      [name, address, key].every((x) => x && !x.includes('${user_config.')),
      code('COMPLETE_NAME_URL_TOKEN_REQUIRED'),
    );
    requireValue(cleanName(name.trim()), code('NAME_INVALID'));
    requireValue(
      key.length <= 4096 && key === key.trim() && /^[\x20-\x7e]+$/.test(key),
      code('TOKEN_INVALID'),
    );
    requireValue(address.length <= 2048 && !/[\s\\]/.test(address), code('URL_INVALID'));
    let url;
    try {
      url = new URL(address);
    } catch {
      throw new ConnectorError(code('URL_INVALID'));
    }
    requireValue(
      ['http:', 'https:'].includes(url.protocol) &&
        url.hostname &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash,
      code('HTTP_OR_HTTPS_URL_REQUIRED'),
    );
    if (url.pathname === '/') url.pathname = '/mcp';
    requireValue(url.pathname === '/mcp', code('MCP_PATH_REQUIRED'));
    // HTTP is an explicit test choice, never a retry after a failed HTTPS request.
    requireValue(url.protocol !== 'http:' || allowHttp, 'HTTP_REQUIRES_EXPLICIT_CONSENT');
    connections.push(
      Object.freeze({
        id: hash(url.href).slice(0, 32),
        name: name.trim(),
        url,
        key,
        trust: url.protocol === 'https:' ? 'system' : 'http',
      }),
    );
  }
  return connections;
}

/** Validate the complete configuration before connecting to any target. */
function readConnections(paths, environment = process.env) {
  requireValue(
    Array.isArray(paths) && paths.every((x) => typeof x === 'string'),
    'PROFILE_PATHS_INVALID',
  );
  // Hosts may omit an optional multi-file value or pass an empty argument.
  const files = paths.filter((x) => x !== '');
  requireValue(!files.some((x) => x.includes('${user_config.')), 'PROFILE_SELECTION_UNRESOLVED');
  const profiles = files.length ? readProfiles(files) : [];
  const manual = readManualConnections(environment);
  requireValue(
    profiles.length + manual.length > 0,
    'SELECT_PROFILES_OR_COMPLETE_A_MANUAL_CONNECTION',
  );
  const ids = new Set(),
    endpoints = new Set();
  for (const connection of [...profiles, ...manual]) {
    // URL and ID collisions are errors, including file/manual overlaps. No precedence.
    requireValue(!endpoints.has(connection.url.href), 'DUPLICATE_ENDPOINT');
    requireValue(!ids.has(connection.id), 'DUPLICATE_PROFILE_ID');
    endpoints.add(connection.url.href);
    ids.add(connection.id);
  }
  return { connections: [...profiles, ...manual], profiles, files };
}

module.exports = {
  ConnectorError,
  requireValue,
  hash,
  canonical,
  readProfiles,
  rememberProfiles,
  readManualConnections,
  readConnections,
  PROFILES_LIMIT,
  MANUAL_LIMIT,
};
