"""KNX-MCP

Checks the client package boundary and publication prerequisites.
Uses local temporary copies without customer profiles or trust-store changes.

Copyright (c) 2026 Gerald Docenko
SPDX-License-Identifier: MIT
"""

import importlib.util
import json
import re
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("package_build", ROOT / "build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "client"
        shutil.copytree(ROOT, self.root)
        self.output = Path(self.tmp.name) / "test.mcpb"
        # Synthetic publisher evidence is deliberately outside the exported source tree.
        self.approval = Path(self.tmp.name) / "publisher-approval.json"
        manifest = json.loads((self.root / "manifest.json").read_text(encoding="utf-8"))
        info = json.loads((self.root / "release-info.json").read_text(encoding="utf-8"))
        self.approval.write_text(
            json.dumps(
                {
                    "target_ets_app_version": info["ets_app_baseline"],
                    "client_package_version": manifest["version"],
                    "license_identifier": "MIT",
                    "signing_decision": "unsigned",
                    "gates": dict.fromkeys(build.GATES + build.DIRECTORY_GATES, False),
                    "evidence": {},
                    "public_privacy_policies": [],
                }
            ),
            encoding="utf-8",
        )

    def test_package_has_exact_allowlist(self):
        _, count = build.build(self.root, self.output)
        with zipfile.ZipFile(self.output) as z:
            self.assertEqual(set(z.namelist()), set(build.FILES) | {"build-info.json"})
            self.assertEqual(count, len(build.FILES) + 1)
            self.assertEqual(
                z.read("assets/icon.png"), (ROOT / "assets/icon.png").read_bytes()
            )
            self.assertFalse(
                any(n.startswith(("tests/", "src/")) for n in z.namelist())
            )

    def test_package_reproducible(self):
        a, _ = build.build(self.root, self.output)
        b, _ = build.build(self.root, self.output)
        self.assertEqual(a, b)

    def test_versioned_package_filename_must_match_manifest(self):
        output = self.output.with_name("KNX-MCP-99.0.0.mcpb")
        with self.assertRaisesRegex(ValueError, "Artifact filename version differs"):
            build.build(self.root, output)
        self.assertFalse(output.exists())
        build.build(self.root, self.output)
        self.assertTrue(self.output.exists())

    def test_every_guide_and_release_overview_rejects_a_stale_displayed_version(self):
        for name in build.GUIDES + ("release/README.md",):
            with self.subTest(document=name):
                path = self.root / name
                original = path.read_text(encoding="utf-8")
                pattern = (
                    r"(?m)^(\s*(?:\|\s*)?(?:\*\*)?"
                    r"(?:Client(?: version)?|Klient|Клиент)[^\n]*?)"
                    r"\d+\.\d+\.\d+"
                )
                changed, count = re.subn(
                    pattern, r"\g<1>99.0.0", original, count=1, flags=re.IGNORECASE
                )
                self.assertEqual(count, 1, name)
                path.write_text(changed, encoding="utf-8")
                try:
                    with self.assertRaisesRegex(ValueError, "Client version differs"):
                        build.build(self.root, self.output)
                    self.assertFalse(self.output.exists())
                finally:
                    path.write_text(original, encoding="utf-8")

    def test_stale_installation_filename_is_rejected(self):
        path = self.root / "README.md"
        text = path.read_text(encoding="utf-8")
        changed, count = re.subn(
            r"KNX-MCP-\d+\.\d+\.\d+\.mcpb", "KNX-MCP-99.0.0.mcpb", text
        )
        self.assertGreater(count, 0)
        path.write_text(changed, encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Package filename version differs"):
            build.build(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_latest_release_note_version_must_match_manifest(self):
        path = self.root / "release/CHANGELOG.md"
        text = path.read_text(encoding="utf-8")
        path.write_text(
            re.sub(r"(?m)^##\s+\d+\.\d+\.\d+", "## 99.0.0", text, count=1),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "Latest release note version differs"):
            build.build(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_broken_documentation_link_is_rejected_before_output(self):
        path = self.root / "README.md"
        original = path.read_text(encoding="utf-8")
        for target, error in (
            ("missing-guide.md", "Broken relative documentation link"),
            ("C:/private/guide.md", "Nonportable documentation link"),
            ("file:///C:/private/guide.md", "Nonportable documentation link"),
        ):
            with self.subTest(target=target):
                path.write_text(
                    original + "\n[Unavailable guide](" + target + ")\n",
                    encoding="utf-8",
                )
                with self.assertRaisesRegex(ValueError, error):
                    build.build(self.root, self.output)
                self.assertFalse(self.output.exists())

    def test_broken_documentation_anchor_is_rejected_before_output(self):
        path = self.root / "README.md"
        path.write_text(
            path.read_text(encoding="utf-8")
            + "\n[Missing section](README.de.md#missing-section)\n",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "Broken documentation anchor"):
            build.build(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_fenced_link_examples_are_not_treated_as_document_links(self):
        path = self.root / "README.md"
        path.write_text(
            path.read_text(encoding="utf-8")
            + "\n```text\n[Example](not-a-real-document.md)\n```\n",
            encoding="utf-8",
        )
        build.build(self.root, self.output)
        self.assertTrue(self.output.exists())

    def test_release_requires_external_approval_without_creating_output(self):
        with self.assertRaisesRegex(ValueError, "PUBLICATION_BLOCKED"):
            build.build(self.root, self.output, True)
        self.assertFalse(self.output.exists())

    def test_release_refuses_boolean_only_approvals(self):
        p = self.approval
        data = json.loads(p.read_text(encoding="utf-8"))
        data["gates"] = dict.fromkeys(build.GATES, True)
        p.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "PUBLICATION_BLOCKED"):
            build.build(self.root, self.output, True, approval_file=p)

    def test_release_rejects_missing_public_policy(self):
        p = self.approval
        data = json.loads(p.read_text(encoding="utf-8"))
        data["gates"] = dict.fromkeys(build.GATES + build.DIRECTORY_GATES, True)
        data["evidence"] = dict.fromkeys(
            build.GATES + build.DIRECTORY_GATES, "synthetic-unit-test"
        )
        p.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "HTTPS privacy policy"):
            build.build(self.root, self.output, directory=True, approval_file=p)

    def test_old_icon_size_rejected(self):
        p = self.root / "assets/icon.png"
        data = bytearray(p.read_bytes())
        data[16:20] = (32).to_bytes(4, "big")
        p.write_bytes(data)
        with self.assertRaisesRegex(ValueError, "256x256"):
            build.build(self.root, self.output)

    def test_unknown_runtime_profile_inputs_rejected(self):
        p = self.root / "manifest.json"
        m = json.loads(p.read_text(encoding="utf-8"))
        m["user_config"]["key"] = {}
        p.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError, "Only profiles"):
            build.build(self.root, self.output)

    def test_manual_tokens_must_remain_sensitive(self):
        p = self.root / "manifest.json"
        m = json.loads(p.read_text(encoding="utf-8"))
        m["user_config"]["manual_1_token"]["sensitive"] = False
        p.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError, "must be sensitive"):
            build.build(self.root, self.output)

    def test_tokens_cannot_enter_command_arguments(self):
        p = self.root / "manifest.json"
        m = json.loads(p.read_text(encoding="utf-8"))
        m["server"]["mcp_config"]["args"].insert(1, "${user_config.manual_1_token}")
        p.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError, "No secrets"):
            build.build(self.root, self.output)

    def test_http_consent_cannot_default_on(self):
        p = self.root / "manifest.json"
        m = json.loads(p.read_text(encoding="utf-8"))
        m["user_config"]["allow_insecure_http"]["default"] = True
        p.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError, "HTTP must require"):
            build.build(self.root, self.output)

    def test_extra_environment_inputs_are_rejected(self):
        p = self.root / "manifest.json"
        m = json.loads(p.read_text(encoding="utf-8"))
        m["server"]["mcp_config"]["env"]["NODE_TLS_REJECT_UNAUTHORIZED"] = "0"
        p.write_text(json.dumps(m))
        with self.assertRaisesRegex(ValueError, "Only explicit manual"):
            build.build(self.root, self.output)

    def test_readable_runtime_headers_and_dependency_boundary(self):
        import re

        for p in (self.root / "server").glob("*.js"):
            text = p.read_text(encoding="utf-8")
            self.assertTrue(text.startswith("/**\n * KNX-MCP\n"))
            for module in re.findall(r"require\(['\"]([^'\"]+)['\"]\)", text):
                self.assertTrue(
                    module.startswith(("node:", "./"))
                    or module in ("../manifest.json", "../release-info.json")
                )
                self.assertNotIn(module, ("node:child_process", "node:vm"))

    def test_missing_runtime_module_rejected(self):
        (self.root / "server/tool-metadata.js").unlink()
        with self.assertRaisesRegex(ValueError, "Missing file"):
            build.build(self.root, self.output)

    def test_https_policy_url_validation(self):
        for bad in [
            "",
            None,
            "http://example.test/privacy",
            "https://secret@example.test/privacy",
            "https://example.test/#fragment",
            "https://example.test/white space",
        ]:
            self.assertFalse(build.https_url(bad))
        self.assertTrue(build.https_url("https://example.test/privacy"))

    def test_build_metadata_and_sidecar_match_the_package(self):
        import hashlib

        digest, _ = build.build(self.root, self.output)
        self.assertIn(digest, self.output.with_suffix(".mcpb.sha256").read_text())
        with zipfile.ZipFile(self.output) as z:
            data = json.loads(z.read("build-info.json"))
            manifest = json.loads(z.read("manifest.json"))
            self.assertEqual(data["version"], manifest["version"])
            self.assertEqual(data["publisher"], "Gerald Docenko")
            fingerprint = hashlib.sha256()
            for name in sorted(build.FILES):
                fingerprint.update(
                    name.encode() + b"\0" + hashlib.sha256(z.read(name)).digest()
                )
            self.assertEqual(data["source_sha256"], fingerprint.hexdigest())
            self.assertEqual(data["ets_app_baseline"], "1.2.0.4")

    def test_all_six_locales_have_nonempty_matching_fields(self):
        manifest = json.loads((self.root / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(set(build.LOCALES), {"en", "de", "fr", "cs", "it", "ru"})
        for locale in build.LOCALES:
            text = json.loads(
                (self.root / "locales" / (locale + ".json")).read_text(encoding="utf-8")
            )
            for field in ("display_name", "description", "long_description"):
                self.assertTrue(text[field].strip())
            self.assertEqual(list(text["user_config"]), list(manifest["user_config"]))
            for value in text["user_config"].values():
                self.assertEqual(set(value), {"title", "description"})
                self.assertTrue(value["title"].strip() and value["description"].strip())

    def test_community_release_does_not_require_directory_publication(self):
        p = self.approval
        data = json.loads(p.read_text(encoding="utf-8"))
        data["gates"] = dict.fromkeys(build.GATES, True)
        data["evidence"] = dict.fromkeys(
            build.GATES, "synthetic-unit-test-not-an-approval"
        )
        p.write_text(json.dumps(data), encoding="utf-8")
        build.build(self.root, self.output, release=True, approval_file=p)
        with self.assertRaisesRegex(ValueError, "PUBLICATION_BLOCKED"):
            build.build(self.root, self.output, directory=True, approval_file=p)

    def test_code_headers_include_publisher_and_license(self):
        for p in (self.root / "server").glob("*.js"):
            text = p.read_text(encoding="utf-8")
            self.assertIn("Copyright (c) 2026 Gerald Docenko", text[:650])
            self.assertIn("SPDX-License-Identifier: MIT", text[:650])

    def test_package_ignores_personal_profiles_and_private_extras(self):
        (self.root / "KNX-MCP-private.json").write_text(
            '{"access_key":"synthetic-leak-marker"}'
        )
        (self.root / "private.snk").write_text("synthetic-leak-marker")
        build.build(self.root, self.output)
        with zipfile.ZipFile(self.output) as z:
            self.assertFalse(any("private" in name for name in z.namelist()))
            self.assertFalse(
                any(b"synthetic-leak-marker" in z.read(name) for name in z.namelist())
            )


    def test_external_pending_approvals_still_block_release(self):
        with self.assertRaisesRegex(ValueError, "PUBLICATION_BLOCKED"):
            build.build(
                self.root, self.output, release=True, approval_file=self.approval
            )
        self.assertFalse(self.output.exists())

    def test_approval_file_inside_source_tree_is_rejected(self):
        nested = self.root / "publisher-approval.json"
        nested.write_bytes(self.approval.read_bytes())
        with self.assertRaisesRegex(ValueError, "outside the client source tree"):
            build.build(self.root, self.output, release=True, approval_file=nested)
        self.assertFalse(self.output.exists())

    def test_missing_external_approval_file_is_rejected(self):
        self.approval.unlink()
        with self.assertRaisesRegex(ValueError, "approval file not found"):
            build.build(
                self.root, self.output, release=True, approval_file=self.approval
            )
        self.assertFalse(self.output.exists())

    def test_approved_build_does_not_bundle_private_evidence(self):
        data = json.loads(self.approval.read_text(encoding="utf-8"))
        data["gates"] = dict.fromkeys(build.GATES, True)
        marker = "synthetic-private-approval-evidence"
        data["evidence"] = dict.fromkeys(build.GATES, marker)
        self.approval.write_text(json.dumps(data), encoding="utf-8")
        build.build(self.root, self.output, release=True, approval_file=self.approval)
        with zipfile.ZipFile(self.output) as z:
            self.assertFalse(any(marker.encode() in z.read(n) for n in z.namelist()))
            self.assertEqual(
                {n for n in z.namelist() if n.startswith("release/")},
                {"release/README.md", "release/CHANGELOG.md"},
            )

    def test_all_six_readmes_are_complete_and_linked(self):
        names = ["README.md"] + [
            "README." + locale + ".md"
            for locale in build.LOCALES
            if locale != "en"
        ]
        info = json.loads((self.root / "release-info.json").read_text(encoding="utf-8"))
        for name in names:
            text = (self.root / name).read_text(encoding="utf-8")
            self.assertIn(name, build.FILES)
            self.assertTrue(text.startswith("# KNX-MCP "), name)
            for other in names:
                self.assertIn("](" + other + ")", text, name)
            for term in (
                "knx_connections",
                "knx_refresh_connections",
                "ets_list_projects",
                "knx-mcp-claude/v1",
                info["ets_app_baseline"],
                "Gerald Docenko",
                "MIT",
                "support@knx-mcp.com",
                "32",
                "PROJECT_RECHECK_REQUIRED",
            ):
                self.assertIn(term, text, name)

    def test_packaged_markdown_links_resolve_inside_package(self):
        build.build(self.root, self.output)
        with zipfile.ZipFile(self.output) as z:
            names = set(z.namelist())
            for name in sorted(n for n in names if n.endswith(".md")):
                text = z.read(name).decode("utf-8")
                for target in re.findall(r"\]\(([^)]+)\)", text):
                    if ":" in target or target.startswith("#"):
                        continue
                    target = target.split("#", 1)[0]
                    resolved = (self.root / name).parent / target
                    relative = (
                        resolved.resolve().relative_to(self.root.resolve()).as_posix()
                    )
                    self.assertIn(relative, names, name + " -> " + target)

    def test_public_release_has_no_internal_draft_history(self):
        manifest = json.loads((self.root / "manifest.json").read_text(encoding="utf-8"))
        notes = (self.root / "release/CHANGELOG.md").read_text(encoding="utf-8")
        self.assertEqual(
            re.findall(r"^## (.+)$", notes, re.MULTILINE),
            [manifest["version"] + " — Initial release"],
        )
        for name in build.FILES:
            if name.endswith(".md"):
                text = (self.root / name).read_text(encoding="utf-8").lower()
                for marker in (
                    "public preparation",
                    "publication preparation",
                    "internal candidate",
                    "release candidate",
                    "before publication",
                    "vor öffentlicher nutzung",
                    "dieser entwurf",
                    "sharepoint",
                ):
                    self.assertNotIn(marker, text, name)
                self.assertNotRegex(text, r"\b(?:todo|tbd|fixme)\b", name)
        info = json.loads((self.root / "release-info.json").read_text(encoding="utf-8"))
        self.assertNotIn("status", info)


if __name__ == "__main__":
    unittest.main(verbosity=2)
