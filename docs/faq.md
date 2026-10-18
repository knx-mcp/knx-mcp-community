# KNX-MCP Community FAQ

Applies to **KNX-MCP 1.1.0.0 (Release 1)** for **ETS5 5.7 or later and ETS6**. The documentation shipped with your installed app remains authoritative for your version.

## Where can I get KNX-MCP?

Get the ETS App through the [KNX Online Shop (MyKNX)](https://my.knx.org/shop?action=search&search=KNX-MCP). This is a **shop search link**, not a direct product download. KNX-MCP is **currently** available free of charge; the availability and price can change. See [Getting started](getting-started.md) after installation.

## How do I activate KNX-MCP for a project?

Open the project in ETS and open the KNX-MCP panel. New projects start with **Project MCP switched off**. Choose **Switch project MCP on** in the panel or ETS toolbar. Then use **Server settings → Client configuration** to obtain the configuration for your MCP client. Do not share the displayed access key.

## What are the default MCP endpoints?

| ETS version | Local endpoint |
|---|---|
| ETS6 | `http://127.0.0.1:51900/mcp` |
| ETS5 | `http://127.0.0.1:51950/mcp` |

These are defaults, not fixed addresses: the port can be changed in Server settings. See [Getting started](getting-started.md) for connection examples.

## Which AI clients are supported?

KNX-MCP exposes an MCP endpoint using **Streamable HTTP**. MCP clients that support this transport can connect directly; clients requiring a local stdio process can use a suitable bridge. Client capabilities and configuration formats differ. Use the configuration shown inside KNX-MCP for your setup rather than assuming that every edition of a named AI product accepts the same connection settings.

## Do I need additional skills or prompts?

**No.** KNX-MCP exposes its MCP tools and descriptions directly. Optional [community skills](../skills/README.md) provide repeatable workflows; they are not required for basic use and cannot override ETS or KNX-MCP permissions.

## Why does my AI client not see the project?

Check that ETS is running with the project open, **Project MCP is switched on**, the configured endpoint and port match your ETS instance, and the client uses the current access key. Also check the client’s transport/bridge configuration and local firewall. See the [troubleshooting section](getting-started.md#9-troubleshooting).

## Can one client work with several open ETS projects?

Yes. KNX-MCP can expose several enabled projects through one endpoint. Project-specific operations must identify the intended project when several are available. A project that is open in ETS but has **Project MCP switched off** is not accessible through MCP. Several MCP clients may also connect at once.

## Can KNX-MCP change my project or send KNX telegrams?

Depending on permissions, yes. For each tool KNX-MCP provides **Allowed**, **Confirmation required** and **Blocked** settings. **Read-only** mode prevents project changes and bus writes regardless of individual tool settings. Changes to the ETS project are recorded as named ETS undo steps, but ETS undo should **not** be treated as a way to reverse physical bus actions. Sending telegram values requires confirmation by default for every send; device programming is blocked by default.

Start with an optional [read-only project overview](../skills/project-overview-read-only.md).

## Is it safe to enable access from another computer?

The MCP endpoint is local-only by default. Optional network access uses **plain HTTP, without TLS provided by KNX-MCP**. Use only a trusted network or VPN, protect the configured access key and do **not** expose this endpoint directly to the public internet.

## Are my ETS project data sent to a KNX-MCP cloud service?

KNX-MCP operates in ETS and does not route project data through a publisher-operated cloud service. The **MCP client and AI provider you choose** may process the data they receive under their own terms and privacy policies. Avoid sharing customer-specific data unnecessarily.

## Why are sender addresses missing in ETS5 telegrams?

In ETS5, telegrams captured directly by KNX-MCP do not contain the sender address. When sender information is needed, use the ETS group monitor with **KNX-MCP as the decoding app**. This is a documented Release 1 limitation, not necessarily a client connection problem.

## Is KNX-MCP open source?

The KNX-MCP **application source code is not published in this community repository**. It contains documentation, support information, examples and reusable skills. The application is distributed under its End User License Agreement in MyKNX.

## Where should I ask for help or report an issue?

Use [GitHub Discussions](https://github.com/knx-mcp/knx-mcp-community/discussions) for setup questions and workflows, and [GitHub Issues](https://github.com/knx-mcp/knx-mcp-community/issues) for reproducible bugs. Report vulnerabilities **privately** following the [security policy](../SECURITY.md); never publish access keys, KNX Secure keys, customer projects or identifiable customer data. See [Support](../SUPPORT.md).
