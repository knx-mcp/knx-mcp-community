# KNX-MCP for Claude Desktop

[English](README.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Čeština](README.cs.md) · [Italiano](README.it.md) · [Русский](README.ru.md)

Connect Claude Desktop to one or more named ETS5/ETS6 instances on Windows.
Each tool identifies its target connection, so you can work with several sites
without mixing their sessions, credentials or certificate trust.

| At a glance | Details |
| --- | --- |
| Client | **1.0.4** |
| Installation package | `KNX-MCP-1.0.4.mcpb` |
| ETS App compatibility baseline | KNX-MCP **1.2.0.4** and compatible later versions |
| Platform | Claude Desktop on Windows |
| Runtime | Node.js **22.16.0 or later**, supplied by the host |
| Publisher | Gerald Docenko |
| Support | [support@knx-mcp.com](mailto:support@knx-mcp.com) |

The client and the ETS App have independent version numbers. The client needs
no third-party JavaScript runtime packages or package downloads at startup.

## Requirements

Before installation, have the following ready:

- A licensed **ETS5 or ETS6** installation.
- The **KNX-MCP ETS App**, installed separately through MyKNX.
- **Claude Desktop on Windows** with support for MCPB extensions.
- Network access from the Claude computer to each intended ETS endpoint.

The `.mcpb` installs the Claude extension. Install the ETS App separately on the
computer running ETS. Other hosts or execution modes can behave differently.

## Install with exported profiles

### 1. Prepare ETS and export a profile

1. Open the intended project in ETS and start its MCP endpoint in the KNX-MCP panel.
2. In **Server settings → HTTPS settings**, enable HTTPS, select or create a
   certificate matching the endpoint address, and apply the settings.
3. Under **Claude One-Click-Installation KNX-MCP**, give the connection a clear
   name and save `KNX-MCP-<name>.json` in a private, permanent folder.

Repeat these steps for each additional ETS endpoint you want to use.

### 2. Install the extension in Claude

1. Install **`KNX-MCP-1.0.4.mcpb`** in Claude's extension settings.
2. Under **Connection profiles (recommended)**, select the exported profile files
   and save the settings. You can select up to **32 profiles**.
3. Fully quit Claude, including its notification-area process, and start it again.
4. Open a **new chat** with KNX-MCP enabled.

The [distribution guide](release/README.md) explains package files and checksums.

### 3. Verify the connection

1. Ask Claude to call **`knx_connections`**.
2. For each intended connection, ask it to actually call **`ets_list_projects`**.
3. Check the reported server and project before making changes. Start with
   **Read-only** enabled in ETS.

### Keep profiles private and in place

Profiles use the format `knx-mcp-claude/v1`:

- A profile contains an **access key in plaintext** and the public server
  certificate. It never contains the certificate's private key.
- Certificate trust applies to that exact connection. No system-wide trust
  entry is installed.
- Keep selected files at their saved paths. After moving or renaming one,
  update the selection in Claude and restart it fully.

**Never upload profiles to chats, support tickets or public repositories.**

## Multiple connections and tool names

Give each connection a distinct name, such as `Office-ETS5` or `Office-ETS6`.
For example, a routed tool is named `Office-ETS6__ets_list_projects`; its display
title includes the full connection name.

- Unsupported characters are normalized in technical tool names.
- Duplicate or long names may receive a distinguishing suffix.
- Offline connections keep their namespace. Calls are never redirected to
  another site because the intended site is unavailable.

A display name is a label, not proof of the remote ETS version. Check the
reported server and current project before changes.

## Two optional manual connections

You can use exported profiles, manual connections, or a combination of both.
Each manual connection has three fields:

| Field | What to enter |
| --- | --- |
| **Name** | A clear, unique connection name |
| **Remote / Local URL** | An explicit address, for example `https://ets-pc.example:51900/mcp` |
| **Bearer token** | The access key only, without the word `Bearer` |

**Complete all three fields in a block, or leave all three empty.**
Do not configure the same endpoint twice; ambiguous entries are disabled.

If the URL has no path, `/mcp` is added. `localhost` means the computer running
Claude, which may differ from the computer running ETS.

