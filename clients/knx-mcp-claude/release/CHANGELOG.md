# KNX-MCP for Claude Desktop — release notes

## 1.0.4 — Initial release

KNX-MCP connects Claude Desktop on Windows to named ETS5/ETS6 endpoints. The
ETS App compatibility baseline is KNX-MCP 1.2.0.4; client and App versions are
independent. Install the ETS App separately through MyKNX.

### Included

- Up to 32 exported HTTPS connection profiles and two optional named manual
  connections. Profiles include an access key and a public certificate.
- Independent endpoint sessions, credentials, certificate trust and request queues.
  Offline targets never redirect calls to another location.
- Readable connection-specific tool names and titles. The current ETS server
  supplies the tool catalog, input schemas and project operations.
- Responsive local initialization, bounded initial catalog discovery and
  notifications for later catalog changes.
- Connection status, server/client version details, process correlation and
  separate setup, transport and operation error reporting without credentials.
- Controlled session recovery, project rechecks before changes and no automatic
  replay of modifying operations with uncertain outcomes.
- Setup fields and complete user guides in English, German, French, Czech,
  Italian and Russian.
- Readable client sources, MIT licensing for client code and text, separate
  branding terms, reproducible builds and SHA256 checksums.

### Installation and operation

Use the [installation guide](../README.md). After installation or configuration
changes, fully quit and restart Claude and open a new chat. Check `knx_connections`
and actually request the current project list for each intended endpoint before
making changes. Keep connection profiles private; their access keys are plaintext.

The first tool list waits up to one shared second for catalogs already loading.
A host that ignores later catalog changes can require a full reconnection once a
late endpoint is available. Configuration-confirmation windows are rendered by the
host; visible directional-character labels are covered in
[Troubleshooting](../TROUBLESHOOTING.md), not fixed by rewriting profile paths.

ETS permissions and confirmations remain in force. Tool results may be processed
by the AI host; see [Privacy](../PRIVACY.md) and [Security](../SECURITY.md).
