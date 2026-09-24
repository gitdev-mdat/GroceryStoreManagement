from __future__ import annotations

import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Sequence

from crewai.tools import BaseTool
from pydantic import BaseModel, Field, PrivateAttr


MAX_OUTPUT = 20_000
DEFAULT_READ_LINES = 250
DEFAULT_LIST_ENTRIES = 200
DEFAULT_SEARCH_RESULTS = 40
PROTECTED_PARTS = {".git", ".venv", "__pycache__", "node_modules", ".next", "credentials", "secrets"}
PROTECTED_FILES = {
    ".npmrc",
    ".pypirc",
    "credentials.json",
    "secrets.json",
    "id_rsa",
    "id_ed25519",
}
SECRET_SUFFIXES = {".key", ".pem", ".p12", ".pfx"}


class WorkspaceBoundaryError(ValueError):
    pass


@dataclass(frozen=True)
class CapturedProcess:
    returncode: int
    stdout: str
    stderr: str


def decode_subprocess_output(value: bytes | str | None) -> str:
    """Normalize subprocess output without relying on the Windows code page."""
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value


def run_captured_process(
    command: Sequence[str],
    *,
    cwd: Path,
    timeout: int,
) -> CapturedProcess:
    """Capture bytes and decode as UTF-8 so malformed output cannot crash a run."""
    environment = os.environ.copy()
    environment["PYTHONIOENCODING"] = "utf-8"
    environment["PYTHONUTF8"] = "1"
    environment["NO_COLOR"] = "1"
    arguments = list(command)
    if arguments:
        resolved_executable = (
            sys.executable
            if Path(arguments[0]).name.lower().removesuffix(".exe") == "python"
            else shutil.which(arguments[0])
        )
        if resolved_executable:
            arguments[0] = resolved_executable
    completed = subprocess.run(
        arguments,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=False,
        timeout=timeout,
        check=False,
        env=environment,
    )
    return CapturedProcess(
        returncode=completed.returncode,
        stdout=decode_subprocess_output(completed.stdout),
        stderr=decode_subprocess_output(completed.stderr),
    )


class ChangeTracker:
    def __init__(self) -> None:
        self.changed_files: set[str] = set()

    def record(self, relative_path: str) -> None:
        self.changed_files.add(relative_path.replace("\\", "/"))


def resolve_workspace_path(project_root: Path, requested: str = ".") -> tuple[Path, str]:
    root = project_root.resolve()
    candidate = (root / requested).resolve()
    try:
        relative = candidate.relative_to(root)
    except ValueError as exc:
        raise WorkspaceBoundaryError("Path is outside PROJECT_ROOT") from exc

    relative_text = relative.as_posix()
    lowered_parts = {part.lower() for part in relative.parts}
    name = candidate.name.lower()
    if lowered_parts & PROTECTED_PARTS:
        raise WorkspaceBoundaryError("Path is protected")
    if name == ".env" or name.startswith(".env."):
        raise WorkspaceBoundaryError("Environment files are protected")
    if name in PROTECTED_FILES or candidate.suffix.lower() in SECRET_SUFFIXES:
        raise WorkspaceBoundaryError("Credential and secret files are protected")
    if relative_text.startswith(".ai/legacy/") or relative_text.startswith(".ai/archive/"):
        raise WorkspaceBoundaryError("Archived AI data is protected")
    return candidate, relative_text


def _trim(value: str, limit: int = MAX_OUTPUT) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + f"\n... truncated {len(value) - limit} characters"


def _bounded_lines(
    value: str,
    *,
    start_line: int = 1,
    end_line: int | None = None,
    max_lines: int = DEFAULT_READ_LINES,
    max_characters: int = MAX_OUTPUT,
) -> str:
    lines = value.splitlines()
    total = len(lines)
    start_index = min(start_line - 1, total)
    requested_end = end_line if end_line is not None else start_line + max_lines - 1
    end_index = min(requested_end, start_index + max_lines, total)
    selected = "\n".join(lines[start_index:end_index])
    character_truncated = len(selected) > max_characters
    if character_truncated:
        selected = selected[:max_characters]
    if start_index > 0 or end_index < total or character_truncated:
        shown_end = start_index + selected.count("\n") + (1 if selected else 0)
        selected += (
            f"\n... truncated; showing lines {start_line}-{shown_end} of {total}. "
            "Request another start_line/end_line range for more."
        )
    return selected


class InspectInput(BaseModel):
    action: Literal["list", "read", "search", "git_status", "git_diff"]
    path: str = Field(default=".", description="Repository-relative path")
    query: str = Field(default="", description="Search expression for the search action")
    depth: int = Field(default=2, ge=0, le=4)
    start_line: int = Field(default=1, ge=0)
    end_line: int | None = Field(default=None, ge=0)
    limit: int = Field(
        default=0,
        ge=0,
        le=500,
        description="Optional result/entry/line limit; 0 uses the safe action default",
    )


