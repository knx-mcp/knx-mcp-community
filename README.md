<p align="center">
  <a href="https://knx-mcp.com/">
    <img src="https://knx-mcp.com/assets/img/knx-mcp-logo-960.webp" alt="KNX-MCP — AI assistant for ETS5 and ETS6" width="300">
  </a>
</p>

<h1 align="center">KNX-MCP Community</h1>

<p align="center"><strong>Your AI assistant works right inside the ETS project.</strong></p>
<p align="center">Community · Setup help · Ideas · Safe AI workflows for ETS5 and ETS6</p>

<p align="center">
  <a href="https://my.knx.org/shop?action=search&amp;search=KNX-MCP">Get KNX-MCP</a> ·
  <a href="https://knx-mcp.com/">Product website</a> ·
  <a href="docs/getting-started.md">Get started</a> ·
  <a href="https://github.com/knx-mcp/knx-mcp-community/discussions">Discussions</a>
</p>

**KNX-MCP** is an ETS App that connects an open ETS project to MCP-compatible AI assistants such as Claude, Microsoft Copilot or ChatGPT through the **Model Context Protocol (MCP)** and the official ETS SDK.

This repository is the public community space for **questions, bug reports, feature ideas, setup help, reusable skills and release information**. It does **not** contain the source code of KNX-MCP.

| | |
|---|---|
| Current version | **1.1.0.0 · Release 1** — validated by KNX |
| ETS support | **ETS5 (5.7 or later) and ETS6** |
| Availability | **Currently available free of charge** in the KNX Online Shop |
| Website | https://knx-mcp.com |
| Publisher | Gerald Docenko |

## Start in four steps

1. Get **KNX-MCP** from the [KNX Online Shop](https://my.knx.org/shop?action=search&search=KNX-MCP) and install the ETS App.
2. Open an ETS project and choose **Switch project MCP on** in KNX-MCP.
3. Under **Server settings → Client configuration**, copy the setup for your MCP client. Keep the access key private.
4. For your first session, enable **Read-only** mode and try:

> Which projects are currently open in ETS? Please also list information about each of these projects.

See [Getting started](docs/getting-started.md) for configuration details and troubleshooting. Only projects enabled for MCP are accessible through the connection.


## Quick links

- **Get KNX-MCP:** https://my.knx.org/shop?action=search&search=KNX-MCP
- **Website:** https://knx-mcp.com
- **Getting started:** [docs/getting-started.md](docs/getting-started.md)
- **Frequently asked questions:** [docs/faq.md](docs/faq.md)
- **Questions & workflows:** https://github.com/knx-mcp/knx-mcp-community/discussions
- **Discussion categories and community guide:** [docs/community-guide.md](docs/community-guide.md)
- **Bug reports:** https://github.com/knx-mcp/knx-mcp-community/issues
- **Skills:** [skills/README.md](skills/README.md) · [Project overview](skills/project-overview-read-only.md) · [Group-address review](skills/group-address-review-read-only.md)
- **App releases:** [Version history](docs/releases.md) · [GitHub Releases](https://github.com/knx-mcp/knx-mcp-community/releases) · [Release 1 notes](docs/release-notes/1.1.0.0.md)
- **Security:** [SECURITY.md](SECURITY.md)

## App releases and downloads

A [1.2.0.0 community issue plan](docs/roadmap/knx-mcp-1.2.0.0-issue-triage.md) tracks incoming feedback and proposed tests. **This version is planned, not yet released.**


KNX-MCP app versions are distributed **only through the [KNX Online Shop (MyKNX)](https://my.knx.org/shop?action=search&search=KNX-MCP)**. The [version history](docs/releases.md) and [GitHub Releases](https://github.com/knx-mcp/knx-mcp-community/releases) provide release information; no KNX-MCP ETS App installer or application source code is hosted here.

## What KNX-MCP does

KNX-MCP works with the project data that ETS itself provides — without exporting a separate project copy.

- **Read and inspect** building structure, topology, trades, functions, group addresses, devices, communication objects, parameters, history and the ETS to-do list.
- **Find group addresses from natural language**, including room names, common synonyms and typical actions such as switching, dimming or reading status values.
- **Check the project** for typical inconsistencies and suspicious configurations.
- **Change the project**: create or update rooms, group addresses, devices, links, parameters, trades, functions and to-do items.
- **Work with the KNX bus through ETS**: monitor telegrams, read and send values, identify devices and scan a line.
- **Use several open projects and several AI clients** at the same time in ETS5 and ETS6.

## You stay in control

Permissions are configured per project and per tool:

- **Allowed** — the tool may run directly.
- **Confirmation required** — KNX-MCP asks in the ETS panel before execution.
- **Blocked** — the tool cannot run.

A project-wide **read-only mode** disables changes and bus writes. Project changes are created as named ETS undo steps. Device programming is blocked by default.

## Data and privacy

KNX-MCP runs locally inside ETS. By default, its MCP endpoint is reachable only from the same computer.

KNX-MCP does not operate a publisher cloud service through which project data is routed. Project data is provided only to the MCP client that you connect. If that client uses a cloud AI provider, the provider's own terms and privacy rules apply.

Optional network access can be enabled explicitly. The KNX-MCP endpoint uses plain HTTP, so remote access should be limited to a trusted network or VPN and protected with the configured access key.

## Community: where to go

| You want to … | Use |
|---|---|
| ask a question or discuss a workflow | **GitHub Discussions** |
| share a setup example | **GitHub Discussions** |
| report a reproducible bug | **Issues → Bug report** |
| propose a product improvement | **Discussions** or **Issues → Feature request** |
| contribute a reusable skill or documentation improvement | **Pull request** |
| report a security problem | **Privately** — see [SECURITY.md](SECURITY.md) |
| discuss a commercial or confidential matter | **support@knx-mcp.com** |

Please **never post ETS project files, customer data, passwords, access keys, KNX Secure keys or other confidential information** in a public issue or discussion. Anonymised screenshots and excerpts are welcome.

For discussion topics, choose **Q&A** for setup and usage questions, **Ideas** for improvements, or **Show and tell** for anonymised practical workflows, where those categories are enabled. See the [community guide](docs/community-guide.md) for triage and accepted-answer guidance.

See [SUPPORT.md](SUPPORT.md) for the complete support routing.

## Skills

The [`skills/`](skills/) directory contains two starting examples for [read-only project overviews](skills/project-overview-read-only.md) and [read-only group-address reviews](skills/group-address-review-read-only.md), plus guidance for contributing reusable prompts and AI-client workflows. These skills are **optional**, project-independent and do not bypass KNX-MCP permissions.

## Languages

English is used as the primary documentation language so the material is useful internationally. Questions and contributions in **German or English** are welcome.

A short German overview is available in [docs/README-de.md](docs/README-de.md).

## License and trademarks

KNX-MCP is licensed under its End User License Agreement, available in MyKNX with the app. This repository contains community documentation and examples; it does not contain the KNX-MCP application source code.

KNX and ETS are trademarks of KNX Association. **KNX-MCP is a software product by Gerald Docenko and is not a product of KNX Association.**
