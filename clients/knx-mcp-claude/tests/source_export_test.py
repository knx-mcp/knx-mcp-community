"""KNX-MCP

Tests the independent client-source boundary without private application files.
Copyright (c) 2026 Gerald Docenko
SPDX-License-Identifier: MIT
"""

import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("source_export", ROOT / "export.py")
export = importlib.util.module_from_spec(spec)
spec.loader.exec_module(export)


class SourceExportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "client"
        shutil.copytree(ROOT, self.root)
        self.output = Path(self.tmp.name) / "sources.zip"

    def test_explicit_boundary_and_reproducibility(self):
        marker = "synthetic-" + uuid.uuid4().hex
        (self.root / "KNX-MCP-private.json").write_text(marker)
        (self.root / "private.snk").write_text(marker)
        a, count = export.export_source(self.root, self.output)
        b, _ = export.export_source(self.root, self.output)
        self.assertEqual(a, b)
        expected = json.loads((self.root / "source-files.json").read_text())
        with zipfile.ZipFile(self.output) as z:
            self.assertEqual(count, len(expected) + 1)
            self.assertEqual(
                set(z.namelist()),
                {"knx-mcp-claude/" + n for n in expected + ["SOURCE-SHA256SUMS.txt"]},
            )
            self.assertFalse(any(marker.encode() in z.read(n) for n in z.namelist()))

    def test_forbidden_source_paths_fail_before_output(self):
        names = json.loads((self.root / "source-files.json").read_text(encoding="utf-8"))
        for path in [
            "../secret",
            "/secret",
            "src/private.cs",
            ".git/config",
            "private.snk",
            "KNX-MCP-personal.json",
            "C:/secret",
            "file:stream",
            "release/readiness.json",
            "release/LISTING.en.md",
            "release/REVIEW-EXAMPLES.md",
            "release/logo-provenance.json",
            "internal/release.json",
            "docs/private/approval.json",
            "archive/INTERNAL/review.md",
            "publisher-approval.json",
            "server/./index.js",
        ]:
            (self.root / "source-files.json").write_text(json.dumps(names + [path]))
            with self.assertRaisesRegex(ValueError, "Forbidden source export path"):
                export.export_source(self.root, self.output)
            self.assertFalse(self.output.exists())

    def test_missing_source_file_is_not_silently_omitted(self):
        (self.root / "server/index.js").unlink()
        with self.assertRaisesRegex(ValueError, "Missing file"):
            export.export_source(self.root, self.output)

    def test_duplicates_are_rejected(self):
        (self.root / "source-files.json").write_text('["README.md", "README.md"]')
        with self.assertRaisesRegex(ValueError, "duplicate"):
            export.export_source(self.root, self.output)

    def test_case_collisions_are_rejected(self):
        path = self.root / "source-files.json"
        names = json.loads(path.read_text(encoding="utf-8"))
        path.write_text(json.dumps(names + ["README.MD"]), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "duplicate"):
            export.export_source(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_build_inputs_cannot_be_removed_from_export_allowlist(self):
        path = self.root / "source-files.json"
        names = json.loads(path.read_text(encoding="utf-8"))
        for missing in ("server/index.js", "build.py", "export.py", "README.de.md"):
            with self.subTest(missing=missing):
                path.write_text(json.dumps([n for n in names if n != missing]))
                with self.assertRaisesRegex(ValueError, "Missing required source export files"):
                    export.export_source(self.root, self.output)
                self.assertFalse(self.output.exists())

    def test_stale_guide_version_is_rejected_before_export(self):
        path = self.root / "README.de.md"
        text = path.read_text(encoding="utf-8")
        path.write_text(
            re.sub(
                r"(?m)^(\s*(?:\|\s*)?(?:\*\*)?Client[^\n]*?)\d+\.\d+\.\d+",
                r"\g<1>99.0.0",
                text,
                count=1,
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "Client version differs"):
            export.export_source(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_broken_guide_link_is_rejected_before_export(self):
        path = self.root / "README.md"
        path.write_text(
            path.read_text(encoding="utf-8") + "\n[Missing guide](missing-guide.md)\n",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "Broken relative documentation link"):
            export.export_source(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_versioned_source_filename_must_match_manifest(self):
        output = self.output.with_name("KNX-MCP-99.0.0-sources.zip")
        with self.assertRaisesRegex(ValueError, "Artifact filename version differs"):
            export.export_source(self.root, output)
        self.assertFalse(output.exists())

    def test_exported_sources_build_without_the_parent_repository(self):
        export.export_source(self.root, self.output)
        destination = Path(self.tmp.name) / "standalone"
        with zipfile.ZipFile(self.output) as archive:
            archive.extractall(destination)
        client = destination / "knx-mcp-claude"
        output = Path(self.tmp.name) / "standalone.mcpb"
        result = subprocess.run(
            [sys.executable, "build.py", str(output)],
            cwd=client,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(output.is_file())
        original = Path(self.tmp.name) / "original.mcpb"
        reference = subprocess.run(
            [sys.executable, "build.py", str(original)],
            cwd=self.root,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        self.assertEqual(reference.returncode, 0, reference.stderr)
        self.assertEqual(output.read_bytes(), original.read_bytes())
        with zipfile.ZipFile(output) as package:
            self.assertEqual(
                json.loads(package.read("manifest.json")),
                json.loads((self.root / "manifest.json").read_text(encoding="utf-8")),
            )


    def test_export_contains_six_guides_and_only_public_release_documents(self):
        export.export_source(self.root, self.output)
        with zipfile.ZipFile(self.output) as z:
            names = {name.removeprefix("knx-mcp-claude/") for name in z.namelist()}
            guides = {"README.md"} | {
                "README." + code + ".md" for code in ("de", "fr", "cs", "it", "ru")
            }
            self.assertTrue(guides.issubset(names))
            self.assertEqual(
                {n for n in names if n.startswith("release/")},
                {"release/README.md", "release/CHANGELOG.md"},
            )

    def test_private_release_files_are_rejected_even_when_allowlisted(self):
        name = "release/readiness.json"
        (self.root / name).write_text('{"private":"synthetic"}', encoding="utf-8")
        path = self.root / "source-files.json"
        names = json.loads(path.read_text(encoding="utf-8"))
        path.write_text(json.dumps(names + [name]), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Forbidden source export path"):
            export.export_source(self.root, self.output)
        self.assertFalse(self.output.exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