class WorkspaceInspectTool(BaseTool):
    name: str = "workspace_inspect"
    description: str = (
        "Inspect the repository safely. Actions: list directories, read a text file, "
        "search text with bounded snippets, inspect git status, or inspect git diff. Read supports "
        "start_line/end_line; search/list results are bounded. git_diff with path='.' returns only "
        "a changed-file summary, while a file path returns a bounded targeted diff. Paths are relative "
        "to the project root; secrets and generated/protected folders are blocked."
    )
    args_schema: type[BaseModel] = InspectInput
    _project_root: Path = PrivateAttr()

    def __init__(self, project_root: Path) -> None:
        super().__init__()
        self._project_root = project_root.resolve()

    def _run(
        self,
        action: str,
        path: str = ".",
        query: str = "",
        depth: int = 2,
        start_line: int = 1,
        end_line: int | None = None,
        limit: int = 0,
    ) -> str:
        start_line = max(1, start_line)
        end_line = end_line or None
        target, relative = resolve_workspace_path(self._project_root, path)
        if action == "read":
            if not target.is_file():
                return f"ERROR: not a file: {relative}"
            try:
                return _bounded_lines(
                    target.read_text(encoding="utf-8"),
                    start_line=start_line,
                    end_line=end_line,
                    max_lines=limit or DEFAULT_READ_LINES,
                    max_characters=MAX_OUTPUT,
                )
            except UnicodeDecodeError:
                return "ERROR: binary or non-UTF-8 file"

        if action == "list":
            if not target.is_dir():
                return f"ERROR: not a directory: {relative}"
            base_depth = len(target.parts)
            entries: list[str] = []
            for current, dirs, files in os.walk(target):
                current_path = Path(current)
                dirs[:] = sorted(
                    item for item in dirs
                    if item.lower() not in PROTECTED_PARTS
                    and not item.lower().startswith(".env")
                    and not (
                        current_path == self._project_root / ".ai"
                        and item.lower() in {"legacy", "archive"}
                    )
                )
                level = len(current_path.parts) - base_depth
                if level > depth:
                    dirs[:] = []
                    continue
                for directory in dirs:
                    entries.append((current_path / directory).relative_to(self._project_root).as_posix() + "/")
                for filename in sorted(files):
                    file_path = current_path / filename
                    try:
                        resolve_workspace_path(
                            self._project_root,
                            file_path.relative_to(self._project_root).as_posix(),
                        )
                    except WorkspaceBoundaryError:
                        continue
                    entries.append(file_path.relative_to(self._project_root).as_posix())
                entry_limit = limit or DEFAULT_LIST_ENTRIES
                if len(entries) >= entry_limit:
                    entries = entries[:entry_limit]
                    entries.append(
                        f"... listing truncated at {entry_limit} entries; narrow path or depth for more"
                    )
                    break
            return "\n".join(entries) or "(empty)"

        if action == "search":
            if not query:
                return "ERROR: query is required"
            result = run_captured_process(
                [
                    "rg", "--json", "-n", "--hidden",
                    "--glob", "!.git/**", "--glob", "!node_modules/**",
                    "--glob", "!.next/**", "--glob", "!.ai/crew/.venv/**",
                    "--glob", "!.ai/crew/.env", "--glob", "!.ai/legacy/**",
                    "--glob", "!.ai/archive/**", query, str(target),
                ],
                cwd=self._project_root,
                timeout=60,
            )
            if result.returncode not in (0, 1):
                return _trim(f"ERROR ({result.returncode}):\n{result.stderr}")
            result_limit = limit or DEFAULT_SEARCH_RESULTS
            matches: list[str] = []
            seen: set[tuple[str, int]] = set()
            for raw_line in result.stdout.splitlines():
                try:
                    event = json.loads(raw_line)
                except json.JSONDecodeError:
                    continue
                if event.get("type") != "match":
                    continue
                data = event.get("data", {})
                path_text = data.get("path", {}).get("text", "")
                line_number = int(data.get("line_number", 0) or 0)
                try:
                    match_path = Path(path_text).resolve()
                    match_relative = match_path.relative_to(self._project_root).as_posix()
                    resolve_workspace_path(self._project_root, match_relative)
                except (ValueError, WorkspaceBoundaryError):
                    continue
                key = (match_relative, line_number)
                if key in seen:
                    continue
                seen.add(key)
                snippet = data.get("lines", {}).get("text", "").strip()
                if match_path.is_file():
                    try:
                        file_lines = match_path.read_text(encoding="utf-8").splitlines()
                        first = max(0, line_number - 2)
                        last = min(len(file_lines), line_number + 1)
                        snippet = "\n".join(
                            f"  {index + 1}: {file_lines[index]}" for index in range(first, last)
                        )
                    except (OSError, UnicodeDecodeError):
                        pass
                matches.append(f"{match_relative}:{line_number}\n{_trim(snippet, 1_000)}")
                if len(matches) >= result_limit:
                    break
            output = "\n\n".join(matches)
            if len(matches) >= result_limit:
                output += (
                    f"\n... search truncated at {result_limit} matches; narrow path/query or raise limit"
                )
            return _trim(output, MAX_OUTPUT) or "(no matches)"

        if action in {"git_status", "git_diff"}:
            if action == "git_status":
                command = ["git", "status", "--short"]
            elif relative in {"", "."}:
                command = ["git", "diff", "--stat"]
            else:
                command = ["git", "diff", "--", relative]
            result = run_captured_process(
                command,
                cwd=self._project_root,
                timeout=60,
            )
            output = result.stdout + result.stderr
            if action == "git_diff" and relative in {"", "."} and output:
                output += "\nUse git_diff with a changed file path to inspect its bounded patch."
            return _bounded_lines(
                output,
                start_line=start_line,
                end_line=end_line,
                max_lines=limit or 400,
                max_characters=MAX_OUTPUT,
            ) or "(no changes)"

        return f"ERROR: unsupported action: {action}"


