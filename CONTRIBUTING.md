# Contributing

Contributions to the public KNX-MCP community repository are welcome, especially:

- corrections and improvements to documentation
- setup examples for MCP clients
- anonymised workflow examples
- reusable skills and prompts
- reproducible bug reports
- practical feature proposals

The KNX-MCP application source code is not part of this repository.

## Documentation and examples

Please keep contributions concise and technically verifiable. When describing KNX-MCP behaviour, distinguish clearly between:

- behaviour confirmed in the current release
- an example configuration
- an idea or proposed future behaviour

Do not publish customer-specific project structures, addresses, credentials or keys.

## Skills

A skill should be reusable across projects and should document:

1. purpose
2. prerequisites
3. whether it is read-only or may change the project / access the bus
4. required KNX-MCP permissions
5. example user request
6. expected outcome
7. important safety or confirmation points

See [`skills/README.md`](skills/README.md).

## Submitting a documentation or skill change

1. Check [Getting started](docs/getting-started.md) and the [FAQ](docs/faq.md) so guidance does not contradict the supported release.
2. Use a separate branch and open a pull request with a focused description of the change. For product questions or an uncertain proposal, consider [Discussions](https://github.com/knx-mcp/knx-mcp-community/discussions) first.
3. Use repository-relative links for internal documents and verify that every added link resolves.
4. If a skill describes a write or bus operation, explain its permissions and confirmation points; never imply that safety checks are bypassed. The first [read-only project overview](skills/project-overview-read-only.md) is an example.
5. Check the [pull request checklist](.github/PULL_REQUEST_TEMPLATE.md) and remove confidential information before submission.

The examples in this repository are community material, not KNX-MCP application source code.

## Language

English is preferred for repository documentation. German contributions are also welcome; English can be added during review when useful.
