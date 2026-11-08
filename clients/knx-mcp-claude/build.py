"""KNX-MCP

Builds a reproducible client-only MCPB from explicitly allowed files.
Release approval is checked separately; the builder never publishes packages.
Copyright (c) 2026 Gerald Docenko
SPDX-License-Identifier: MIT
"""

import argparse
import hashlib
from datetime import date
import json
from pathlib import Path
import posixpath
import re
import struct
import sys
from urllib.parse import unquote, urlsplit
import zipfile

ROOT = Path(__file__).resolve().parent
LOCALES = ("en", "de", "fr", "cs", "it", "ru")
GUIDES = ("README.md",) + tuple(
    "README." + locale + ".md" for locale in LOCALES if locale != "en"
)
FILES = (
    "manifest.json",
    "release-info.json",
    "server/version.js",
    "server/diagnostics.js",
    "server/index.js",
    "server/connector.js",
    "server/tool-metadata.js",
    "server/connection-settings.js",
    "server/configuration.js",
    "server/transport.js",
    "SECURITY.md",
    "README.md",
    "README.de.md",
    "README.fr.md",
    "README.cs.md",
    "README.it.md",
    "README.ru.md",
    "release/README.md",
    "release/CHANGELOG.md",
    "SUPPORT.md",
    "TROUBLESHOOTING.md",
    "DEVELOPMENT.md",
    "LICENSE.txt",
    "assets/LICENSE.txt",
    "PRIVACY.md",
    "PRIVACY.de.md",
    "NOTICE.txt",
    "assets/icon.png",
) + tuple("locales/" + locale + ".json" for locale in LOCALES)
GATES = (
    "ets_app_released",
    "public_client_license_approved",
    "privacy_policy_approved",
    "source_boundary_checked",
    "claude_ets5_ets6_acceptance_passed",
    "signing_decision_recorded",
    "publication_approved",
)
DIRECTORY_GATES = (
    "privacy_policy_published",
    "public_client_sources_published",
    "catalog_audit_passed",
    "review_examples_passed",
    "directory_submission_approved",
)


def check(condition, message):
    if not condition:
        raise ValueError(message)


def validate_artifact_name(output, version):
    named_version = re.fullmatch(
        r"KNX-MCP-(\d+\.\d+\.\d+)(?:-sources)?\.(?:mcpb|zip)",
        output.name,
        re.IGNORECASE,
    )
    check(
        named_version is None or named_version.group(1) == version,
        "Artifact filename version differs from manifest: " + output.name,
    )


def markdown_body(text):
    """Ignore fenced examples when checking rendered links and headings."""
    lines = []
    fence = None
    for line in text.splitlines():
        marker = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            continue
        if fence is None:
            lines.append(line)
    return "\n".join(lines)


def markdown_anchors(text):
    """Resolve the ordinary Markdown headings used by the packaged guides."""
    anchors = set(re.findall(r"\bid=[\"']([^\"']+)[\"']", text))
    for title in re.findall(r"^#{1,6}\s+(.+?)\s*#*\s*$", text, re.MULTILINE):
        title = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", title)
        title = re.sub(r"<[^>]*>", "", title)
        slug = re.sub(r"[^\w\s-]", "", title.lower()).replace(" ", "-")
        candidate = slug
        suffix = 0
        while candidate in anchors:
            suffix += 1
            candidate = slug + "-" + str(suffix)
        anchors.add(candidate)
    return anchors


