# KNX-MCP App release history

This community repository documents official **KNX-MCP ETS App** releases. The application itself is distributed through the [KNX Online Shop (MyKNX)](https://my.knx.org/shop?action=search&search=KNX-MCP), not from GitHub. That URL is a **shop search**, not a direct product download.

| KNX-MCP version | Release | Supported ETS versions | Release information |
|---|---|---|---|
| **1.1.0.0** | Release 1 · October 2026 | ETS5 5.7+ and ETS6 | [Release notes](release-notes/1.1.0.0.md) |

**Currently free of charge** in the KNX Online Shop, subject to future change. The MyKNX listing is authoritative for availability and installation.

## Next app version (planned)

The next proposed release is **KNX-MCP 1.2.0.0**. See [community issue triage and verification plan](roadmap/knx-mcp-1.2.0.0-issue-triage.md). Issues are **candidates**, not delivered fixes; 1.2.0.0 has not yet been published in MyKNX.

## What GitHub Releases contain

[GitHub Releases](https://github.com/knx-mcp/knx-mcp-community/releases) are intended as a public **announcement and version history**, with descriptions, compatibility and links to MyKNX. No KNX-MCP ETS App installers, activation files, or proprietary application sources are attached here.

GitHub automatically offers “Source code (zip)” and “Source code (tar.gz)” for tagged releases. **Those archives contain this community repository's documentation and examples only**; they are **not** KNX-MCP installation packages.

## Maintaining the public release list

For each KNX-MCP app version **after it is actually published in MyKNX**:

1. Confirm the published version number, ETS compatibility, release status and actual changes against the official release documentation.
2. Add a version-specific file under [release-notes/](release-notes/) and update the table above and the main README.
3. Create a GitHub release with a descriptive tag such as `app-v1.1.0.0`, targeted at the current `main` branch of this *community* repository. This tag identifies a community-documentation snapshot, not the proprietary application source.
4. Use the verified **app release notes**, not GitHub's automatically generated list of community pull requests, as the source for the release description.
5. Link to the official MyKNX shop search and avoid attaching ETS App packages or inventing a version-specific MyKNX product URL.
6. Set the new published app version as the latest release when appropriate. Optionally announce it in Discussions.

**Product name:** KNX-MCP. “ETS MCP server” is a technical description, not a second product name. KNX and ETS are trademarks of KNX Association. KNX-MCP is independently developed by Gerald Docenko.
