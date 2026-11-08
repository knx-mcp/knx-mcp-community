"""KNX-MCP

Exports only explicitly reviewed independent client source files.
Copyright (c) 2026 Gerald Docenko
SPDX-License-Identifier: MIT
"""

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path, PurePosixPath
import zipfile

ROOT = Path(__file__).resolve().parent
_SPEC = importlib.util.spec_from_file_location("client_package_checks", ROOT / "build.py")
package_checks = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(package_checks)


def export_source(root, output):
    names = json.loads((root / "source-files.json").read_text(encoding="utf-8"))
    if (
        not isinstance(names, list)
        or not names
        or not all(isinstance(n, str) for n in names)
    ):
        raise ValueError("Invalid source allowlist entries")
    if len(names) != len({name.casefold() for name in names}):
        raise ValueError("Invalid or duplicate source allowlist entries")
    required = set(package_checks.FILES) | {"build.py", "export.py", "source-files.json"}
    missing = required - set(names)
    if missing:
        raise ValueError("Missing required source export files: " + ", ".join(sorted(missing)))
    payload = {}
    for name in names:
        relative = PurePosixPath(name)
        if (
            name.casefold() in (
                "release/readiness.json",
                "release/listing.en.md",
                "release/review-examples.md",
                "release/logo-provenance.json",
            )
            or relative.as_posix() != name
            or relative.is_absolute()
            or ".." in relative.parts
            or "\\" in name
            or ":" in name
            or any(ord(c) < 32 for c in name)
            or any(
                part.casefold()
                in (".git", "src", "node_modules", "__pycache__", "internal", "private")
                for part in relative.parts
            )
            or relative.suffix.lower()
            in (".dll", ".exe", ".snk", ".pfx", ".p12", ".etsapp", ".log", ".mcpb")
            or relative.name.casefold().startswith(("knx-mcp-", "publisher-approval"))
        ):
            raise ValueError("Forbidden source export path: " + name)
        source = root / relative
        if (
            not source.is_file()
            or source.is_symlink()
            or any(
                parent.is_symlink()
                for parent in source.parents
                if parent != root.parent
            )
            or not source.resolve().is_relative_to(root.resolve())
        ):
            raise ValueError("Missing file, symlink or escaping path: " + name)
        raw = source.read_bytes()
        if len(raw) > 1024 * 1024:
            raise ValueError("Source file exceeds size limit: " + name)
        if not name.endswith(".png"):
            raw.decode("utf-8")
            raw = raw.replace(b"\r\n", b"\n")
        payload[name] = raw
    manifest = json.loads(payload["manifest.json"])
    package_checks.validate_artifact_name(output, manifest["version"])
    package_checks.validate_documentation(root, manifest, names)
    # The handoff manifest is auditable without exposing private Git history.
    checksums = "".join(
        hashlib.sha256(payload[n]).hexdigest() + "  " + n + "\n"
        for n in sorted(payload)
    )
    payload["SOURCE-SHA256SUMS.txt"] = checksums.encode("utf-8")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, raw in sorted(payload.items()):
            entry = zipfile.ZipInfo("knx-mcp-claude/" + name, (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, raw)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(output.suffix + ".sha256").write_text(
        digest + "  " + output.name + "\n", encoding="utf-8"
    )
    return digest, len(payload)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        digest, count = export_source(ROOT, args.output)
        print(f"SOURCE_FILES={count}\nSHA256={digest}\nSOURCE={args.output}")
    except (OSError, ValueError, TypeError) as error:
        parser.exit(1, "Source export refused: " + str(error) + "\n")


if __name__ == "__main__":
    main()
