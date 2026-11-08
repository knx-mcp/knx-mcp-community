# Troubleshooting

Start with `knx_connections`: client/server versions, state, `transport_error`,
`last_call_error` and fixed guidance. Status is not continuous monitoring.

| Code or symptom | Action |
|---|---|
| No connections configured | Inspect `runtime.configuration_input`. Saved host settings may differ from the responding process; see the handoff section below. |
| PROFILE_FILE_UNREADABLE | Check that the file exists and the Claude account can read it. Never attach it to support. |
| PROFILE_REEXPORT_FROM_ETS / PROFILE_FORMAT_UNSUPPORTED | Export from the current App; do not edit only the format marker. |
| PROFILE_IDENTITY_CHANGED_SELECT_NEW_FILE | Verify the new address/certificate in ETS, export under a new filename, replace selection. |
| DUPLICATE_ENDPOINT / DUPLICATE_PROFILE_ID | Remove duplicate entries. Ambiguous entries are all disabled. |
| Incomplete manual connection | Complete Name, URL, token together, or clear all three. |
| HTTP_REQUIRES_EXPLICIT_CONSENT | Prefer HTTPS or deliberately allow unencrypted tests. |
| ECONNREFUSED | Start project MCP and check host, port and firewall. |
| ENOTFOUND / EHOSTUNREACH | Check DNS, route and VPN. |
| HTTP_401 / HTTP_403 | Check current key and access rules; export again after key changes. |
| Certificate trust/name/validity failure | Use a current profile, or verify Windows trust, URL coverage and clocks. Never bypass validation. |
| CONNECTION_SETUP_TIMEOUT | Refresh this target after ETS is ready; other targets remain independent. |
| RPC_-32602 | Correct parameters against the current schema. Not an offline connection by itself. |
| TOOL_ERROR | Read the original ETS error/warnings. A transport retry is not required solely for this result. |
| Timeout or disconnect during a change | Outcome may be uncertain. Read current state before any deliberate repeat. |
| PROJECT_RECHECK_REQUIRED | List current projects, read affected objects with an explicit project key, then consciously repeat. |
| Only helper tools | Inspect status, refresh the target and verify the host reloads after list_changed. Desktop support does not prove Cowork/Code support. |

Restart after changing profiles, settings or trust. Provide redacted error codes
and versions to support, never keys, profiles, private certificates or customer logs.

## Tools visible in settings, but chat reports no connections

The extension settings dialog and a chat may use different or previously started processes. `NO_CONNECTIONS_CONFIGURED` means the responding process received no profile paths or manual connection values; it does not prove that the saved selection is empty. A file-access error has a different code.

Call `knx_connections` in the affected chat and compare `runtime.instance_id`, `process_id`, `started_at`, and `configuration_input` with the `local_ready` and `local_request` entries in the host's logs. The snapshot includes only counts and fixed presence states. It never includes selected paths, endpoint URLs, tokens, certificates or profile contents.

`knx_refresh_connections` retries the endpoints already loaded by this process. It does not reread the host's saved extension settings or reconstruct omitted inputs. Save settings, fully quit the host and start it again to apply a changed launch configuration. If the problem remains, provide the runtime snapshot and the relevant host version/log excerpt, not your private profiles. Do not reinstall repeatedly or change ETS certificates merely for this error.

The client does not silently search host settings, reuse credentials from another process or restore old profile selections. Removing a configured target must not be undone by an implicit fallback. The launch diagnostics do not determine which host subsystem created a process.

## Connections are ready, but the chat only has two helper tools

`knx_connections` reads live local status. It does not prove that the host has refreshed its tool inventory. Compare `local_catalog_returned` and `local_tools_changed` for the same `instance_id` as the chat call. For two targets offering 99 tools each, a complete local list has 200 tools including the two helpers.

The first list response waits at most one shared second for currently running catalog discovery; `initialize`, ping and the local status tools remain responsive. Discovery finishes independently for each target. The response returns sooner when all attempts complete. Later list requests use the current catalog immediately; list-change notifications remain enabled.

A host that ignores later notifications cannot discover an endpoint that became ready after this initial window without asking for a new list. In that case, fully reconnect the extension/host after the endpoint is ready. Refresh retries loaded ETS targets, but cannot force a host to replace a cached tool inventory. Do not recreate profiles or change certificate trust for this symptom. No tool execution bypass is provided.

## Readable connection and tool names

The client uses readable routed names such as `Office-ETS6__ga_create_range`. Unique short connection names and ordinary tool names no longer receive routine hash suffixes. The full configured connection name is also retained in both `title` and `annotations.title`. A host may still format separators and capitalization itself.

Namespaces are reserved across all configured endpoints, not only ready catalogs. Duplicate or normalized-equivalent connection names, long names, and tool names requiring conversion retain bounded disambiguation. Unresolved collisions are rejected, never routed to a different target. Connection IDs in status and diagnostics remain technical identifiers, not display labels or permissions.

After installation or updates, fully quit and restart Claude and start a new chat. Existing chat history may contain old names; the client does not reinterpret a stale alias or replay a modifying operation. Profiles, credentials, certificates, upstream tool names and schemas are unchanged. A client update alone does not require an ETS rebuild or a new valid v1 profile.

## FSI / LRI / PDI in the configuration confirmation dialog

These labels refer to Unicode directional-isolate controls. The packaged manifest and six locale files contain no U+2066 through U+2069 characters. The host constructs the configuration form and save-confirmation dialog; the stdio extension does not own that window. The manifest exposes configuration metadata, not a supported callback for replacing the confirmation renderer.

This is not a confirmed extension-side fix for the dialog. Do not strip or rewrite actual profile paths, remove localized text, disable multiple-file selection, or alter credentials to hide a rendering symptom. The existing `runtime.configuration_input.directional_profile_arguments` count can distinguish controls arriving in launch arguments from a display-only report, without exposing private paths. A nonzero count would require separate investigation. A host report should use a synthetic path and redacted screenshot, not a real private profile or access key.
