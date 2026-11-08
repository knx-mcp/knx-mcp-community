/**
 * KNX-MCP
 * Adds connection-specific tool titles and conservative effect annotations.
 * Upstream schemas and project authorization remain unchanged.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';
// Presentation metadata only. Project permissions remain enforced by the ETS server.
function titleText(value) {
  return typeof value === 'string'
    ? value
        .replace(/[\x00-\x1f\x7f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160)
    : '';
}
function isReadOnly(tool) {
  return tool?.annotations?.readOnlyHint === true && tool?.annotations?.destructiveHint !== true;
}
function toolMetadata(tool, connectionName = '') {
  const source = tool.annotations && typeof tool.annotations === 'object' ? tool.annotations : {};
  const fallback = String(tool.name || 'Tool').replace(/[_.-]+/g, ' ');
  const caption = titleText(tool.title) || titleText(source.title) || titleText(fallback);
  const title = (connectionName ? '[' + titleText(connectionName) + '] ' : '') + caption;
  const readOnly = isReadOnly(tool);
  return {
    ...tool,
    title,
    annotations: {
      ...source,
      title,
      readOnlyHint: readOnly,
      destructiveHint: !readOnly,
      idempotentHint: source.idempotentHint === true,
      openWorldHint: source.openWorldHint !== false,
    },
  };
}
module.exports = { titleText, isReadOnly, toolMetadata };