class EditInput(BaseModel):
    action: Literal["write", "replace", "delete"]
    path: str = Field(description="Repository-relative file path")
    content: str = Field(default="", description="Full content for write, replacement content for replace")
    old_text: str = Field(default="", description="Exact unique text to replace")


class WorkspaceEditTool(BaseTool):
    name: str = "workspace_edit"
    description: str = (
        "Modify project files inside PROJECT_ROOT. Use write for complete file content, "
        "replace for one exact unique replacement, or delete for one file. Protected paths, "
        "secrets, dependencies, build output, legacy data, and outside paths are rejected."
    )
    args_schema: type[BaseModel] = EditInput
    _project_root: Path = PrivateAttr()
    _tracker: ChangeTracker = PrivateAttr()

    def __init__(self, project_root: Path, tracker: ChangeTracker) -> None:
        super().__init__()
        self._project_root = project_root.resolve()
        self._tracker = tracker

    def _atomic_write(self, target: Path, content: str) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary_name = ""
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="utf-8", newline="", delete=False, dir=target.parent
            ) as temporary:
                temporary.write(content)
                temporary_name = temporary.name
            os.replace(temporary_name, target)
        finally:
            if temporary_name and os.path.exists(temporary_name):
                os.unlink(temporary_name)

    def _run(self, action: str, path: str, content: str = "", old_text: str = "") -> str:
        target, relative = resolve_workspace_path(self._project_root, path)
        if action == "write":
            self._atomic_write(target, content)
        elif action == "replace":
            if not target.is_file():
                return f"ERROR: not a file: {relative}"
            if not old_text:
                return "ERROR: old_text is required"
            current = target.read_text(encoding="utf-8")
            if current.count(old_text) != 1:
                return "ERROR: old_text must match exactly once"
            self._atomic_write(target, current.replace(old_text, content, 1))
        elif action == "delete":
            if not target.is_file():
                return f"ERROR: not a file: {relative}"
            target.unlink()
        else:
            return f"ERROR: unsupported action: {action}"
        self._tracker.record(relative)
        return f"OK: {action} {relative}"


class CommandInput(BaseModel):
    command: str = Field(description="One non-interactive development command without shell chaining")
    timeout_seconds: int = Field(default=300, ge=1, le=900)