def validate_documentation(root, manifest, available_files):
    """Check the versioned public guides and links against an artifact's files."""
    available = set(available_files)
    required = set(GUIDES) | {"release/README.md", "release/CHANGELOG.md"}
    check(
        required.issubset(available),
        "Required documentation missing from artifact: "
        + ", ".join(sorted(required - available)),
    )
    documents = {}
    for name in sorted(n for n in available if n.endswith(".md")):
        source = root / name
        check(
            source.is_file()
            and not source.is_symlink()
            and source.resolve().is_relative_to(root.resolve()),
            "Missing documentation file or symlink: " + name,
        )
        documents[name] = source.read_text(encoding="utf-8")
    version = manifest["version"]
    for name in GUIDES + ("release/README.md",):
        text = documents[name]
        plain = text.replace("*", "").replace("`", "")
        versions = re.findall(
            r"^\s*(?:\|\s*)?(?:Client(?: version)?|Klient|Клиент)"
            r"\s*:?\s*(?:\|\s*)?(\d+\.\d+\.\d+)(?!\d|\.\d)",
            plain,
            re.MULTILINE | re.IGNORECASE,
        )
        check(
            versions == [version],
            "Client version differs from manifest in " + name,
        )
        check(
            re.search(r"\bKNX-MCP-\d+\.\d+\.\d+\.mcpb\b", text) is not None,
            "Versioned installation filename missing in " + name,
        )
    entries = re.findall(
        r"^##\s+(\d+\.\d+\.\d+)(?!\d|\.\d)",
        documents["release/CHANGELOG.md"],
        re.MULTILINE,
    )
    check(
        bool(entries) and entries[0] == version,
        "Latest release note version differs from manifest.",
    )
    bodies = {name: markdown_body(text) for name, text in documents.items()}
    anchors = {name: markdown_anchors(text) for name, text in bodies.items()}
    for name, text in documents.items():
        versions = re.findall(
            r"\bKNX-MCP-(\d+\.\d+\.\d+)(?:-sources)?\.(?:mcpb|zip)\b", text
        )
        check(
            all(value == version for value in versions),
            "Package filename version differs from manifest in " + name,
        )
        targets = re.findall(
            r"\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[\"'][^\n]*?[\"'])?\s*\)",
            bodies[name],
        )
        targets += re.findall(
            r"^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)",
            bodies[name],
            re.MULTILINE,
        )
        for target in targets:
            address = target.strip("<>")
            parsed = urlsplit(address)
            check(
                parsed.scheme.lower() != "file"
                and re.match(r"^[A-Za-z]:", address) is None,
                "Nonportable documentation link: " + name + " -> " + target,
            )
            if parsed.scheme or parsed.netloc:
                continue
            path = unquote(parsed.path)
            check(
                not path.startswith("/") and "\\" not in path,
                "Nonportable documentation link: " + name + " -> " + target,
            )
            resolved = (
                posixpath.normpath(posixpath.join(posixpath.dirname(name), path))
                if path
                else name
            )
            check(
                resolved in available
                or resolved == "."
                or any(item.startswith(resolved + "/") for item in available),
                "Broken relative documentation link: " + name + " -> " + target,
            )
            if parsed.fragment and resolved in documents:
                check(
                    unquote(parsed.fragment) in anchors[resolved],
                    "Broken documentation anchor: " + name + " -> " + target,
                )


def https_url(value):
    if not isinstance(value, str) or not value or any(c.isspace() for c in value):
        return False
    parsed = urlsplit(value)
    return (
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and not parsed.username
        and not parsed.password
        and not parsed.fragment
    )