### HTTPS

The certificate must match the URL hostname or IP address and be trusted by the
supported Node/Windows trust sources for the account running Claude.

Import only a verified public certificate, or use an exported profile instead.
The extension does not modify certificate stores.

### HTTP for deliberate tests

Enable **Allow unencrypted HTTP test connections** explicitly, even for loopback.
HTTP sends access keys and project data without TLS, so use it only for an
intentional local or otherwise protected test.

HTTPS never silently falls back to HTTP. Redirects are refused.

## Status and recovery

### Check or reconnect a target

| Local tool | Purpose |
| --- | --- |
| `knx_connections` | Show client/server versions, connection state, tool counts and setup, transport or call errors |
| `knx_refresh_connections` | Retry loaded targets, optionally one `connection` ID |

Status also includes process identifiers and input-presence counts for
troubleshooting, without profile paths or credentials. It reflects the **last
observation**, not continuous monitoring.

Refresh uses the configuration already loaded by the running client. After
changing saved host settings or selected profile files, fully restart Claude.
Refresh does not search for files or reload those settings.

### When tools appear late

Targets load independently. The first tool-list response waits up to one shared
second for catalogs already loading; initialization and status remain responsive.
Later catalogs trigger change notifications.

If the host does not reload a later catalog, fully restart Claude after the ETS
endpoint is ready.

### After a connection or session loss

| Operation | Time limit |
| --- | --- |
| Connection setup | 15 seconds in total |
| Tool request | 180 seconds |

Calls are serialized per endpoint, so one site's queue does not block all sites.
After a recognized session loss, a read-only request may be retried once.
A change whose response was lost is **never replayed automatically**.

If you receive **`PROJECT_RECHECK_REQUIRED`**, the change was withheld:

1. Read the current project list and the affected objects.
2. Use an explicit project key and verify that the target is still correct.
3. Deliberately submit the intended change again.

ETS permissions and confirmations remain authoritative.

## Updates and removal

### Install an update

Community packages are updated manually:

1. Install the newer MCPB with the same technical identity `knx-mcp-claude`.
2. Keep your valid v1 profiles selected.
3. Fully quit and restart Claude, then open a new chat.
4. Check the connection and current projects again.

Restart in the same way after changing selected files, keys or certificate trust.
Use the tools loaded for the new chat; do not reuse names from old chat history.

### Change an endpoint address or certificate

Verify the change in ETS, export a profile to a **new filename**, and replace the
old selection in Claude. Silent identity changes at the same profile path are
refused.

### Remove the extension

Removing the extension leaves profile files and certificates in place.
Non-secret identity records also remain under
`%LOCALAPPDATA%/KNX-MCP/Claude/identities`. Deleting those records removes the
previous change-detection history.

## Privacy Policy

Tool descriptions, arguments and results may contain project or customer data.
Results go to Claude and may be processed by its AI service. The complete
interaction is therefore not exclusively local.

The client has no publisher relay, telemetry or automatic publisher upload.
Protect profiles, backups and logs, and make sure you are permitted to share
project data with the AI service.

Read the [Privacy Policy](PRIVACY.md) and [Security information](SECURITY.md).

## Help, source and license

| Topic | Document |
| --- | --- |
| Setup and connection errors | [Troubleshooting](TROUBLESHOOTING.md) |
| Questions and bug reports | [Support](SUPPORT.md) |
| Package files and checksums | [Distribution guide](release/README.md) |
| Included functionality | [Release notes](release/CHANGELOG.md) |
| Build, test and source export | [Development](DEVELOPMENT.md) |

When reporting an error, include the versions, reproduction steps and redacted
diagnostics. Never include private profiles or keys. The technical reference
documents are in English.

The [MIT license](LICENSE.txt) covers this independent client and its text
documentation. The proprietary ETS App, Core and SDK have separate terms.
Branding is covered by the [asset license](assets/LICENSE.txt).

Version and publisher are recorded in `manifest.json`; the preparation date and
ETS App baseline are in `release-info.json`. Built packages include a source
fingerprint in `build-info.json` and a separate SHA256 checksum file.
