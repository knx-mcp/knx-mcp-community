# Getting started with KNX-MCP

This guide covers **KNX-MCP 1.1.0.0 · Release 1**.

## 1. Install KNX-MCP

1. Get **KNX-MCP** from the KNX Online Shop (MyKNX): https://my.knx.org/shop?action=search&search=KNX-MCP
2. Install and activate the app in ETS.
3. Open an ETS project.
4. Open the KNX-MCP panel. It contains **Live monitor**, **Tools**, **Server settings** and **Protocol**.

KNX-MCP is currently available free of charge in the KNX Online Shop.

## 2. Enable MCP for the project

New projects start with **Project MCP switched off**.

In the KNX-MCP panel or ETS toolbar, choose **Switch project MCP on**. Only projects that are switched on are reachable through MCP.

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

The KNX-MCP panel shows ready-to-copy client configuration in **Server settings → Client configuration**, including the current access key.

Keep the access key private. The examples below use `<KEY>` as a placeholder.

### Claude Desktop via `mcp-remote`

For a client configuration that starts local stdio processes, use `mcp-remote` as the HTTP bridge. This requires Node.js.

```json
{
  "mcpServers": {
    "knx-ets6": {
      "command": "npx",
      "args": [
        "mcp-remote@latest",
        "http://127.0.0.1:51900/mcp",
        "--allow-http",
        "--header",
        "X-KnxMcp-Key:<KEY>"
      ]
    }
  }
}
```

For ETS5, use port `51950` unless you changed it in KNX-MCP.

### Clients with native MCP-over-HTTP support

```json
{
  "mcpServers": {
    "knx-ets6": {
      "type": "http",
      "url": "http://127.0.0.1:51900/mcp",
      "headers": {
        "X-KnxMcp-Key": "<KEY>"
      }
    }
  }
}
```

Other MCP-compatible clients can connect directly when they support Streamable HTTP. Clients that only start local programs can use an HTTP-to-stdio bridge such as `mcp-remote`.

## 5. Understand permissions

KNX-MCP permissions are configured per project and per tool.

| Mode | Meaning |
|---|---|
| **Allowed** | runs directly |
| **Confirmation required** | waits for approval in the ETS panel |
| **Blocked** | cannot run |

Default behaviour in Release 1:

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

## 8. Optional network access

By default, the MCP endpoint is reachable only from the local ETS computer.

If you explicitly enable network access in **Server settings**:

- keep the access key secret
- restrict access to trusted systems
- prefer a VPN or trusted network
- remember that the KNX-MCP endpoint itself uses **plain HTTP without TLS**

Do not expose the endpoint directly to the public internet.

## 9. Troubleshooting

### The client cannot connect

Check:

- Project MCP is switched on.
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
