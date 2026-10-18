# KNX-MCP Community discussions guide

Use [GitHub Discussions](https://github.com/knx-mcp/knx-mcp-community/discussions) for setup help, questions, ideas and reusable KNX/ETS workflows. This repository is not the public source repository for the KNX-MCP application.

## Recommended categories

These names follow the standard GitHub Discussions categories. The available categories and their names are maintained in the GitHub repository settings, not in this Markdown file.

| Category | Appropriate topics | Format |
|---|---|---|
| **Q&A** | Setup, ETS5/ETS6 connectivity, MCP clients, permissions, troubleshooting, how-to questions | Questions with accepted answers |
| **Ideas** | Proposed features and improvements to product capabilities or integration | Open-ended discussion |
| **Show and tell** | Anonymised examples, safe ETS workflows and reusable optional skills | Open-ended discussion |
| **Announcements** | Releases, important changes, maintainer notices | Maintainer announcements |
| **General** | Feedback and broader community conversation | Open-ended discussion |

This is enough structure for a new community; avoid creating many narrow categories until there is clear demand. For **reproducible bugs**, use [GitHub Issues](https://github.com/knx-mcp/knx-mcp-community/issues/new/choose). For documentation or community-skill improvements, open a Pull Request. Report vulnerabilities privately following [SECURITY.md](../SECURITY.md).

## Before asking a question

1. Search the [FAQ](faq.md), the [getting-started guide](getting-started.md) and existing discussions.
2. Describe the **KNX-MCP version**, **ETS version** and **MCP client**, as relevant.
3. Include the expected result, the observed result and minimal steps to reproduce, if applicable.
4. Never publish ETS project files, customer names, customer addresses, access keys, private logs or KNX Secure secrets. Use anonymised screenshots and examples.
5. For a solved **Q&A** topic, the author or maintainers can mark a helpful reply as the accepted answer.

## Maintainer triage

1. Verify that the post does not disclose sensitive data. If it does, prioritise protecting the information.
2. Categorise by intent: **Q&A** for support; **Ideas** for enhancements; **Show and tell** for examples; **General** for broader feedback.
3. Ask for missing client/version details if needed. Verify claims about product capabilities against the current release documentation.
4. For a reproducible defect, suggest opening a structured [Bug report](https://github.com/knx-mcp/knx-mcp-community/issues/new/choose) and cross-link it to the discussion.
5. For Q&A topics, mark accepted answers when resolved. Promote reusable, verified, anonymised solutions into [the FAQ](faq.md) or documentation.
6. Pin only important, long-lived content (for example a welcome post or release update) so normal support questions remain visible.

**GitHub configuration:** This guide defines the recommended structure but does not create or move categories or discussions. To maintain categories, use the discussion category controls in GitHub. See [GitHub's category documentation](https://docs.github.com/en/discussions/managing-discussions-for-your-community/managing-categories-for-discussions).
