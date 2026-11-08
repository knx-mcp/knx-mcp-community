# KNX-MCP distribution files

Client version: **1.0.4**. Technical identity: `knx-mcp-claude`.
Publisher: **Gerald Docenko**. ETS App compatibility baseline: **1.2.0.4**.

| File | Purpose |
|---|---|
| `KNX-MCP-1.0.4.mcpb` | Claude Desktop extension with the client runtime, icon and user guides |
| `KNX-MCP-1.0.4.mcpb.sha256` | SHA256 checksum of that exact package |
| `KNX-MCP-1.0.4-sources.zip` | Standalone source, tests, build scripts and documentation |
| `KNX-MCP-1.0.4-sources.zip.sha256` | Checksum of the source archive |
| `SOURCE-SHA256SUMS.txt` inside the source ZIP | Checksums of the exported source files |

[Release notes](CHANGELOG.md) describe the delivered functionality.
[Installation](../README.md) covers profiles, manual connections and updates.
The source ZIP contains only the `knx-mcp-claude` directory; it does not contain
ETS App/Core/SDK sources, private profiles, customer logs or repository history.

## Verify a package on Windows

In PowerShell, calculate the checksum and compare it with the checksum file
from the same trusted distribution source:

```powershell
Get-FileHash -Algorithm SHA256 .\KNX-MCP-1.0.4.mcpb
Get-Content .\KNX-MCP-1.0.4.mcpb.sha256
```

A checksum verifies byte equality; it does not replace a trusted download source
or an authentic publisher signature. The build scripts create unsigned packages.
Check any host installation warning and the package origin before installing.

## Updates

The extension and ETS App use independent version numbers. Install Community
MCPB updates manually, keep valid `knx-mcp-claude/v1` profiles, then fully quit and
restart Claude. Use a new chat so all processes and tool inventories are current.
The client does not install ETS updates or modify certificate stores.

See [Development](../DEVELOPMENT.md) for reproducible package/source builds,
[License](../LICENSE.txt) for client terms and [Support](../SUPPORT.md) for help.
