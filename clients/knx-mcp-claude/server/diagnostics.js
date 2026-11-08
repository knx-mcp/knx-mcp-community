/**
 * KNX-MCP
 * Provides bounded diagnostic metadata and fixed guidance without exposing input values.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';
const HINTS = Object.freeze({
  NO_CONNECTIONS_CONFIGURED:
    'This process received no profile paths or manual connection values. If profiles are already saved, compare runtime.configuration_input and the instance ID; the host may be using an older or separate process. Refresh retries loaded endpoints only and does not reload host settings.',
  PROFILE_FILE_UNREADABLE:
    'The selected profile cannot be read as JSON. Check its location and file permissions or export it again from ETS.',
  PROFILE_FILE_TOO_LARGE:
    'Select a connection-profile file exported by KNX-MCP, not an ETS project or diagnostic export.',
  PROFILE_REEXPORT_FROM_ETS:
    'Export this connection again from the current ETS add-on as knx-mcp-claude/v1 and select the new file.',
  PROFILE_FORMAT_UNSUPPORTED:
    'This file is not a supported knx-mcp-claude/v1 profile. Export a new connection profile from ETS.',
  PROFILE_SELECTION_UNRESOLVED:
    'Save the file selection in Claude extension settings and restart the extension.',
  DUPLICATE_ENDPOINT:
    'The same endpoint is selected more than once. Keep either its profile or one manual entry, not both.',
  DUPLICATE_PROFILE_ID:
    'Two profiles identify the same connection. Remove the duplicate or export the intended connection again.',
  PROFILE_IDENTITY_CHANGED_SELECT_NEW_FILE:
    'The selected file now identifies another server or certificate. Verify the change and select a newly named export.',
  HTTP_REQUIRES_EXPLICIT_CONSENT:
    'HTTP is unencrypted. Enable the HTTP test option deliberately or use HTTPS.',
  MANUAL_CONNECTION_INCOMPLETE:
    'Complete Name, Remote / Local URL and Bearer token together, or leave the block entirely empty.',
  ACCESS_KEY_REQUIRED_IN_PROFILE:
    'Export the profile again with the current ETS access key. Do not post the file to support.',
  HTTP_401:
    'The access key was rejected. Check the key in ETS and update the profile or manual token.',
  HTTP_403:
    'The endpoint refused access. Check the current server access rules and client blocking settings.',
  HTTP_404:
    'Check the endpoint URL and /mcp path. This response is not automatically treated as a lost session.',
  ECONNREFUSED: 'Start project MCP in ETS and check the configured host and port.',
  ENOTFOUND: 'The computer name could not be resolved. Check the name and network connection.',
  EHOSTUNREACH: 'The endpoint could not be reached. Check the route, VPN and firewall.',
  ECONNRESET:
    'The remote connection was interrupted. Check ETS and refresh this connection before further work.',
  CONNECTION_SETUP_TIMEOUT:
    'The connection did not become ready within its setup deadline. Check ETS and refresh this target; other targets remain available.',
  REQUEST_TIMEOUT:
    'The request deadline expired. Do not automatically repeat a change; first inspect the current ETS state.',
  REQUEST_CANCELLED:
    'The local request was cancelled. Cancellation does not undo work already performed by ETS.',
  CERT_HAS_EXPIRED:
    'Renew the ETS server certificate and export a new profile, or update trusted certificates for a manual connection.',
  CERT_NOT_YET_VALID: 'Check both computer clocks and the certificate validity period.',
  ERR_TLS_CERT_ALTNAME_INVALID:
    'The URL name or IP does not match the certificate. Use a covered address or export a matching profile.',
  CERTIFICATE_NAME_MISMATCH:
    'The profile address does not match its certificate. Correct the ETS address and export again.',
  CERTIFICATE_EXPIRED_OR_NOT_YET_VALID:
    'Check the clock and certificate validity; export an updated profile if needed.',
  CERTIFICATE_FINGERPRINT_MISMATCH:
    'The profile certificate and fingerprint differ. Export a fresh profile from the intended ETS endpoint.',
  REDIRECT_REFUSED:
    'Redirects are not followed. Configure the final verified MCP endpoint directly.',
  TOOL_CATALOG_CHANGED:
    'Refresh this connection and use its current tool definition before repeating the request.',
  TOOL_ERROR:
    'ETS returned an application error. Read the original tool result; the connection can still be available.',
  'RPC_-32602':
    'ETS rejected the call parameters. Check the current tool schema and arguments; the connection is still available.',
  'RPC_-32601':
    'ETS did not recognize the requested method. Refresh the catalog and verify protocol compatibility.',
  SESSION_EXPIRED:
    'The previous ETS session is no longer available. Refresh the connection and recheck the project before changes.',
  NODE_22_16_REQUIRED:
    'Enable a supported bundled Node.js runtime in Claude or update Claude Desktop.',
});
function errorHint(code) {
  if (Object.hasOwn(HINTS, code)) return HINTS[code];
  if (/^MANUAL_[12]_COMPLETE_NAME_URL_TOKEN_REQUIRED$/.test(code))
    return HINTS.MANUAL_CONNECTION_INCOMPLETE;
  if (/^MANUAL_[12]_(URL|NAME|TOKEN)_/.test(code))
    return 'Check the complete manual connection: name, explicit http:// or https:// endpoint and access key without the Bearer prefix.';
  if (
    [
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'SELF_SIGNED_CERT_IN_CHAIN',
    ].includes(code)
  )
    return 'The HTTPS certificate is not trusted. Prefer an exported profile or install the verified certificate in a supported Windows trust store.';
  if (/^RPC_-?\d+$/.test(code))
    return 'ETS returned a JSON-RPC error. Check the request and current tool definition; this alone does not mean the transport disconnected.';
  return 'Check this connection in the extension settings and ETS diagnostics. Do not share access keys or complete profiles in support reports.';
}
function serverMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  // Do not copy arbitrary server fields into diagnostic status or logs.
  for (const key of ['name', 'title', 'version'])
    if (typeof value[key] === 'string')
      result[key] = value[key]
        .replace(/[\x00-\x1f\x7f]/g, ' ')
        .slice(0, key === 'version' ? 64 : 128);
  return Object.keys(result).length ? result : null;
}
// Capture presence and counts only. Never retain paths, tokens or arbitrary environment values.
// This snapshot describes one process at startup, not the host's saved settings or other instances.
function launchInputs(args, environment) {
  const values = Array.isArray(args) ? args : [];
  const state = (value) => {
    if (typeof value !== 'string') return 'absent';
    if (value === '') return 'empty';
    if (value.includes('${user_config.')) return 'unresolved';
    return 'present';
  };
  const blocks = [1, 2].map((slot) => {
    const prefix = 'KNX_MCP_MANUAL_' + slot + '_';
    return Object.freeze({
      slot,
      name: state(environment[prefix + 'NAME']),
      url: state(environment[prefix + 'URL']),
      token: state(environment[prefix + 'TOKEN']),
    });
  });
  return Object.freeze({
    profile_argument_count: values.length,
    nonempty_profile_arguments: values.filter((value) => typeof value === 'string' && value !== '')
      .length,
    unresolved_profile_arguments: values.filter(
      (value) => typeof value === 'string' && value.includes('${user_config.'),
    ).length,
    directional_profile_arguments: values.filter(
      (value) => typeof value === 'string' && /[\u2066-\u2069]/u.test(value),
    ).length,
    manual_blocks: Object.freeze(blocks),
    http_option: state(environment.KNX_MCP_ALLOW_HTTP),
  });
}
module.exports = { errorHint, serverMetadata, launchInputs };