class ProjectCommandTool(BaseTool):
    name: str = "project_command"
    description: str = (
        "Run one bounded non-interactive development command in PROJECT_ROOT, such as git status/diff, "
        "npm/pnpm checks, tests, lint, typecheck, or build. Shell chaining, traversal, system commands, "
        "and destructive Git/filesystem operations are rejected."
    )
    args_schema: type[BaseModel] = CommandInput
    _project_root: Path = PrivateAttr()

    def __init__(self, project_root: Path) -> None:
        super().__init__()
        self._project_root = project_root.resolve()

    def _result_payload(
        self,
        *,
        command: str,
        exit_code: int,
        stdout: str,
        stderr: str,
    ) -> str:
        success = exit_code == 0
        combined = (stdout + ("\n" if stdout and stderr else "") + stderr).strip()
        limit = 1_200 if success else 6_000
        full_log_path = ""
        if len(combined) > limit:
            artifact_dir = self._project_root / ".ai" / "crew" / "run-artifacts" / "commands"
            artifact_dir.mkdir(parents=True, exist_ok=True)
            log_path = artifact_dir / f"command-{uuid.uuid4().hex}.log"
            log_path.write_text(combined, encoding="utf-8")
            full_log_path = log_path.relative_to(self._project_root).as_posix()
        summary = _bounded_lines(
            combined,
            start_line=max(1, len(combined.splitlines()) - 39),
            max_lines=40,
            max_characters=limit,
        )
        result_data = {
            "command": command,
            "exit_code": exit_code,
            "success": success,
            "summary": summary or ("PASS (no output)" if success else "FAIL (no output)"),
        }
        if full_log_path:
            result_data["full_log_path"] = full_log_path
        return json.dumps(result_data, ensure_ascii=False)

    def _run(self, command: str, timeout_seconds: int = 300) -> str:
        if re.search(r"[;&|><`\r\n]|\$\(", command):
            return "ERROR: shell chaining, redirection, and interpolation are not allowed"
        lowered = command.lower()
        forbidden = (
            "reset --hard", "git clean", "checkout --", "format-volume", "shutdown",
            "restart-computer", "stop-computer", "remove-item", "rm -rf", "rmdir /s",
            "del /s", ".git/", ".git\\", ".env", "credentials", "secrets.json",
        )
        if any(item in lowered for item in forbidden):
            return "ERROR: destructive or protected command rejected"
        try:
            arguments = shlex.split(command, posix=True)
        except ValueError as exc:
            return f"ERROR: invalid command syntax: {exc}"
        if not arguments:
            return "ERROR: empty command"
        executable = Path(arguments[0]).name.lower().removesuffix(".exe").removesuffix(".cmd")
        allowed = {
            "git", "node", "npm", "pnpm", "npx", "python", "uv",
            "pytest", "vitest", "tsc",
        }
        if executable not in allowed:
            return f"ERROR: executable is not allowed: {executable}"
        if executable == "git" and (
            len(arguments) < 2
            or arguments[1].lower() not in {"status", "diff", "show", "log", "ls-files"}
        ):
            return "ERROR: only read-only Git commands are allowed"
        if executable in {"npm", "pnpm"} and len(arguments) > 1:
            blocked_package_actions = {"exec", "dlx", "publish", "unpublish", "config", "set"}
            if arguments[1].lower() in blocked_package_actions:
                return "ERROR: package-manager action is not allowed"
            script = arguments[2].lower() if arguments[1].lower() == "run" and len(arguments) > 2 else arguments[1].lower()
            if script in {"format", "lint:fix"}:
                return "ERROR: repository-wide mutation scripts are not allowed"
        if executable == "npx" and (
            len(arguments) < 2
            or Path(arguments[1]).name.lower() not in {"eslint", "prettier", "tsc", "vitest", "next"}
        ):
            return "ERROR: npx tool is not allowed"
        if executable == "npx" and len(arguments) > 1 and Path(arguments[1]).name.lower() == "prettier":
            targets = [argument for argument in arguments[2:] if not argument.startswith("-")]
            if not targets or any(target in {".", "./", ".\\"} for target in targets):
                return "ERROR: prettier requires explicit scoped paths"
        if executable == "node" and any(item in {"-e", "--eval", "-p", "--print"} for item in arguments[1:]):
            return "ERROR: inline interpreter execution is not allowed"
        if executable == "python" and any(item in {"-c", "-"} for item in arguments[1:]):
            return "ERROR: inline interpreter execution is not allowed"
        if executable == "uv" and (len(arguments) < 2 or arguments[1].lower() != "run"):
            return "ERROR: only uv run is allowed"
        for argument in arguments[1:]:
            if ".." in Path(argument).parts:
                return "ERROR: path traversal is not allowed"
            if re.match(r"^[A-Za-z]:[\\/]", argument) or argument.startswith("\\\\"):
                try:
                    Path(argument).resolve().relative_to(self._project_root)
                except ValueError:
                    return "ERROR: command path is outside PROJECT_ROOT"
        try:
            result = run_captured_process(
                arguments,
                cwd=self._project_root,
                timeout=timeout_seconds,
            )
        except subprocess.TimeoutExpired as exc:
            return self._result_payload(
                command=command,
                exit_code=124,
                stdout=decode_subprocess_output(exc.stdout),
                stderr=f"Timed out after {timeout_seconds}s\n{decode_subprocess_output(exc.stderr)}",
            )
        except OSError as exc:
            return self._result_payload(
                command=command,
                exit_code=127,
                stdout="",
                stderr=f"Unable to start command: {exc}",
            )
        return self._result_payload(
            command=command,
            exit_code=result.returncode,
            stdout=result.stdout,
            stderr=result.stderr,
        )
