/**
 * KNX-MCP
 * Loads independent connection inputs without making one invalid entry block others.
 * Invalid and ambiguous entries stay disabled; diagnostics contain no file contents.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';

const {
  ConnectorError,
  readProfiles,
  readManualConnections,
  rememberProfiles,
  PROFILES_LIMIT,
  MANUAL_LIMIT,
} = require('./connection-settings');

const { errorHint } = require('./diagnostics');

function setupIssue(source, error) {
  const code = error instanceof ConnectorError ? error.code : 'CONFIGURATION_INVALID';
  const hint = errorHint(code);
  return { source, code, message: hint };
}

function loadConfiguration(paths, environment = process.env, remember = rememberProfiles) {
  const candidates = [],
    errors = [];
  if (!Array.isArray(paths) || paths.some((value) => typeof value !== 'string')) {
    errors.push(setupIssue('profiles', new ConnectorError('PROFILE_PATHS_INVALID')));
  } else {
    const files = paths.filter((value) => value !== '');
    if (files.length > PROFILES_LIMIT) {
      errors.push(setupIssue('profiles', new ConnectorError('SELECT_1_TO_32_CONNECTION_PROFILES')));
    } else {
      files.forEach((file, index) => {
        const source = 'profile:' + (index + 1);
        try {
          if (file.includes('${user_config.'))
            throw new ConnectorError('PROFILE_SELECTION_UNRESOLVED');
          candidates.push({ connection: readProfiles([file])[0], source, file });
        } catch (error) {
          errors.push(setupIssue(source, error));
        }
      });
    }
  }
  for (let slot = 1; slot <= MANUAL_LIMIT; slot++) {
    const source = 'manual:' + slot;
    // A block never borrows a field or token from another block.
    const selected = { KNX_MCP_ALLOW_HTTP: environment.KNX_MCP_ALLOW_HTTP };
    for (const field of ['NAME', 'URL', 'TOKEN']) {
      const name = 'KNX_MCP_MANUAL_' + slot + '_' + field;
      selected[name] = environment[name];
    }
    try {
      for (const connection of readManualConnections(selected))
        candidates.push({ connection, source });
    } catch (error) {
      errors.push(setupIssue(source, error));
    }
  }
  const connections = [];
  for (const candidate of candidates) {
    const { connection, source, file } = candidate;
    try {
      // Disable every member of an ambiguous group. Input order is not a trust decision.
      if (
        candidates.some(
          (other) => other !== candidate && other.connection.url.href === connection.url.href,
        )
      )
        throw new ConnectorError('DUPLICATE_ENDPOINT');
      if (candidates.some((other) => other !== candidate && other.connection.id === connection.id))
        throw new ConnectorError('DUPLICATE_PROFILE_ID');
      if (file) remember([connection], [file]);
      connections.push(Object.freeze({ ...connection, source }));
    } catch (error) {
      errors.push(setupIssue(source, error));
    }
  }
  if (!connections.length && !errors.length)
    errors.push(setupIssue('configuration', new ConnectorError('NO_CONNECTIONS_CONFIGURED')));
  return { connections, errors };
}

module.exports = { loadConfiguration, setupIssue };
