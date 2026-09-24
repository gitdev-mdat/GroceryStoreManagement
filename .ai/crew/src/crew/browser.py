from __future__ import annotations

import base64
import json
import os
import re
import shutil
import socket
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Sequence
from urllib.parse import urljoin, urlparse

import requests
import websocket
from crewai.tools import BaseTool
from pydantic import BaseModel, Field, PrivateAttr

from crew.llms import API_KEY, BASE_URL


MAX_BROWSER_TEXT = 6_000


class BrowserInput(BaseModel):
    action: Literal[
        "ensure_server",
        "navigate",
        "set_viewport",
        "inspect_page",
        "click",
        "fill",
        "screenshot",
        "errors",
        "visual_check",
    ]
    target: str = Field(default="", description="Local URL/path or selector/text target")
    value: str = Field(default="", description="Fill value")
    width: int = Field(default=1440, ge=320, le=2560)
    height: int = Field(default=900, ge=320, le=1600)
    name: str = Field(default="visual", description="Short screenshot/scenario name")


@dataclass(frozen=True)
class BrowserConfig:
    app_url: str | None = None
    server_command: Sequence[str] | None = None
    ready_timeout: int = 120


class DevServerManager:
    def __init__(
        self,
        project_root: Path,
        artifact_root: Path,
        config: BrowserConfig | None = None,
    ) -> None:
        self.project_root = project_root.resolve()
        self.artifact_root = artifact_root.resolve()
        self.config = config or BrowserConfig()
        self.app_url = self.config.app_url or os.environ.get(
            "CREW_APP_URL", "http://127.0.0.1:5173"
        )
        self._process: subprocess.Popen[bytes] | None = None
        self._log_handle: Any = None
        self._log_path: Path | None = None
        self._command: list[str] = []

    @staticmethod
    def _reachable(url: str) -> bool:
        try:
            response = requests.get(url, timeout=2, allow_redirects=True)
            return 200 <= response.status_code < 400
        except requests.RequestException:
            return False

    @staticmethod
    def _candidate_urls(url: str) -> list[str]:
        """Return equivalent loopback URLs without changing the configured port/path."""
        parsed = urlparse(url)
        if parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
            return [url]
        candidates: list[str] = []
        for host in (parsed.hostname, "127.0.0.1", "localhost", "::1"):
            display_host = f"[{host}]" if ":" in host else host
            netloc = display_host
            if parsed.port is not None:
                netloc += f":{parsed.port}"
            candidate = parsed._replace(netloc=netloc).geturl()
            if candidate not in candidates:
                candidates.append(candidate)
        return candidates

    def _reachable_endpoint(self) -> str | None:
        for candidate in self._candidate_urls(self.app_url):
            if self._reachable(candidate):
                return candidate
        return None

    def _default_command(self) -> list[str]:
        package_file = self.project_root / "package.json"
        if not package_file.is_file():
            raise RuntimeError(
                "No dev-server command was configured and package.json is absent."
            )
        package = json.loads(package_file.read_text(encoding="utf-8"))
        if "dev" not in package.get("scripts", {}):
            raise RuntimeError("package.json has no dev script.")
        runner = "pnpm" if (self.project_root / "pnpm-lock.yaml").exists() else "npm"
        if os.name == "nt":
            runner += ".cmd"
        parsed = urlparse(self.app_url)
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        return [
            runner,
            "run",
            "dev",
            "--",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--strictPort",
        ]

    def _log_tail(self, limit: int = 4_000) -> str:
        if self._log_handle is not None:
            try:
                self._log_handle.flush()
            except OSError:
                pass
        if self._log_path is None or not self._log_path.is_file():
            return "(dev-server log is unavailable)"
        try:
            content = self._log_path.read_text(encoding="utf-8", errors="replace").strip()
        except OSError as exc:
            return f"(unable to read dev-server log: {exc})"
        return content[-limit:] or "(dev-server log is empty)"

    def _failure_message(self, reason: str) -> str:
        command = subprocess.list2cmdline(self._command) if self._command else "(not started)"
        log_reference = (
            self._log_path.relative_to(self.project_root).as_posix()
            if self._log_path is not None
            else "(unavailable)"
        )
        return (
            f"{reason}\n"
            f"Target: {self.app_url}\n"
            f"Working directory: {self.project_root}\n"
            f"Command: {command}\n"
            f"Log: {log_reference}\n"
            f"Log tail:\n{self._log_tail()}"
        )

    def _stop_owned_process(self) -> None:
        process = self._process
        if process is not None and process.poll() is None:
            if os.name == "nt":
                subprocess.run(
                    ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    check=False,
                )
            else:
                process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)
        self._process = None

    def ensure_ready(self) -> str:
        parsed = urlparse(self.app_url)
        if parsed.scheme not in {"http", "https"} or parsed.hostname not in {
            "127.0.0.1",
            "localhost",
        }:
            raise RuntimeError("Browser app URL must use localhost or 127.0.0.1.")
        reachable = self._reachable_endpoint()
        if reachable is not None:
            self.app_url = reachable
            return reachable

        if self._process is None:
            self._command = list(self.config.server_command or self._default_command())
            executable = shutil.which(self._command[0])
            if executable is None:
                raise RuntimeError(
                    self._failure_message(
                        f"Dev server command was not found: {self._command[0]}"
                    )
                )
            self._command[0] = executable
            self.artifact_root.mkdir(parents=True, exist_ok=True)
            self._log_path = self.artifact_root / "dev-server.log"
            self._log_handle = self._log_path.open("wb")
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
            environment = os.environ.copy()
            environment.update({"NO_COLOR": "1", "PYTHONUTF8": "1"})
            try:
                self._process = subprocess.Popen(
                    self._command,
                    cwd=self.project_root,
                    stdin=subprocess.DEVNULL,
                    stdout=self._log_handle,
                    stderr=subprocess.STDOUT,
                    env=environment,
                    creationflags=creation_flags,
                )
            except OSError as exc:
                self._close_log()
                raise RuntimeError(
                    self._failure_message(f"Dev server command failed to start: {exc}")
                ) from exc
        deadline = time.monotonic() + self.config.ready_timeout
        while time.monotonic() < deadline:
            assert self._process is not None
            if self._process.poll() is not None:
                message = self._failure_message(
                    f"Dev server exited before HTTP readiness with code {self._process.returncode}."
                )
                self._process = None
                self._close_log()
                raise RuntimeError(message)
            reachable = self._reachable_endpoint()
            if reachable is not None:
                self.app_url = reachable
                return reachable
            time.sleep(0.5)
        message = self._failure_message(
            f"Dev server process stayed alive, but no usable HTTP endpoint became reachable "
            f"within {self.config.ready_timeout}s."
        )
        self._stop_owned_process()
        self._close_log()
        raise RuntimeError(message)

    def _close_log(self) -> None:
        if self._log_handle is not None:
            self._log_handle.close()
        self._log_handle = None

    def close(self) -> None:
        self._stop_owned_process()
        self._close_log()


