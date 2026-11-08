# Privacy Policy

**Last updated: 8 November 2026.**
Product: independent KNX-MCP client for ETS App 1.2.0.4 and compatible later versions.
Publisher/contact: Gerald Docenko, support@knx-mcp.com. This notice describes technical data processing by the client; separate services have their own policies.

## Data read and used

The extension reads the connection-profile files explicitly selected in Claude and up to two manual connection blocks passed by the host through declared environment variables. Each profile contains a display name, endpoint address, identifier, access key in plaintext, and public certificate/fingerprint. Manual blocks contain a name, URL and access key. Certificate private keys are not exported from ETS. Profiles are read at process start; no directory scan or unrelated user-file search is performed. The extension does not request chat history, Claude memory, or conversation archives. Claude sends the parameters of requested tool calls to the extension.

## Network transmission and third parties

For selected profiles, the extension sends authentication and MCP requests over HTTPS to the exact ETS endpoints and checks the server certificate, hostname and pinned fingerprint in a per-connection TLS context. Manual HTTPS uses the supported default/system trust sources and hostname validation. Manual HTTP requires explicit consent and transmits authentication and project data without encryption. No HTTP redirect is followed and no HTTPS failure falls back to HTTP. There is no developer-operated relay, telemetry endpoint, advertising or automatic developer upload in this client implementation. Requested tool descriptions, server instructions, tool arguments and results may contain project names, building topology, addresses, device information, comments or other personal/customer data. Results and metadata are handed to Claude over local stdio and can be processed by the AI service according to the account's terms and settings. The complete interaction is therefore not exclusively local. Obtain appropriate authorization before sharing project data; this client does not determine the lawful basis for every installation.

## Local storage and retention

Profiles remain at the user-selected path until the user deletes them. They are not encrypted by this extension or by selecting them in Claude. Restrict file permissions, backups and synchronisation accordingly. The extension retains public identity records under `%LOCALAPPDATA%/KNX-MCP/Claude/identities` on Windows. They contain endpoint, profile identifier and certificate fingerprint, not access keys or project contents; their filenames derive from the selected profile path. They remain until explicitly removed. Session IDs, access keys and operational responses are held in process memory during use; garbage collection is not a secure-memory-erasure guarantee. The client writes no raw project-response log. Claude may retain configuration and diagnostic logs under its own controls. Separately, the ETS app has its own in-memory diagnostic options, explicit exports and private Debug live logs.

## Access, removal and support

Disable/remove the extension in Claude to stop it. Remove selected profile files and, when appropriate, the public identity records to remove this client's retained files. Removing the extension does not guarantee that Claude removes its historical configuration/logs or that external backups disappear. Do not send credential profiles, keys, private certificates or unredacted customer logs in support tickets. If a profile was exposed, change the ETS access key and export replacement profiles; deleting the copy alone does not revoke the key. Existing ETS project/tool permissions and confirmations remain the authorization controls.

## Optional manual test connections

Two complete named connections may be entered through Claude settings. Bearer tokens are sensitive host settings passed through the process environment, not command arguments; this adapter does not write them to disk. Manual HTTPS uses default and supported system certificate authorities without modifying any trust store. Explicitly permitted HTTP sends the token and project data unencrypted. Profile connections keep their exact certificate binding and never downgrade to HTTP. See SECURITY.md for technical boundaries.

Startup diagnostics additionally expose a random per-process identifier, process ID, startup timestamp, Node runtime version and counts/presence states of explicitly supplied inputs. These are returned by local status tools to the host and written to stderr for correlation. They contain no profile paths, connection values or access keys, are not persisted separately by this client, and are not sent to the publisher. Host log retention is controlled by the host.
