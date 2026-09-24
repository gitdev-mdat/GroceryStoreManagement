from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import requests

from crew.browser import BrowserConfig, ChromeSession, DevServerManager


class FakeProcess:
    def __init__(self, returncode: int | None = None) -> None:
        self.pid = 424242
        self.returncode = returncode
        self.wait_calls = 0

    def poll(self) -> int | None:
        return self.returncode

    def wait(self, timeout: int) -> int:
        self.wait_calls += 1
        return self.returncode or 0

    def terminate(self) -> None:
        self.returncode = 0

    def kill(self) -> None:
        self.returncode = -9


class DevServerManagerTests(unittest.TestCase):
    def _manager(
        self,
        root: Path,
        *,
        app_url: str = "http://127.0.0.1:5173",
        command: list[str] | None = None,
    ) -> DevServerManager:
        (root / "package.json").write_text(
            '{"scripts":{"dev":"vite"}}', encoding="utf-8"
        )
        return DevServerManager(
            root,
            root / ".ai" / "crew" / "run-artifacts" / "test",
            BrowserConfig(app_url=app_url, server_command=command, ready_timeout=1),
        )

    def test_existing_reachable_server_is_reused_without_spawn(self) -> None:
        with tempfile.TemporaryDirectory(prefix="Hai Kieu existing server ") as directory:
            manager = self._manager(Path(directory))
            with (
                patch.object(
                    manager,
                    "_reachable_endpoint",
                    return_value="http://localhost:5173",
                ),
                patch("crew.browser.subprocess.Popen") as popen,
            ):
                self.assertEqual(manager.ensure_ready(), "http://localhost:5173")
                popen.assert_not_called()
            manager.close()

    def test_loopback_probe_can_reuse_ipv6_localhost_server(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manager = self._manager(Path(directory))
            with patch.object(
                manager,
                "_reachable",
                side_effect=lambda url: url == "http://localhost:5173",
            ):
                self.assertEqual(manager._reachable_endpoint(), "http://localhost:5173")

    def test_missing_server_starts_vite_from_root_with_strict_port(self) -> None:
        with tempfile.TemporaryDirectory(prefix="Hai Kieu path with spaces ") as directory:
            root = Path(directory)
            manager = self._manager(root)
            process = FakeProcess()
            with (
                patch.object(
                    manager,
                    "_reachable_endpoint",
                    side_effect=[None, "http://127.0.0.1:5173"],
                ),
                patch("crew.browser.shutil.which", return_value=r"C:\Program Files\nodejs\npm.cmd"),
                patch("crew.browser.subprocess.Popen", return_value=process) as popen,
            ):
                self.assertEqual(manager.ensure_ready(), "http://127.0.0.1:5173")
            command = popen.call_args.args[0]
            self.assertEqual(command[0], r"C:\Program Files\nodejs\npm.cmd")
            self.assertEqual(command[-6:], ["--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"])
            self.assertEqual(popen.call_args.kwargs["cwd"], root.resolve())
            process.returncode = 0
            manager.close()

    def test_readiness_requires_a_successful_http_response(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manager = self._manager(Path(directory))
            with patch(
                "crew.browser.requests.get",
                side_effect=[
                    requests.ConnectionError("not ready"),
                    SimpleNamespace(status_code=404),
                    SimpleNamespace(status_code=503),
                    SimpleNamespace(status_code=200),
                ],
            ):
                self.assertFalse(manager._reachable("http://127.0.0.1:5173"))
                self.assertFalse(manager._reachable("http://127.0.0.1:5173"))
                self.assertFalse(manager._reachable("http://127.0.0.1:5173"))
                self.assertTrue(manager._reachable("http://127.0.0.1:5173"))

    def test_start_failure_reports_command_target_and_working_directory(self) -> None:
        with tempfile.TemporaryDirectory(prefix="Hai Kieu failed start ") as directory:
            root = Path(directory)
            manager = self._manager(root)
            with (
                patch.object(manager, "_reachable_endpoint", return_value=None),
                patch("crew.browser.shutil.which", return_value=r"C:\Program Files\nodejs\npm.cmd"),
                patch("crew.browser.subprocess.Popen", side_effect=OSError("launch denied")),
            ):
                with self.assertRaisesRegex(RuntimeError, "failed to start") as raised:
                    manager.ensure_ready()
            message = str(raised.exception)
            self.assertIn("launch denied", message)
            self.assertIn(str(root.resolve()), message)
            self.assertIn("http://127.0.0.1:5173", message)
            manager.close()

    def test_early_exit_includes_dev_server_log_tail(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manager = self._manager(Path(directory))

            def exited_process(*_: object, **kwargs: object) -> FakeProcess:
                output = kwargs["stdout"]
                output.write(b"error: Port 5173 is already in use\n")
                output.flush()
                return FakeProcess(returncode=1)

            with (
                patch.object(manager, "_reachable_endpoint", return_value=None),
                patch("crew.browser.shutil.which", return_value=r"C:\Program Files\nodejs\npm.cmd"),
                patch("crew.browser.subprocess.Popen", side_effect=exited_process),
            ):
                with self.assertRaisesRegex(RuntimeError, "exited before HTTP readiness") as raised:
                    manager.ensure_ready()
            self.assertIn("Port 5173 is already in use", str(raised.exception))
            manager.close()

    def test_repeated_calls_do_not_spawn_duplicate_server(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manager = self._manager(Path(directory))
            process = FakeProcess()
            with (
                patch.object(
                    manager,
                    "_reachable_endpoint",
                    side_effect=[None, "http://127.0.0.1:5173", "http://127.0.0.1:5173"],
                ),
                patch("crew.browser.shutil.which", return_value=r"C:\Program Files\nodejs\npm.cmd"),
                patch("crew.browser.subprocess.Popen", return_value=process) as popen,
            ):
                manager.ensure_ready()
                manager.ensure_ready()
                self.assertEqual(popen.call_count, 1)
            process.returncode = 0
            manager.close()

    def test_cleanup_does_not_kill_server_not_owned_by_manager(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manager = self._manager(Path(directory))
            with patch("crew.browser.subprocess.run") as run:
                manager.close()
                run.assert_not_called()

    def test_client_render_waits_until_spa_mounts_content(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            session = ChromeSession(Path(directory))
            with (
                patch.object(session, "evaluate", side_effect=[False, False, True]) as evaluate,
                patch("crew.browser.time.sleep"),
            ):
                session.wait_rendered(timeout=1)
            self.assertEqual(evaluate.call_count, 3)


if __name__ == "__main__":
    unittest.main()
