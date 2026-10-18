# KNX-MCP 1.2.0.0 — Community issue triage and release plan

**Planning snapshot:** 15 October 2026  
**Last triage update:** 15 October 2026 — milestone verified and first development-build fixes recorded  
**Repository:** [knx-mcp/knx-mcp-community](https://github.com/knx-mcp/knx-mcp-community)  
**Product:** KNX-MCP, ETS App for ETS5 and ETS6  
**Current verified public app release:** 1.1.0.0 (Release 1)  
**Proposed next app release:** 1.2.0.0 — **not yet published**  
**Milestone:** [`KNX-MCP 1.2.0.0`](https://github.com/knx-mcp/knx-mcp-community/milestone/1) — active; 14 open planned issues (#5–#17 and #19)

> **Release commitment:** All items listed below are candidates for 1.2.0.0. An issue is only confirmed as delivered after the implementation and test evidence are recorded and the corresponding app version is actually published in MyKNX. Do not describe a bug as fixed merely because an issue was acknowledged or documentation changed.

## Purpose and principles

The public community repository provides a transparent intake, triage and release-history record. KNX-MCP's proprietary application source and ETS App binaries are **not** distributed here. Keep customer/project data, credentials, access keys and KNX Secure secrets out of Issues and Discussions.

We aim to respond visibly and consistently to user feedback while separating:
- **Observed behaviour** in KNX-MCP 1.1.0.0, as reported by users.
- **Suspected defects** needing reproduction and root-cause analysis.
- **New functionality** proposed for a future release.
- **Validated fixes** that can be demonstrated and included in a MyKNX release.

The original user reports are retained. Related issues isolate independent tasks without rewriting or closing the author's report. They are **cross-linked issues, not native GitHub Sub-issues**; maintainers may organise them as native Sub-issues later in the GitHub interface if desired.

## Label policy

Apply one principal type label per issue:

| Label | Meaning |
|---|---|
| `bug` | Reported deviation from expected/current functionality; investigate before calling it confirmed |
| `enhancement` | New capability, optional result field, batching or performance/UX improvement |
| `documentation` | Clarification or correction of tool descriptions, setup instructions or documented behaviour |

Suggested additional labels (create in GitHub Settings / Labels before applying):

| Dimension | Labels | When to apply |
|---|---|---|
| Area | `area:group-addresses`, `area:devices`, `area:server` | Main product area affected |
| Priority | `priority:high`, `priority:normal` | Triage order; not a promise of delivery |
| State | `status:accepted`, `status:in-progress`, `status:ready-for-test` | Accepted scope, active implementation, test candidate |

Avoid a `v1.2.0.0` label; use a GitHub **Milestone** for target app versions. Do not use `fixed` or close issues before the corresponding official release unless the issue has been independently resolved or is explicitly out of scope.

## Issue register — original reports and related tasks

The issues were reported for KNX-MCP 1.1.0.0, mainly using ETS6.3 and Claude Desktop. Priorities are **proposed**; issue labels `bug`, `enhancement` and `documentation` below reflect triage, not confirmed defect status.

| Issue | Main track / proposed priority | Scope and acceptance evidence |
|---|---|---|
| [#5](https://github.com/knx-mcp/knx-mcp-community/issues/5) | Bug · High | Verify that an address/range filter really restricts `ga_get_list` results. Test single address, middle group, missing address and post-edit results. |
| [#6](https://github.com/knx-mcp/knx-mcp-community/issues/6) | Enhancement · Normal | Return actual `new_address` from `ga_move`; verify same-group and cross-group moves and backward-compatible response fields. |
| [#7](https://github.com/knx-mcp/knx-mcp-community/issues/7) | Documentation · Normal | Clarify documented same-middle-group move semantics and collision behaviour from tested ETS results. New batch features are in #16. |
| [#8](https://github.com/knx-mcp/knx-mcp-community/issues/8) | Bug · High | Replace `Unknown error` for incompatible object/address sizes with an actionable, non-misleading validation message; include supported DPT information only where reliably available. |
| [#9](https://github.com/knx-mcp/knx-mcp-community/issues/9) | Enhancement · Normal | Return internal parameter name and references where available through the ETS SDK; distinguish absent values from unsupported metadata and test variant application versions. |
| [#10](https://github.com/knx-mcp/knx-mcp-community/issues/10) | Enhancement · Normal | Explore batch links of {object, group_address} pairs with clear per-item results, permissions, validation, and documented undo/partial-failure behaviour. |
| [#11](https://github.com/knx-mcp/knx-mcp-community/issues/11) | Bug · High | Ensure `ga_find` role hints respect datapoint types and the linked object's actual role; a DPT 9.001 measurement must not be advised as DPT 1.001 Switch without evidence. |
| [#12](https://github.com/knx-mcp/knx-mcp-community/issues/12) | Bug · High · Ready for test | Development build 1.1.0.1 adds validation against ETS's 255-character group-address name limit and clarifies project/address/range name limits. ETS6 checks reported for 255, 256 and 300 characters; complete release validation is outstanding. |
| [#13](https://github.com/knx-mcp/knx-mcp-community/issues/13) | Enhancement · Normal | Summarise repeated device-download-required warnings and affected devices in long operations while retaining actionable detail. Feedback discoverability is in #17. |
| [#14](https://github.com/knx-mcp/knx-mcp-community/issues/14) | Bug · High | Check stale or missing `ga_get_list` entries after `ga_move`; compare with `ga_find` and inspect multi-project isolation. Related to #5. |
| [#15](https://github.com/knx-mcp/knx-mcp-community/issues/15) | Enhancement · Normal | Add bounded paging and compact/field-selectable results for large group-address lists, with stable ordering and clear continuation. Related to #5. |
| [#16](https://github.com/knx-mcp/knx-mcp-community/issues/16) | Enhancement · Normal | Evaluate batch renumber / shift or swap options, explicit conflict handling, dry-run/preflight, affected devices, permissions and undo semantics. Related to #7. |
| [#17](https://github.com/knx-mcp/knx-mcp-community/issues/17) | Enhancement · Normal | Make bug/feature/support reporting discoverable from MCP clients. Prefer an explicit user-confirmed route that does not transmit data itself. Related to #13. |
| [#19](https://github.com/knx-mcp/knx-mcp-community/issues/19) | Bug · High · Ready for test | ETS6 `ga_delete` failed with `MARKER_FAILED`; development build 1.1.0.1 deletes through the address's own group range. Five individual deletions and undo were verified in ETS6; ETS5 and related delete-path regression tests remain. |

### Split history and ownership

| Original | Related independently trackable issues | Remaining focus of original |
|---|---|---|
| #5 | [#14](https://github.com/knx-mcp/knx-mcp-community/issues/14) (freshness), [#15](https://github.com/knx-mcp/knx-mcp-community/issues/15) (paging/compact) | Filter correctness and complete user report |
| #7 | [#16](https://github.com/knx-mcp/knx-mcp-community/issues/16) (batch renumber) | Existing `ga_move` description and occupied-target semantics |
| #13 | [#17](https://github.com/knx-mcp/knx-mcp-community/issues/17) (feedback route) | Summarised device-download warnings and positive workflow observations |

Keep all original and related issues **open** through investigation. Cross-reference rather than duplicate the same implementation work.

## Proposed delivery order

### A. Correctness and diagnostic quality (first)

- **#5 + #14** — filtering and post-write consistency of `ga_get_list`.
- **#11** — erroneous `ga_find` role guidance.
- **#12** — address-name limit/validation and response clarity.
- **#8** — actionable diagnostics on object/DPT-size mismatch.
- **#19** — validate the corrected ETS6 group-address delete path and follow-up delete regression cases.

These affect confidence in AI-assisted inspection or edits and should be reproduced first.

### B. Response usability and documentation

- **#6** — return the resulting address directly.
- **#7** — clarify `ga_move` same-group semantics and collision response.
- **#13** — consolidated device-download warnings.
- **#9** — parameter identity metadata, where supported.
- **#15** — large-list pagination and compact results.

### C. Larger enhancements, gated by feasibility

- **#10** — batch object/address linking.
- **#16** — batch address renumbering and conflict policy.
- **#17** — discoverable support/feedback route.

The order is a working proposal, not a restriction on parallel implementation. Tasks whose scope cannot be safely validated for 1.2.0.0 stay open and move to a later milestone with a clear reason.

## Development progress — not yet a MyKNX release

The following status is based on [public issue #12 comments](https://github.com/knx-mcp/knx-mcp-community/issues/12) and [public issue #19 comments](https://github.com/knx-mcp/knx-mcp-community/issues/19). These are maintainer-reported development tests, **not** independent validation of release 1.2.0.0.

- **#12:** In development build `1.1.0.1`, `ga_create`, `ga_update` (including `names`) and `ga_create_range` validate the length before changing project data; `project_get_info` exposes additional explicit name-length fields, keeping its legacy field for compatibility. ETS6 boundary tests at 255, 256 and 300 characters are reported as successful.
- **#19:** In development build `1.1.0.1`, `ga_delete` uses the group address's owning range instead of a read-only collection. ETS6 testing reports five single-address deletions with undo and subsequent re-deletion. ETS5 and deletion of ranges, trades and building parts still need regression checks.
- Both issues are still **open** with `status:ready-for-test` and `area:group-addresses`, correctly indicating test candidates. They are not shipped fixes.

## Acceptance, validation and status transitions

1. **Incoming / triage:** Preserve the original report, verify that its content is safe for public display, and classify `bug` / `enhancement` / `documentation`. Ask for minimal additional diagnostics only when necessary.
2. **Accepted for investigation:** Add `status:accepted` only after acknowledging the proposed scope. Attach the Milestone `KNX-MCP 1.2.0.0` after it is created.
3. **In development:** Use `status:in-progress` only when actual implementation is underway. Keep proprietary source references and customer data out of public issues.
4. **Ready for verification:** Use `status:ready-for-test` only after a concrete candidate build exists. Record reproduction and success/failure cases and any API compatibility differences.
5. **Release confirmation:** Confirm the actual KNX-MCP version published in MyKNX. Link to its release notes, record the verified resolution and close fixed issues. Defer incomplete work explicitly.

Recommended test matrix: ETS6.3 (including the reported Build 7959 where relevant), supported ETS5, tool-specific permissions, project-wide read-only, confirmation flow, single/multiple open projects, undo behaviour for project changes, meaningful error reporting, large response handling and backwards compatibility. Test bus/device effects separately where applicable, with suitable safe environments and user authorisation.

**Version and test evidence are required.** A public acknowledgement or `status:accepted` label must never be interpreted as a validated KNX-MCP binary fix.

## Professional community response

- Acknowledge concrete feedback, keep replies short and technical, and link any related work items.
- Explain what is reproduced, what is proposed, and what remains unverified.
- Reference **1.2.0.0 as the planned target**, not as an already available fix.
- Do not post customer examples, project files, protected keys or secret-bearing logs.
- Update the relevant issue when a verified test candidate is available, when scope changes, and after MyKNX release. Avoid repeated generic status comments.
- Credit contributors through issue links and public release notes where appropriate and with accurate attribution.
- For private security vulnerabilities, direct reporters to [SECURITY.md](../../SECURITY.md) rather than public Issues.

Example concise status comment (tailor to the actual work):
> Thanks for the precise reproduction details. This is being tracked for the planned KNX-MCP 1.2.0.0 scope. We will verify the ETS behaviour and document the outcome here; no change is considered released until the updated app is available in MyKNX.

## Milestone and labels — active

The maintainer has created [Milestone **KNX-MCP 1.2.0.0**](https://github.com/knx-mcp/knx-mcp-community/milestone/1). As of the 15 October 2026 triage check, all **14 open issues** (#5–#17 and #19) are assigned. No completion is implied by milestone assignment.

The labels `status:ready-for-test` and `area:group-addresses` are applied to #12 and #19. Other area/priority/status labels can be added as triage progresses; do not create a version label when a milestone already identifies the proposed release. Keep the milestone open until the actual MyKNX release and verification outcome are recorded.

## Release procedure

1. Implement and verify against the KNX-MCP application release branch and supported ETS versions (application code is not stored in this public repository).
2. Record confirmed behaviour and compatibility in `docs/release-notes/1.2.0.0.md` **only after those changes are verified**. Update the README, the [version history](../releases.md) and relevant public website content.
3. Publish and validate the **actual ETS App through MyKNX**. The official shop [search URL](https://my.knx.org/shop?action=search&search=KNX-MCP) is the public distribution route, not a GitHub binary download.
4. After MyKNX publication, create a GitHub Release using a descriptive tag such as `app-v1.2.0.0`. GitHub-generated source archives contain **community documentation and examples, not KNX-MCP ETS App binaries**.
5. Close each verified fixed issue with the release-version reference. Keep unfinished or unreproduced issues open for a subsequent release. Finish or update the Milestone on verified delivery, not on the documentation merge date.

## Public and internal sources

- [Issue tracker](https://github.com/knx-mcp/knx-mcp-community/issues) (original reports #5–#13, split follow-ups #14–#17, new independently reported bug #19).
- [Release 1 notes](../release-notes/1.1.0.0.md).
- [KNX-MCP release index](../releases.md).
- [Community support policy](../../SUPPORT.md).
- [Security reporting](../../SECURITY.md).

**Source of truth for 1.2.0.0 completion:** the actually validated MyKNX app release and its documented test/release evidence. This file describes planning, intake and verification discipline; it does not claim that any application issue has already been fixed.
