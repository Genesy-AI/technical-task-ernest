"""Exercise hook stdin, exit codes, messages, and side effects in temporary repos."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


HOOKS = Path(os.environ.get("HOOKS_DIR", Path(__file__).resolve().parents[1]))


class GuardTests(unittest.TestCase):
    def check_command(self, command, expected):
        result = subprocess.run(
            ["bash", str(HOOKS / "guard.sh")],
            input=json.dumps({"tool_name": "Bash", "tool_input": {"command": command}}),
            text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, expected, (command, result.stderr))
        self.assertEqual(result.stdout, "")
        if expected == 2:
            self.assertIn("Blocked by .claude/hooks/guard.sh:", result.stderr)
        else:
            self.assertEqual(result.stderr, "")

    def test_global_git_options_keep_destructive_operations_blocked(self):
        for command in (
            "git -C . reset --hard",
            'git -C "folder with spaces" reset --hard HEAD',
            "git --git-dir=.git reset --hard",
            "git -c core.quotepath=false -C . reset --hard",
            "git -C . push --force origin feature",
            "git -C . add backend/prisma/dev.db",
        ):
            with self.subTest(command=command):
                self.check_command(command, 2)

    def test_forced_clean_spellings_are_blocked(self):
        for command in ("git clean --force -d", "git clean -df", "git clean -ffd"):
            with self.subTest(command=command):
                self.check_command(command, 2)

    def test_worktree_restore_is_blocked(self):
        for command in (
            "git restore .", "git restore backend/src/index.ts",
            "git -C . restore --worktree backend/src/index.ts",
            "git restore --staged --worktree .", "git restore -SW .",
            "git restore --staged file.ts && git restore file.ts",
        ):
            with self.subTest(command=command):
                self.check_command(command, 2)

    def test_index_only_restore_remains_allowed(self):
        for command in ("git restore --staged file.ts", "git restore -S file.ts"):
            with self.subTest(command=command):
                self.check_command(command, 0)

    def test_existing_command_policy_is_preserved(self):
        cases = {
            "git status --short": 0, "git diff --name-only": 0,
            "git -C . status --short": 0, "git checkout feature": 0,
            "git add backend/src/index.ts": 0, "git commit -m fix": 0,
            "git push origin feature": 0, "git push origin main": 0,
            "git reset --hard": 2, "git clean -fd": 2,
            "git checkout -- backend/src/index.ts": 2,
            "git push --force origin feature": 2, "git push -f origin feature": 2,
            "git add .": 2, "git add -A": 2, "git commit -am fix": 2,
            "git add backend/prisma/dev.db": 2,
            "pnpm exec prisma migrate reset": 2,
            "pnpm exec prisma db push --force-reset": 2,
        }
        for command, expected in cases.items():
            with self.subTest(command=command):
                self.check_command(command, expected)


class StopTests(unittest.TestCase):
    def make_repo(self, changed):
        scratch = tempfile.TemporaryDirectory(prefix="ai-hook-test-")
        self.addCleanup(scratch.cleanup)
        root = Path(scratch.name)
        for directory in ("backend", "frontend", "bin", "cache"):
            (root / directory).mkdir()
        (root / "README.md").write_text("fixture\n")
        (root / ".gitignore").write_text("/bin/\n/cache/\n/calls\n")
        for command in (
            ["git", "init", "-q"], ["git", "add", "README.md", ".gitignore"],
            ["git", "-c", "user.name=Hook Test", "-c", "user.email=hooks@example.test",
             "-c", "core.hooksPath=/dev/null", "commit", "--no-gpg-sign", "-qm", "fixture"],
        ):
            subprocess.run(command, cwd=root, check=True, capture_output=True)
        for relative in changed:
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture change\n")
        pnpm = root / "bin/pnpm"
        pnpm.write_text(
            '#!/usr/bin/env bash\n'
            'printf "%s\\n" "${PWD##*/}:$*" >> "$HOOK_CALL_LOG"\n'
            'if [ "$HOOK_TEST_FAIL" = "1" ]; then\n'
            '  echo "fixture failure" >&2\n'
            '  exit 7\n'
            'fi\n'
        )
        pnpm.chmod(0o755)
        return root

    def run_hook(self, root, fail=False, active=False):
        env = dict(os.environ, CLAUDE_PROJECT_DIR=str(root), TMPDIR=str(root / "cache"),
                   PATH=str(root / "bin") + os.pathsep + os.environ["PATH"],
                   HOOK_CALL_LOG=str(root / "calls"), HOOK_TEST_FAIL=str(int(fail)))
        return subprocess.run(
            ["bash", str(HOOKS / "green-before-done.sh")], cwd=root, env=env,
            input=json.dumps({"stop_hook_active": active}),
            text=True, capture_output=True, check=False,
        )

    def calls(self, root):
        path = root / "calls"
        return path.read_text().splitlines() if path.exists() else []

    def expected_calls(self, package):
        tsc = "--noEmit -p ." if package == "backend" else "-b"
        return [f"{package}:exec tsc {tsc}", f"{package}:exec vitest run"]

    def test_sql_and_yaml_changes_run_checks_and_report_failures(self):
        for relative in ("backend/prisma/migrations/new/migration.sql",
                         "backend/pnpm-lock.yaml", "frontend/config.yml"):
            with self.subTest(path=relative):
                root = self.make_repo([relative])
                result = self.run_hook(root, fail=True)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(result.stdout, "")
                self.assertEqual(self.calls(root), self.expected_calls(relative.split("/")[0]))
                self.assertEqual(result.stderr.count("fixture failure"), 2)
                self.assertIn("Checks are failing", result.stderr)
                self.assertEqual(list((root / "cache").glob("green-*")), [])

    def test_source_checks_and_green_cache_are_preserved(self):
        for package in ("backend", "frontend"):
            with self.subTest(package=package):
                root = self.make_repo([f"{package}/src/example.ts"])
                result = self.run_hook(root)
                self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
                self.assertEqual(self.calls(root), self.expected_calls(package))
                again = self.run_hook(root)
                self.assertEqual((again.returncode, again.stdout, again.stderr), (0, "", ""))
                self.assertEqual(self.calls(root), self.expected_calls(package))
                self.assertEqual(len(list((root / "cache").glob("green-*"))), 1)

    def test_source_failures_still_report_both_checks(self):
        root = self.make_repo(["backend/src/example.ts"])
        result = self.run_hook(root, fail=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertEqual(self.calls(root), self.expected_calls("backend"))
        self.assertEqual(result.stderr.count("fixture failure"), 2)
        self.assertIn("Checks are failing", result.stderr)
        self.assertEqual(list((root / "cache").glob("green-*")), [])

    def test_unchanged_docs_and_database_only_changes_skip_checks(self):
        for changed in ([], ["docs/notes.md"], ["backend/prisma/dev.db"]):
            with self.subTest(changed=changed):
                root = self.make_repo(changed)
                result = self.run_hook(root, fail=True)
                self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
                self.assertEqual(self.calls(root), [])

    def test_repeat_stop_still_skips_checks(self):
        root = self.make_repo(["backend/src/example.ts"])
        result = self.run_hook(root, fail=True, active=True)
        self.assertEqual((result.returncode, result.stdout, result.stderr), (0, "", ""))
        self.assertEqual(self.calls(root), [])


if __name__ == "__main__":
    unittest.main()
