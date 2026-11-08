# KNX-MCP — implementation boundaries

The adapter transports MCP requests between Claude and explicitly configured ETS endpoints. It does not contain ETS SDK code, device logic, a shell-command tool, telemetry or a runtime package downloader. The readable JavaScript sources are included in the MCPB. These boundaries and tests are review aids, not a security certification.

## Configuration and secrets

Prefer private `knx-mcp-claude/v1` profiles exported by the addon. Up to 32 profiles are supported, plus exactly two optional manual test connections. Each manual block contains **Name**, **Remote / Local URL**, **Bearer token**, in that order. A block is either empty or complete. Duplicate endpoints/IDs, including file/manual overlaps, are rejected rather than given precedence. Names appear in tool titles; they are not authorization identities.

Profiles contain a plaintext access key and public certificate. Keep them in a private folder. Manual tokens use the host's `sensitive` configuration fields and reach the process only through declared environment entries, not command arguments. They are never used as a fallback for incomplete profile files. The adapter does not write token values to its own identity records or diagnostic output. Process memory is not an encrypted secrets store.

## Transport and trust

- **Profile HTTPS:** exact public-certificate binding, certificate dates and hostname checks. System trust is not added to this connection.
- **Manual HTTPS:** Node default authorities plus the supported system certificate authorities, scoped to that connection. `rejectUnauthorized` remains true and the minimum TLS version is 1.2. The adapter reads but never changes Windows trust. Imported certificates must be in a supported trusted store for the account running Claude. Restart the extension after a trust change.
- **Manual HTTP:** accepted only with explicit HTTP consent, including loopback. Tokens and project data are unencrypted. Use solely for intentional local/protected tests. Profile files remain HTTPS-only.

Profile endpoints must resolve to an HTTPS URL with the exact `/mcp` path. Manual URL inputs require an explicit HTTP/HTTPS scheme; a missing path is normalized to `/mcp`. Both modes reject user information, query strings and fragments. Manual inputs also reject whitespace and backslashes before URL parsing.

HTTP redirects are refused. No failed HTTPS connection can fall back to HTTP or another endpoint. Standard transport code has no certificate-validation bypass and does not install root certificates.

## Routing and recovery

Each endpoint owns its token, transport, MCP session and request queue. The configured name appears in the tool title; the endpoint-derived ID disambiguates equal names. Tool schemas and permissions remain those of the current ETS server. One unavailable target cannot redirect work to another site.

A recognized pre-dispatch session 404 triggers at most one reinitialization. Only an explicitly classified read can be repeated automatically. A modifying call is withheld until the client receives the recovery notice and performs fresh explicit project discovery/reading before deliberately repeating the change. Queued older calls cannot clear this barrier. A lost write response remains an uncertain outcome and is never automatically replayed. This is not persistent deduplication or an exactly-once guarantee.

## Resource and output limits

The stdio boundary accepts at most 32 concurrent request IDs. Requests and responses are bounded to 16 MiB; catalogs, pages and request durations also have fixed limits. Protocol messages alone use stdout. Diagnostic failures use fixed codes on stderr, not arbitrary exception text. These controls do not bound the memory or execution time of the remote ETS SDK itself.

## Source map and tests

`connection-settings.js` validates input and stores public profile identities. `transport.js` keeps HTTP, system-trusted HTTPS and pinned HTTPS separate. `connector.js` handles catalogs, routing and recovery. `index.js` implements bounded stdio framing. `tool-metadata.js` applies conservative effect annotations.

The automated tests use local mock servers and generated certificates. The native Windows trust test is opt-in (`KNX_MCP_TEST_WINDOWS_TRUST=true`), intended for an isolated runner: it installs only its generated test leaf in LocalMachine/Root, tests fresh processes, then removes that exact leaf. It is not part of the shipped runtime. Automated tests do not replace testing the actual host, ETS version and intended installation.

## Independent startup

Local MCP control stays responsive with no valid inputs. Each selected file and manual block is validated separately; invalid entries are not used for network access. Ambiguous endpoint/ID groups are disabled as a whole. Invalid old profile formats still require explicit re-export, rather than relaxed certificate/key validation. Public identity records retain their existing verification rules.

Discovery probes receive JSON-RPC method-not-found; this does not claim support for a new protocol generation. Upstream requests start only after the host initialized notification. Ready catalogs are published independently through the client-facing stdio list-change notification; the ETS server's transport/capabilities are unchanged. Setup is bounded across its phases and aborts its own sockets. Tool calls retain their existing cancellation/recovery/write barriers and are never automatically replayed after uncertain network outcomes.

Diagnostic callbacks receive only fixed event/phase/error codes, duration, counts and a non-secret abbreviated route ID. No raw errors, headers, request bodies, access keys or filesystem paths are logged. The logger does not write its own persistent file.

## Diagnostic state boundaries

Transport health and per-call errors are separate. A JSON-RPC parameter error or
MCP application error does not by itself invalidate the session. A transport
failure marks the target offline; later explicit calls use the existing recovery
checks. No uncertain modifying call is replayed automatically. Status copies only
bounded server name/title/version, never arbitrary metadata fields. Technical
guidance is fixed text, not arbitrary exception messages.
