# Development

KNX-MCP — Gerald Docenko. Source comments and technical codes are English.
Comments explain lifecycle and trust boundaries, not development history.

| Module | Responsibility |
|---|---|
| index.js | Bounded stdio framing, cancellation and lifecycle |
| configuration.js | Independent input validation |
| connection-settings.js | Profiles/manual inputs and public identity markers |
| transport.js | HTTP, system-trusted HTTPS, pinned-profile HTTPS |
| connector.js | Exact routes, catalogs, per-target queues and recovery barriers |
| diagnostics.js | Fixed safe hints and bounded server metadata |
| tool-metadata.js | Connection-specific tool titles and conservative effect annotations |
| version.js | Shared version/publisher/date metadata |

`manifest.json` owns version/publisher; `release-info.json` owns the build-reference date
and App baseline. Date is not a fabricated original file-creation date. Edit history
belongs in Git. Owned code has a KNX-MCP purpose header, copyright and SPDX marker.

## Verify

Inside this directory, Node >=22.16 and Python >=3.11:

```text
node --test tests/*.test.js
python tests/package_test.py
python tests/source_export_test.py
npx --yes prettier@3.6.2 --check "server/*.js" "tests/*.js"
python build.py ../dist/KNX-MCP-1.0.4.mcpb
npx --yes @anthropic-ai/mcpb@2.1.2 validate manifest.json
python export.py ../dist/KNX-MCP-1.0.4-sources.zip
```

Formatters/validator are build tools only, never runtime downloads. Tests use
synthetic loopback targets. The Windows trust test needs an isolated runner and
`KNX_MCP_TEST_WINDOWS_TRUST=true`; it installs/removes its generated certificate.
Do not run that test against a customer certificate store.

The build and source export both check the displayed client version in all six
guides and the release documentation against `manifest.json`. Versioned package
filenames must match it. Relative documentation links must resolve inside the
artifact, including linked headings. These checks run before an output is created.

The source-export tests also build a package from the exported folder alone and
compare it with a direct build. This checks the same standalone layout that is
copied into the Community repository.

## Package boundaries

The MCPB uses an explicit FILES list plus generated `build-info.json`, fixed ZIP
timestamps and normalized text. Metadata includes version, publisher, date, App
baseline and a SHA256 fingerprint of packaged inputs, excluding itself. A sidecar
checksums the complete package. Identical inputs/tooling produce identical output.

`export.py` uses a separate allowlist for client sources, standalone tests, build
scripts and documentation. All files needed for a standalone package build must
be present. Paths under `internal/` or `private/` are rejected, including nested
paths and case variants. No parent repository, Git history, ETS/Core/SDK,
credentials, profiles or customer logs are copied. The export contains a single
`knx-mcp-claude` folder suitable for the Community `clients` directory.

Keep generated packages, checksum files, caches and private publisher records
outside the source folder when preparing a direct folder copy. The tracked source
folder is self-contained; it does not need files from a parent repository.

## Publisher builds

The standard build is reproducible and unsigned. It performs structural and
package-boundary checks and does not publish or install anything. The six README
files are included in both the MCPB and the source export. Keep their sections and
operational guidance aligned with the six setup locales.

For a publisher-controlled build, `--release --approval-file <external-file>`
validates version-matched approval evidence. `--directory` adds the existing
public-policy, source and review checks. Approval records must be outside this
source directory and are never bundled or exported. Missing records cause these
modes to fail before creating an output file. See `python build.py --help`.

Public release information is in [release/README.md](release/README.md) and
[release/CHANGELOG.md](release/CHANGELOG.md). These documents describe the product;
they do not contain publisher approval records or internal test histories.