def publication_manifest(root, manifest, directory=False, approval_file=None):
    check(
        approval_file is not None,
        "PUBLICATION_BLOCKED: external approval file required.",
    )
    approval_path = Path(approval_file).resolve()
    check(
        not approval_path.is_relative_to(root.resolve()),
        "PUBLICATION_BLOCKED: approval file must be outside the client source tree.",
    )
    check(approval_path.is_file(), "PUBLICATION_BLOCKED: approval file not found.")
    # Read private publisher evidence explicitly; never include it in either artifact.
    state = json.loads(approval_path.read_text(encoding="utf-8"))
    info = json.loads((root / "release-info.json").read_text(encoding="utf-8"))
    check(
        state["target_ets_app_version"] == info["ets_app_baseline"],
        "Release target differs from the documented ETS App baseline.",
    )
    check(
        state["client_package_version"] == manifest["version"],
        "Release metadata version differs.",
    )
    gates = GATES + (DIRECTORY_GATES if directory else ())
    missing = [
        gate
        for gate in gates
        if state.get("gates", {}).get(gate) is not True
        or not isinstance(state.get("evidence", {}).get(gate), str)
        or not state["evidence"][gate].strip()
    ]
    check(not missing, "PUBLICATION_BLOCKED: " + ", ".join(missing))
    check(
        state.get("license_identifier") == manifest.get("license") == "MIT"
        and (root / "LICENSE.txt").is_file(),
        "Approved client license required.",
    )
    check(
        state.get("signing_decision") in ("unsigned", "sign-after-build"),
        "Record whether the package is unsigned or signed after building.",
    )
    result = dict(manifest)
    # Community delivery does not depend on prior Directory acceptance.
    # Directory submission has additional public-document and review gates.
    if directory:
        policies = state.get("public_privacy_policies")
        check(
            isinstance(policies, list)
            and policies
            and all(https_url(u) for u in policies),
            "Approved HTTPS privacy policy required.",
        )
        for field in (
            "public_source_url",
            "public_documentation_url",
            "public_support_url",
        ):
            check(
                https_url(state.get(field)),
                "Approved public HTTPS address required: " + field,
            )
        result.update(
            privacy_policies=policies,
            repository={"type": "git", "url": state["public_source_url"]},
            documentation=state["public_documentation_url"],
            support=state["public_support_url"],
        )
    return result


