/**
 * KNX-MCP
 * Reads shared product metadata so transport and support identify the same client build.
 *
 * Copyright (c) 2026 Gerald Docenko
 * SPDX-License-Identifier: MIT
 */
'use strict';
const manifest = require('../manifest.json');
const release = require('../release-info.json');
const VERSION = manifest.version;
function clientInfo() {
  return {
    name: manifest.name,
    title: manifest.display_name,
    version: VERSION,
    publisher: manifest.author.name,
    prepared_on: release.prepared_on,
    ets_app_baseline: release.ets_app_baseline,
  };
}
module.exports = { VERSION, clientInfo };
