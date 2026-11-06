# Read-only workflow: overview of available ETS projects

**Purpose:** Give the user an inventory of ETS projects available to the connected KNX-MCP client, followed by a concise overview of selected project structures.

**Applicable release:** KNX-MCP 1.1.0.0 or later, ETS5 5.7+ or ETS6.

**Safety level:** Project inspection only. **No project edits, bus reads/writes, device programming or permission changes.**

## Prerequisites

- KNX-MCP installed, running inside ETS, with the intended project(s) open.
- **Project MCP switched on** for each project that should be available to the client.
- The client is connected to the configured MCP endpoint.
- Prefer enabling **Read-only** mode in the KNX-MCP Tools panel before starting.

Only projects enabled for MCP can be reached through this connection. Do not interpret an inaccessible project as proof that it is not open in ETS.

## Required permissions

Read/inspect project information, the project list and available building, topology and group-address structure. Leave project-editing, telegram-sending and device-programming tools unused. The workflow must not ask the user to disable safeguards.

## Workflow

1. Ask KNX-MCP which projects are **available through this MCP connection**. Do not invent additional projects.
2. Show the available projects and ask the user which one(s) to examine when the scope is not clear.
3. For each selected project, inspect the available building structure, topology, device overview and group-address structure using the read-only MCP capabilities.
4. Provide a clear summary. Include counts only when they can actually be retrieved; mark missing or unsupported information as **not available**.
5. Mention any inability to access a project or data category rather than silently claiming the inspection was complete.
6. Do not modify the ETS project, change permissions, read/send bus values or program devices.

## Example user request

> Which projects are currently available through KNX-MCP? For each project I select, summarize its building structure, topology, devices and group-address organization. Use read-only project inspection only. Do not change anything or access the KNX bus. If a detail is unavailable, say so rather than guessing.

## Expected result

A project-by-project inventory with a brief scope note, verified structural information and clearly identified gaps. The output is a **read-only snapshot**, not a claim that all ETS projects or devices were checked.

## Privacy and confirmation points

Project names, device names and room structures may be sensitive. Review what you send to your AI client and anonymise any output before sharing it publicly. An explicit separate request and KNX-MCP approval process are required for any later changes; this workflow does not perform them.
