# Getting started with KNX-MCP

This guide covers **KNX-MCP 1.2.0.4 · Release 2**.

> **New in Release 2: improved communication with encryption.** HTTPS directly in the app (optional), the access key as `Authorization: Bearer`, several agents at once, and direct connections for Microsoft Scout and GitHub Copilot. In many cases no proxy or bridge is needed any more.

## 1. Install KNX-MCP

1. Get **KNX-MCP** from the KNX Online Shop (MyKNX): https://my.knx.org/shop?action=search&search=KNX-MCP
2. Install and activate the app in ETS.
3. Open an ETS project.
4. Open the KNX-MCP panel. It contains **Live monitor**, **Tools**, **Server settings** and **Protocol**.

KNX-MCP is currently available free of charge in the KNX Online Shop.

## 2. Enable MCP for the project

New projects start with **Project MCP switched off**.

In the KNX-MCP panel or ETS toolbar, choose **Start project MCP**. In ETS6 the button stays pressed while the project MCP runs; the panel shows **Stopped – please start** while it is off. Only projects whose project MCP runs are reachable through MCP.

Default endpoints:

| ETS | Endpoint |
|---|---|
| ETS6 | `http://127.0.0.1:51900/mcp` |
| ETS5 | `http://127.0.0.1:51950/mcp` |

The port can be changed in **Server settings**. One endpoint serves all enabled projects open in the same ETS instance.

## 3. Start safely

For a first connection, consider enabling **Read-only** in the Tools tab. This lets the assistant inspect the project without changing it or sending values to the bus.

Good first requests are:

- “Which projects can you reach?”
- “Give me an overview of the building and group-address structure.”
- “Which group addresses have no datapoint type or more than one sender?”
- “Show me the devices in room 2.01.”

When you are comfortable with the connection, configure the permission level for individual tool groups or tools.

## 4. Connect an MCP client

The KNX-MCP panel shows ready-to-copy client configuration in **Server settings → Client configuration**, including the current access key. Since 1.2.0.4 the panel also offers templates for HTTPS, Claude one-click installation, Claude Desktop, Claude Code and Microsoft Scout.

Keep the access key private. The examples below use `<KEY>` as a placeholder.

The access key is sent as **`Authorization: Bearer <KEY>`** — the usual way for MCP clients and gateways. The former header `X-KnxMcp-Key` keeps working for existing configurations.

### Clients with native MCP-over-HTTP support

Claude Code, GitHub Copilot, Microsoft Scout and other clients that support Streamable HTTP connect directly:

```json
{
  "mcpServers": {
    "knx-ets6": {
      "type": "http",
      "url": "http://127.0.0.1:51900/mcp",
      "headers": {
        "Authorization": "Bearer <KEY>"
      }
    }
  }
}
```

With HTTPS enabled (see section 8), use the `https://` address shown in the panel.

### Claude Desktop: the KNX-MCP extension (recommended)

For Claude Desktop on Windows, install the **KNX-MCP extension** (`KNX-MCP-1.0.4.mcpb`) from the [GitHub release `claude-v1.0.4`](https://github.com/knx-mcp/knx-mcp-community/releases/tag/claude-v1.0.4). In KNX-MCP, enable HTTPS and export a connection profile under **Server settings**; select the profile in the extension settings in Claude. Up to 32 ETS endpoints can be connected, each with its own access key and certificate. No `mcp-remote` or Node.js configuration is needed. See the [extension guide](../clients/knx-mcp-claude/README.md) for setup, updates and troubleshooting.

### Claude Desktop and other clients via `mcp-remote`

Clients that only start local programs can use `mcp-remote` as the HTTP bridge. This requires Node.js. The access key is passed through an environment variable, so the space in the Bearer value is not part of the command arguments:

```json
{
  "mcpServers": {
    "knx-ets6": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://127.0.0.1:51900/mcp",
        "--allow-http",
        "--header",
        "Authorization:${KNX-MCP_AUTHORIZATION}"
      ],
      "env": {
        "KNX-MCP_AUTHORIZATION": "Bearer <KEY>"
      }
    }
  }
}
```

`--allow-http` is only needed for an `http://` address. For ETS5, use port `51950` unless you changed it in KNX-MCP. For Claude Desktop the KNX-MCP extension above is the simpler way.

## 5. Understand permissions

KNX-MCP permissions are configured per project and per tool.

| Mode | Meaning |
|---|---|
| **Allowed** | runs directly |
| **Confirmation required** | waits for approval in the ETS panel |
| **Blocked** | cannot run |

Default behaviour:

| Group | Default |
|---|---|
| Read, analyse, navigate, export | allowed |
| Telegram tools | allowed; sending a value requires confirmation for every send |
| Change project | confirmation required |
| Program devices | blocked |

The project-wide **Read-only** switch blocks project changes and bus writes regardless of individual tool settings.

Project changes are created as named ETS undo steps.

## 6. Several projects and several clients

KNX-MCP can expose several open projects through one endpoint in both ETS5 and ETS6.

When more than one project is enabled, the MCP client must specify the project for project-specific calls. KNX-MCP does not guess which project should be used.

Several MCP clients can be connected at the same time. Connected clients can be reviewed, logged off or blocked in the KNX-MCP panel.

## 7. Bus functions

Select a working bus connection in ETS. KNX-MCP can monitor telegrams, read and send group values, identify devices and scan a line.

In **ETS5**, telegrams captured directly by KNX-MCP do not contain the sender address. If you need sender information, start the ETS group monitor and select **KNX-MCP as the decoding app**.

Sending a group value requires confirmation by default for every telegram. Device programming is blocked by default until explicitly enabled.

## 8. HTTPS and network access

By default, the MCP endpoint is reachable only from the local ETS computer.

**HTTPS (from 1.2.0.4):** KNX-MCP can encrypt the connection itself. In **Server settings**, create an own certificate on explicit request or choose an existing one from the Windows certificate store, and export its public part for the client. The private key stays on the computer; the access key remains mandatory. Without HTTPS the endpoint uses plain HTTP.

**Gateways and reverse proxies:** additional local DNS names, trusted gateway addresses and allowed origins can be released exactly in Server settings. Microsoft Copilot and ChatGPT reach ETS over the internet through such an MCP gateway.

If you explicitly enable network access in **Server settings**:

- enable **HTTPS**
- keep the access key secret
- restrict access to trusted systems
- prefer a VPN or trusted network

Do not expose the endpoint directly to the public internet.

## 9. Troubleshooting

### The client cannot connect

Check:

- Project MCP is started (the panel does not show **Stopped – please start**).
- The endpoint and port match the ETS version / configured port.
- The access key is current.
- No local firewall rule blocks the selected port.

### The assistant asks which project to use

This is expected when several projects are enabled. Choose the project explicitly.

### A write operation does not run

Check the tool permission and Read-only mode. The tool may be set to **Confirmation required** or **Blocked**.

### ETS5 shows telegrams without a sender

Use the ETS group monitor with KNX-MCP as decoding app when sender information is required.

## 10. Need help?

- Questions and setup help: https://github.com/knx-mcp/knx-mcp-community/discussions
- Bugs: https://github.com/knx-mcp/knx-mcp-community/issues
- Security: see [../SECURITY.md](../SECURITY.md)