def build(root, output, release=False, directory=False, approval_file=None):
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    check(manifest["manifest_version"] == "0.3", "Unsupported manifest version.")
    check(
        manifest["name"] == "knx-mcp-claude" and manifest["display_name"] == "KNX-MCP",
        "Stable identity and display name required.",
    )
    check(
        bool(re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"])),
        "Client version must be three-part semver.",
    )
    validate_artifact_name(output, manifest["version"])
    check(manifest["server"]["type"] == "node", "Node client required.")
    expected = (
        ["connection_files"]
        + [f"manual_{n}_{field}" for n in (1, 2) for field in ("name", "url", "token")]
        + ["allow_insecure_http"]
    )
    check(
        list(manifest["user_config"]) == expected,
        "Only profiles and two ordered manual connections are allowed.",
    )
    check(
        manifest["user_config"]["connection_files"].get("required") is False,
        "Profile selection must be optional.",
    )
    for n in (1, 2):
        for field in ("name", "url", "token"):
            value = manifest["user_config"][f"manual_{n}_{field}"]
            check(
                value.get("type") == "string"
                and value.get("default") == ""
                and not value.get("required"),
                "Manual block must be optional and empty.",
            )
        check(
            manifest["user_config"][f"manual_{n}_token"].get("sensitive") is True,
            "Manual token must be sensitive.",
        )
    check(
        manifest["user_config"]["allow_insecure_http"].get("type") == "boolean"
        and manifest["user_config"]["allow_insecure_http"].get("default") is False,
        "HTTP must require explicit consent.",
    )
    check(
        manifest["user_config"]["connection_files"]["multiple"] is True,
        "Multiple profiles required.",
    )
    check(
        manifest["server"]["mcp_config"]["args"][-1]
        == "${user_config.connection_files}",
        "Profile argument missing.",
    )
    expected_env = {
        f"KNX_MCP_MANUAL_{n}_{field.upper()}": "${user_config."
        + f"manual_{n}_{field}"
        + "}"
        for n in (1, 2)
        for field in ("name", "url", "token")
    }
    expected_env["KNX_MCP_ALLOW_HTTP"] = "${user_config.allow_insecure_http}"
    check(
        manifest["server"]["mcp_config"].get("env") == expected_env,
        "Only explicit manual configuration may be passed through the environment.",
    )
    check(
        manifest["server"]["mcp_config"]["args"]
        == ["${__dirname}/server/index.js", "${user_config.connection_files}"],
        "No secrets in command arguments.",
    )
    check(manifest["icon"] == "assets/icon.png", "Packaged icon required.")
    check(
        "## Privacy Policy" in (root / "README.md").read_text(encoding="utf-8"),
        "README Privacy Policy section required.",
    )
    for locale in LOCALES:
        resource = json.loads(
            (root / "locales" / (locale + ".json")).read_text(encoding="utf-8")
        )
        check(
            resource["display_name"] == "KNX-MCP", "Localized name differs: " + locale
        )
        check(
            set(resource["user_config"]) == set(manifest["user_config"]),
            "Localized configuration differs: " + locale,
        )
    icon = (root / "assets/icon.png").read_bytes()
    check(
        icon[:8] == b"\x89PNG\r\n\x1a\n" and icon[12:16] == b"IHDR",
        "PNG icon required.",
    )
    check(
        struct.unpack(">II", icon[16:24]) == (256, 256) and icon[25] == 6,
        "256x256 RGBA icon required.",
    )
    info = json.loads((root / "release-info.json").read_text(encoding="utf-8"))
    date.fromisoformat(info["prepared_on"])
    check(
        bool(re.fullmatch(r"\d+\.\d+\.\d+\.\d+", info["ets_app_baseline"])),
        "Four-part ETS App baseline required.",
    )
    check(manifest["license"] == "MIT", "Explicit client license required.")
    validate_documentation(root, manifest, FILES)
    if release or directory:
        manifest = publication_manifest(root, manifest, directory, approval_file)
    payload = {}
    for name in FILES:
        file = root / name
        check(
            file.is_file()
            and not file.is_symlink()
            and file.resolve().is_relative_to(root.resolve()),
            "Missing file or symlink: " + name,
        )
        raw = file.read_bytes()
        if name == "manifest.json":
            raw = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode(
                "utf-8"
            )
        elif not name.endswith(".png"):
            raw = raw.replace(b"\r\n", b"\n")
        check(
            len(raw) <= (1048576 if name.endswith(".png") else 131072),
            "Package entry exceeds its bound: " + name,
        )
        payload[name] = raw
    # Hash normalized allowlisted inputs; do not include this generated record itself.
    fingerprint = hashlib.sha256()
    for name in sorted(payload):
        fingerprint.update(
            name.encode("utf-8") + b"\0" + hashlib.sha256(payload[name]).digest()
        )
    build_info = {
        "product": manifest["display_name"],
        "client": manifest["name"],
        "version": manifest["version"],
        "publisher": manifest["author"]["name"],
        "prepared_on": info["prepared_on"],
        "ets_app_baseline": info["ets_app_baseline"],
        "source_sha256": fingerprint.hexdigest(),
    }
    payload["build-info.json"] = (json.dumps(build_info, indent=2) + "\n").encode(
        "utf-8"
    )
    # Validate inputs before opening the output. Fixed timestamps avoid clock-dependent builds.
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as package:
        for name in sorted(payload):
            entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            package.writestr(entry, payload[name])
    with zipfile.ZipFile(output) as package:
        check(
            set(package.namelist()) == set(FILES) | {"build-info.json"},
            "Package boundary mismatch.",
        )
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(
        digest + "  " + output.name + "\n", encoding="utf-8"
    )
    return digest, len(payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path)
    parser.add_argument(
        "--release",
        action="store_true",
        help="Require Community approval; does not upload.",
    )
    parser.add_argument(
        "--directory",
        action="store_true",
        help="Require Directory review/public-document evidence.",
    )
    parser.add_argument(
        "--approval-file",
        type=Path,
        help="External publisher approval JSON for --release/--directory; never bundled.",
    )
    args = parser.parse_args()
    if args.approval_file is not None and not (args.release or args.directory):
        parser.error("--approval-file requires --release or --directory")
    try:
        version = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))[
            "version"
        ]
        output = args.output or ROOT / ("KNX-MCP-" + version + ".mcpb")
        digest, count = build(
            ROOT, output, args.release, args.directory, args.approval_file
        )
        print("PACKAGE_FILES=" + str(count))
        print("SHA256=" + digest)
        print("PACKAGE=" + str(output))
    except (ValueError, KeyError, OSError, zipfile.BadZipFile) as error:
        print("Build refused: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
