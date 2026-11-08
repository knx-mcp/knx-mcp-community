# KNX-MCP App release history

This community repository documents official **KNX-MCP ETS App** releases. The application itself is distributed through the [KNX Online Shop (MyKNX)](https://my.knx.org/shop?action=search&search=KNX-MCP), not from GitHub. That URL is a **shop search**, not a direct product download.

| KNX-MCP version | Release | Supported ETS versions | Release information |
|---|---|---|---|
| **1.2.0.4** | Release 2 · November 2026 — improved communication, **HTTPS** | ETS5 5.7+ and ETS6 | [Release notes](release-notes/1.2.0.4.md) · [GitHub release with PDF (EN/DE)](https://github.com/knx-mcp/knx-mcp-community/releases/tag/app-v1.2.0.4) |
| **1.1.0.0** | Release 1 · October 2026 | ETS5 5.7+ and ETS6 | [Release notes](release-notes/1.1.0.0.md) |

**Currently free of charge** in the KNX Online Shop, subject to future change. The MyKNX listing is authoritative for availability and installation.

## KNX-MCP for Claude Desktop

The Claude Desktop extension is an independent, open-source client (MIT license) with its own version number. Unlike the ETS App, its installation package is distributed here.

| Extension version | Release | Compatible ETS App | Downloads |
|---|---|---|---|
| **1.0.4** | Initial release · November 2026 | KNX-MCP 1.2.0.4 and later | [GitHub release `claude-v1.0.4`](https://github.com/knx-mcp/knx-mcp-community/releases/tag/claude-v1.0.4): `KNX-MCP-1.0.4.mcpb`, SHA256 checksum, source archive |

Source, guides and release notes: [`clients/knx-mcp-claude`](../clients/knx-mcp-claude/README.md). Extension releases use tags `claude-v…`; ETS App releases use `app-v…`.

## Next app version

Corrections found after 1.2.0.4 are collected in the community issues and follow as a bug-fix release. Issues marked `status:ready-for-test` are fixed in a released or upcoming version and are closed after a retest. The [1.2.0.0 issue triage](roadmap/knx-mcp-1.2.0.0-issue-triage.md) is kept for reference; its candidates were delivered with 1.2.0.4.

## What GitHub Releases contain

[GitHub Releases](https://github.com/knx-mcp/knx-mcp-community/releases) are intended as a public **announcement and version history**, with descriptions, compatibility and links to MyKNX. From Release 2 on, the release notes are also attached as PDF (English and German). No KNX-MCP ETS App installers, activation files, or proprietary application sources are attached here. Releases tagged `claude-v…` are the exception: they carry the open-source Claude Desktop extension package.

GitHub automatically offers “Source code (zip)” and “Source code (tar.gz)” for tagged releases. **Those archives contain this community repository's documentation and examples only**; they are **not** KNX-MCP installation packages.

## Maintaining the public release list

For each KNX-MCP app version **after it is actually published in MyKNX**:

1. Confirm the published version number, ETS compatibility, release status and actual changes against the official release documentation.
2. Add a version-specific file under [release-notes/](release-notes/) and update the table above and the main README.
3. Create a GitHub release with a descriptive tag such as `app-v1.1.0.0`, targeted at the current `main` branch of this *community* repository. This tag identifies a community-documentation snapshot, not the proprietary application source.
4. Use the verified **app release notes**, not GitHub's automatically generated list of community pull requests, as the source for the release description.
5. Link to the official MyKNX shop search and avoid attaching ETS App packages or inventing a version-specific MyKNX product URL. Attaching the release notes as PDF is fine.
6. Set the new published app version as the latest release when appropriate. Optionally announce it in Discussions.

**Product name:** KNX-MCP. “ETS MCP server” is a technical description, not a second product name. KNX and ETS are trademarks of KNX Association. KNX-MCP is independently developed by Gerald Docenko.