class ChromeSession:
    def __init__(self, artifact_root: Path) -> None:
        self.artifact_root = artifact_root.resolve()
        self.profile_dir = self.artifact_root / "browser-profile"
        self._process: subprocess.Popen[bytes] | None = None
        self._socket: websocket.WebSocket | None = None
        self._next_id = 0
        self._console_errors: list[str] = []
        self._page_errors: list[str] = []

    @staticmethod
    def _chrome_path() -> Path:
        candidates = [
            Path(os.environ.get("PROGRAMFILES", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe",
            Path(os.environ.get("PROGRAMFILES", "")) / "Microsoft/Edge/Application/msedge.exe",
            Path(os.environ.get("PROGRAMFILES(X86)", "")) / "Microsoft/Edge/Application/msedge.exe",
        ]
        for candidate in candidates:
            if candidate.is_file():
                return candidate
        raise RuntimeError("Chrome or Edge was not found.")

    @staticmethod
    def _free_port() -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            return int(sock.getsockname()[1])

    def start(self) -> None:
        if self._socket is not None:
            return
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        port = self._free_port()
        command = [
            str(self._chrome_path()),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--remote-allow-origins=*",
            f"--remote-debugging-port={port}",
            f"--user-data-dir={self.profile_dir}",
            "about:blank",
        ]
        self._process = subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        endpoint = f"http://127.0.0.1:{port}"
        deadline = time.monotonic() + 20
        page: dict[str, Any] | None = None
        while time.monotonic() < deadline:
            if self._process.poll() is not None:
                raise RuntimeError("Browser exited before DevTools became ready.")
            try:
                pages = requests.get(endpoint + "/json/list", timeout=1).json()
                page = next((item for item in pages if item.get("type") == "page"), None)
                if page:
                    break
            except (requests.RequestException, ValueError):
                pass
            time.sleep(0.2)
        if not page:
            raise RuntimeError("Browser DevTools endpoint did not become ready.")
        self._socket = websocket.create_connection(
            page["webSocketDebuggerUrl"], timeout=20, origin=endpoint
        )
        self.call("Page.enable")
        self.call("Runtime.enable")
        self.call("Log.enable")

    def _handle_event(self, message: dict[str, Any]) -> None:
        method = message.get("method")
        params = message.get("params", {})
        if method == "Runtime.consoleAPICalled" and params.get("type") == "error":
            text = " ".join(
                str(item.get("value") or item.get("description") or "")
                for item in params.get("args", [])
            ).strip()
            if text:
                self._console_errors.append(text[:1_000])
        elif method == "Runtime.exceptionThrown":
            detail = params.get("exceptionDetails", {})
            self._page_errors.append(str(detail.get("text", "Page exception"))[:1_000])
        elif method == "Log.entryAdded":
            entry = params.get("entry", {})
            source_url = str(entry.get("url", ""))
            if entry.get("level") == "error" and not source_url.endswith("/favicon.ico"):
                self._console_errors.append(str(entry.get("text", ""))[:1_000])

    def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self.start()
        assert self._socket is not None
        self._next_id += 1
        call_id = self._next_id
        self._socket.send(json.dumps({"id": call_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(self._socket.recv())
            if message.get("id") == call_id:
                if "error" in message:
                    raise RuntimeError(str(message["error"]))
                return message.get("result", {})
            self._handle_event(message)

    def evaluate(self, expression: str) -> Any:
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if result.get("exceptionDetails"):
            raise RuntimeError(str(result["exceptionDetails"].get("text", "JavaScript error")))
        return result.get("result", {}).get("value")

    def wait_ready(self, timeout: int = 30) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                if self.evaluate("document.readyState") in {"interactive", "complete"}:
                    return
            except RuntimeError:
                pass
            time.sleep(0.2)
        raise RuntimeError("Page did not reach a ready state.")

    def wait_rendered(self, timeout: int = 10) -> None:
        """Give client-rendered apps time to mount meaningful DOM before inspection."""
        expression = """(() => {
          const root = document.querySelector('#root, #app, [data-reactroot]') || document.body;
          if (!root) return false;
          const text = (root.innerText || '').trim();
          return text.length > 0 || root.childElementCount > 0 || !!root.querySelector('canvas,svg,iframe');
        })()"""
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                if self.evaluate(expression):
                    return
            except RuntimeError:
                pass
            time.sleep(0.1)

    def navigate(self, url: str) -> None:
        self._console_errors.clear()
        self._page_errors.clear()
        self.call("Page.navigate", {"url": url})
        self.wait_ready()
        self.wait_rendered()

    def viewport(self, width: int, height: int) -> None:
        self.call(
            "Emulation.setDeviceMetricsOverride",
            {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
        )

    def inspect(self) -> dict[str, Any]:
        script = """(() => {
          const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
          const visible = (el) => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; };
          const items = (sel) => [...document.querySelectorAll(sel)].filter(visible).slice(0,40).map(el => clean(el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder'))).filter(Boolean);
          return {
            url: location.href, title: document.title,
            headings: items('h1,h2,h3,[role=heading]'),
            actions: items('button,a,[role=button]'),
            fields: items('input,textarea,select'),
            body_text: clean(document.body?.innerText).slice(0,2500),
            viewport: {width: innerWidth, height: innerHeight},
            document: {width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight},
            overflow_x: document.documentElement.scrollWidth > innerWidth + 1,
            focus: document.activeElement && document.activeElement !== document.body
              ? clean(document.activeElement.getAttribute?.('aria-label') || document.activeElement.innerText)
              : ''
          };
        })()"""
        return self.evaluate(script)

    def click(self, target: str) -> bool:
        encoded = json.dumps(target)
        script = f"""(() => {{
          const target={encoded}; let el=null;
          try {{ el=document.querySelector(target); }} catch (_) {{}}
          if (!el) el=[...document.querySelectorAll('button,a,[role=button]')].find(x => (x.innerText||x.getAttribute('aria-label')||'').trim().includes(target));
          if (!el) return false; el.click(); return true;
        }})()"""
        clicked = bool(self.evaluate(script))
        if clicked:
            time.sleep(0.3)
        return clicked

    def fill(self, target: str, value: str) -> bool:
        encoded_target = json.dumps(target)
        encoded_value = json.dumps(value)
        script = f"""(() => {{
          const target={encoded_target}; let el=null;
          try {{ el=document.querySelector(target); }} catch (_) {{}}
          if (!el) el=[...document.querySelectorAll('input,textarea')].find(x => (x.getAttribute('aria-label')||x.getAttribute('placeholder')||'').includes(target));
          if (!el) return false; el.focus(); el.value={encoded_value};
          el.dispatchEvent(new Event('input',{{bubbles:true}})); el.dispatchEvent(new Event('change',{{bubbles:true}})); return true;
        }})()"""
        return bool(self.evaluate(script))

    def screenshot(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        result = self.call("Page.captureScreenshot", {"format": "png", "fromSurface": True})
        path.write_bytes(base64.b64decode(result["data"]))

    def errors(self) -> dict[str, list[str]]:
        self.evaluate("void 0")
        return {
            "console_errors": self._console_errors[-20:],
            "page_errors": self._page_errors[-20:],
        }

    def close(self) -> None:
        if self._socket is not None:
            try:
                self._socket.close()
            except OSError:
                pass
        if self._process is not None and self._process.poll() is None:
            self._process.terminate()
        self._socket = None
        self._process = None


class VisionClient:
    def __init__(self, model: str) -> None:
        self.model = model

    def inspect(
        self,
        screenshot: Path,
        visual_brief: dict[str, Any],
        page_summary: dict[str, Any],
    ) -> dict[str, Any]:
        image = base64.b64encode(screenshot.read_bytes()).decode("ascii")
        prompt = (
            "Act as a product UI reviewer. Inspect the actual screenshot against the compact visual brief. "
            "Evaluate product fit, hierarchy, visual intentionality, usability, spacing/typography/surfaces, "
            "brand accent, and visible interaction states. Minimal must not mean unstyled. Do not request random "
            "decoration. Return only JSON: {status:'PASS'|'FAIL',summary:string,findings:string[]}.\n"
            f"VISUAL_BRIEF={json.dumps(visual_brief, ensure_ascii=False, separators=(',', ':'))}\n"
            f"PAGE_SUMMARY={json.dumps(page_summary, ensure_ascii=False, separators=(',', ':'))[:6000]}"
        )
        payload = {
            "model": self.model,
            "temperature": 0,
            "max_tokens": 1_600,
            "reasoning_effort": "low",
            "stream": False,
            "response_format": {"type": "json_object"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": "data:image/png;base64," + image,
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
        }
        try:
            response = requests.post(
                BASE_URL.rstrip("/") + "/chat/completions",
                headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
                json=payload,
                timeout=120,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            if isinstance(content, list):
                content = "".join(
                    str(item.get("text", "")) for item in content if isinstance(item, dict)
                )
            if not isinstance(content, str):
                content = json.dumps(content)
            decoder = json.JSONDecoder()
            for index, character in enumerate(content):
                if character == "{":
                    try:
                        value, _ = decoder.raw_decode(content[index:])
                        value["usage"] = response.json().get("usage", {})
                        return value
                    except (json.JSONDecodeError, TypeError):
                        continue
            raise ValueError("Vision response did not contain JSON.")
        except (requests.RequestException, ValueError, KeyError, IndexError) as exc:
            return {
                "status": "NOT_VERIFIED",
                "summary": f"Screenshot could not be inspected by the vision model: {exc}",
                "findings": [],
            }


class BrowserInspectTool(BaseTool):
    name: str = "browser_inspect"
    description: str = (
        "Inspect and interact with the real localhost UI. Navigate, set viewport, inspect bounded page structure, "
        "click/fill controls, capture screenshots, read errors, or run visual_check. visual_check sends the real "
        "screenshot to the role's vision model and returns only a concise report plus artifact path."
    )
    args_schema: type[BaseModel] = BrowserInput
    _project_root: Path = PrivateAttr()
    _artifact_root: Path = PrivateAttr()
    _server: DevServerManager = PrivateAttr()
    _browser: ChromeSession = PrivateAttr()
    _vision: VisionClient = PrivateAttr()
    _visual_brief: dict[str, Any] = PrivateAttr()
    _max_visual_checks: int = PrivateAttr()
    _visual_checks: int = PrivateAttr(default=0)
    _evidence: list[dict[str, Any]] = PrivateAttr(default_factory=list)
    _usage: dict[str, int] = PrivateAttr(default_factory=dict)
    _lock: threading.RLock = PrivateAttr(default_factory=threading.RLock)

    def __init__(
        self,
        project_root: Path,
        artifact_root: Path,
        model: str,
        visual_brief: dict[str, Any],
        *,
        max_visual_checks: int,
        server_config: BrowserConfig | None = None,
    ) -> None:
        super().__init__()
        self._project_root = project_root.resolve()
        self._artifact_root = artifact_root.resolve()
        self._server = DevServerManager(project_root, artifact_root, server_config)
        self._browser = ChromeSession(artifact_root)
        self._vision = VisionClient(model)
        self._visual_brief = visual_brief
        self._max_visual_checks = max_visual_checks
        self._visual_checks = 0
        self._evidence = []
        self._usage = {
            "requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "cached_prompt_tokens": 0,
        }
        self._lock = threading.RLock()

    @property
    def evidence(self) -> list[dict[str, Any]]:
        return list(self._evidence)

    @property
    def usage(self) -> dict[str, int]:
        return dict(self._usage)

    def _local_url(self, target: str) -> str:
        base = self._server.ensure_ready()
        url = urljoin(base.rstrip("/") + "/", target or "/")
        parsed = urlparse(url)
        base_parsed = urlparse(base)
        if parsed.scheme not in {"http", "https"} or parsed.hostname not in {
            "127.0.0.1",
            "localhost",
        }:
            raise RuntimeError("Browser navigation is restricted to localhost.")
        if parsed.port != base_parsed.port:
            raise RuntimeError("Browser navigation must stay on the configured app port.")
        return url

    def _artifact_path(self, name: str) -> Path:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-")[:80] or "visual"
        return self._artifact_root / "visual" / f"{safe}.png"

    def _relative(self, path: Path) -> str:
        return path.relative_to(self._project_root).as_posix()

    def _persist_report(self) -> None:
        report_path = self._artifact_root / "visual" / "visual-report.json"
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps({"scenarios": self._evidence}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _run(
        self,
        action: str,
        target: str = "",
        value: str = "",
        width: int = 1440,
        height: int = 900,
        name: str = "visual",
    ) -> str:
        # CrewAI may dispatch independent tool calls concurrently. CDP is stateful,
        # so one browser session must serialize navigation, viewport, and capture.
        with self._lock:
            return self._run_locked(action, target, value, width, height, name)

    def _run_locked(
        self,
        action: str,
        target: str = "",
        value: str = "",
        width: int = 1440,
        height: int = 900,
        name: str = "visual",
    ) -> str:
        try:
            if action == "ensure_server":
                return json.dumps({"status": "READY", "url": self._server.ensure_ready()})
            if action == "navigate":
                url = self._local_url(target)
                self._browser.navigate(url)
                return json.dumps({"status": "OK", "url": url})
            if action == "set_viewport":
                self._browser.viewport(width, height)
                return json.dumps({"status": "OK", "viewport": [width, height]})
            if action == "inspect_page":
                if target:
                    self._browser.navigate(self._local_url(target))
                return json.dumps(self._browser.inspect(), ensure_ascii=False)[:MAX_BROWSER_TEXT]
            if action == "click":
                return json.dumps({"status": "OK" if self._browser.click(target) else "NOT_FOUND"})
            if action == "fill":
                return json.dumps({"status": "OK" if self._browser.fill(target, value) else "NOT_FOUND"})
            if action == "errors":
                return json.dumps(self._browser.errors(), ensure_ascii=False)[:MAX_BROWSER_TEXT]
            if action in {"screenshot", "visual_check"}:
                if target or self._browser._socket is None:
                    self._browser.navigate(self._local_url(target))
                self._browser.viewport(width, height)
                path = self._artifact_path(f"{name}-{width}x{height}")
                self._browser.screenshot(path)
                if action == "screenshot":
                    return json.dumps({"status": "OK", "screenshot": self._relative(path)})
                if self._visual_checks >= self._max_visual_checks:
                    return json.dumps(
                        {"status": "LIMIT_REACHED", "message": "Visual refinement/check limit reached."}
                    )
                self._visual_checks += 1
                page = self._browser.inspect()
                errors = self._browser.errors()
                vision = self._vision.inspect(path, self._visual_brief, page)
                usage = vision.pop("usage", {})
                self._usage["requests"] += 1
                self._usage["prompt_tokens"] += int(usage.get("prompt_tokens", 0) or 0)
                self._usage["completion_tokens"] += int(usage.get("completion_tokens", 0) or 0)
                prompt_details = usage.get("prompt_tokens_details", {}) or {}
                self._usage["cached_prompt_tokens"] += int(
                    usage.get("cached_prompt_tokens", prompt_details.get("cached_tokens", 0)) or 0
                )
                status = vision.get("status", "NOT_VERIFIED")
                if errors["page_errors"] or errors["console_errors"] or page.get("overflow_x"):
                    status = "FAIL"
                evidence = {
                    "name": name,
                    "url": page.get("url"),
                    "viewport": [width, height],
                    "status": status,
                    "screenshot": self._relative(path),
                    "overflow_detected": bool(page.get("overflow_x")),
                    "console_errors": errors["console_errors"],
                    "page_errors": errors["page_errors"],
                    "summary": str(vision.get("summary", ""))[:600],
                    "findings": [str(item)[:300] for item in vision.get("findings", [])[:5]],
                }
                self._evidence.append(evidence)
                self._persist_report()
                return json.dumps(evidence, ensure_ascii=False)[:MAX_BROWSER_TEXT]
            return json.dumps({"status": "ERROR", "message": f"Unsupported action: {action}"})
        except Exception as exc:
            evidence = {
                "name": name,
                "status": "NOT_VERIFIED",
                "summary": str(exc)[:1_000],
                "findings": [],
            }
            if action == "visual_check":
                self._evidence.append(evidence)
                self._persist_report()
            return json.dumps(evidence, ensure_ascii=False)

    def close(self) -> None:
        self._browser.close()
        self._server.close()
