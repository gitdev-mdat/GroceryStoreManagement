from __future__ import annotations

import json
import os
import re
import subprocess
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

from crewai import Agent
from pydantic import BaseModel, Field, model_validator

from crew.llms import architect_llm, implementer_llm, reviewer_llm
from crew.browser import BrowserConfig, BrowserInspectTool
from crew.state import HaiKieuFlowState
from crew.workspace import (
    ChangeTracker,
    ProjectCommandTool,
    WorkspaceEditTool,
    WorkspaceInspectTool,
    decode_subprocess_output,
    run_captured_process,
)


MAX_REPAIR_CYCLES = 2
MAX_VISUAL_REFINEMENTS = 1
MAX_REVIEWER_FORMAT_RETRIES = 1
MAX_STRUCTURED_RAW_LOG = 2_000


class VisualScenario(BaseModel):
    name: str
    path: str = "/"
    viewport_width: int = Field(default=1440, ge=320, le=2560)
    viewport_height: int = Field(default=900, ge=320, le=1600)
    interaction: str = ""


class VisualBrief(BaseModel):
    page_purpose: str
    primary_user: str
    primary_action: str
    information_hierarchy: list[str] = Field(default_factory=list)
    interaction_model: str
    visual_direction: str
    key_states: list[str] = Field(default_factory=list)
    realistic_scenarios: list[VisualScenario] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)


class LeadBrief(BaseModel):
    objective: str
    requirements: list[str] = Field(default_factory=list)
    non_goals: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    likely_areas: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    ui_requirements: list[str] = Field(default_factory=list)
    ui_task: bool = False
    requires_visual_verification: bool = False
    visual_brief: VisualBrief | None = None

    @model_validator(mode="after")
    def require_visual_brief_for_ui(self) -> "LeadBrief":
        if self.requires_visual_verification and self.visual_brief is None:
            raise ValueError("visual_brief is required when visual verification is required")
        if self.requires_visual_verification:
            self.ui_task = True
        return self


class ImplementationReport(BaseModel):
    summary: str
    files_touched: list[str] = Field(default_factory=list)
    commands_run: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class ReviewResult(BaseModel):
    verdict: Literal["PASS", "FAIL"]
    summary: str
    findings: list[str] = Field(default_factory=list)
    functional_status: Literal["PASS", "FAIL"] = "PASS"
    product_status: Literal["PASS", "FAIL", "NOT_REQUIRED"] = "NOT_REQUIRED"
    usability_status: Literal["PASS", "FAIL", "NOT_REQUIRED"] = "NOT_REQUIRED"
    visual_status: Literal["PASS", "FAIL", "NOT_REQUIRED", "NOT_VERIFIED"] = "NOT_REQUIRED"
    visual_evidence: list[str] = Field(default_factory=list)


class VerificationResult(BaseModel):
    command: str
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    success: bool = False
    classification: Literal["PASS", "PRE_EXISTING_WARNING", "NEW_REGRESSION"] | None = None
    note: str = ""
    full_log_path: str = ""

    @model_validator(mode="after")
    def set_success_from_exit_code(self) -> "VerificationResult":
        self.success = self.exit_code == 0
        if self.classification is None:
            self.classification = "PASS" if self.success else "NEW_REGRESSION"
        return self

    @property
    def output(self) -> str:
        return (self.stdout + self.stderr).strip()

    @property
    def passed(self) -> bool:
        return self.success

    @property
    def blocking(self) -> bool:
        return self.classification == "NEW_REGRESSION"


@dataclass
class AgentBundle:
    lead: Agent
    implementer: Agent
    reviewer: Agent


def create_agents(project_root: Path, tracker: ChangeTracker) -> AgentBundle:
    inspect_tool = WorkspaceInspectTool(project_root)
    edit_tool = WorkspaceEditTool(project_root, tracker)
    command_tool = ProjectCommandTool(project_root)
    lead = Agent(
        role="Engineering Lead",
        goal="Understand the task and produce a concise, repository-grounded implementation brief",
        backstory=(
            "You are the senior engineering lead for HaiKieu. Inspect the actual repository, identify "
            "the smallest sound approach, and give the implementer an actionable brief. Never modify files."
        ),
        llm=architect_llm,
        tools=[inspect_tool],
        allow_delegation=False,
        verbose=False,
        max_iter=12,
        memory=False,
        respect_context_window=True,
    )
    implementer = Agent(
        role="Implementer",
        goal="Implement the requested change completely and verify your work",
        backstory=(
            "You are the only agent authorized to modify the HaiKieu repository. Inspect real source, "
            "make focused production-quality edits, and run useful bounded development checks."
        ),
        llm=implementer_llm,
        tools=[inspect_tool, edit_tool, command_tool],
        allow_delegation=False,
        verbose=False,
        max_iter=28,
        memory=False,
        respect_context_window=True,
    )
    reviewer = Agent(
        role="Independent Reviewer",
        goal="Independently judge the actual implementation against the task",
        backstory=(
            "You are an independent senior reviewer. Inspect actual files and Git diff, find real defects "
            "or missing requirements, and return a precise PASS or FAIL. Never modify files."
        ),
        llm=reviewer_llm,
        tools=[inspect_tool],
        allow_delegation=False,
        verbose=False,
        max_iter=16,
        memory=False,
        respect_context_window=True,
    )
    return AgentBundle(lead=lead, implementer=implementer, reviewer=reviewer)


def _run_command(project_root: Path, command: list[str], timeout: int = 600) -> VerificationResult:
    display = subprocess.list2cmdline(command)
    try:
        completed = run_captured_process(
            command,
            cwd=project_root,
            timeout=timeout,
        )
        stdout, stderr, log_path = _compact_verification_output(
            project_root, display, completed.stdout, completed.stderr, completed.returncode == 0
        )
        return VerificationResult(
            command=display,
            exit_code=completed.returncode,
            stdout=stdout,
            stderr=stderr,
            full_log_path=log_path,
        )
    except subprocess.TimeoutExpired as exc:
        return VerificationResult(
            command=display,
            exit_code=124,
            stdout=_tail(decode_subprocess_output(exc.stdout)),
            stderr=_tail(
                f"Timed out after {timeout}s\n{decode_subprocess_output(exc.stderr)}"
            ),
        )
    except OSError as exc:
        return VerificationResult(command=display, exit_code=127, stderr=str(exc))


def _tail(value: str, limit: int = 3_000) -> str:
    if len(value) <= limit:
        return value
    return f"... truncated to final {limit} characters\n{value[-limit:]}"


def _compact_verification_output(
    project_root: Path,
    command: str,
    stdout: str,
    stderr: str,
    success: bool,
) -> tuple[str, str, str]:
    limit = 1_200 if success else 6_000
    combined_length = len(stdout) + len(stderr)
    log_path = ""
    if combined_length > limit:
        artifact_dir = project_root / ".ai" / "crew" / "run-artifacts" / "verification"
        artifact_dir.mkdir(parents=True, exist_ok=True)
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", command).strip("-")[:80] or "command"
        candidate = artifact_dir / f"{safe_name}.log"
        suffix = 2
        while candidate.exists():
            candidate = artifact_dir / f"{safe_name}-{suffix}.log"
            suffix += 1
        candidate.write_text(
            f"COMMAND: {command}\n\nSTDOUT:\n{stdout}\n\nSTDERR:\n{stderr}",
            encoding="utf-8",
        )
        log_path = candidate.relative_to(project_root).as_posix()
    return _tail(stdout, limit), _tail(stderr, limit), log_path


def verify_project(project_root: Path) -> list[VerificationResult]:
    results = [_run_command(project_root, ["git", "diff", "--check"], timeout=120)]
    package_file = project_root / "package.json"
    if not package_file.exists():
        return results
    try:
        scripts = json.loads(package_file.read_text(encoding="utf-8")).get("scripts", {})
    except (OSError, json.JSONDecodeError):
        return results
    runner = "pnpm" if (project_root / "pnpm-lock.yaml").exists() else "npm"
    for script in ("lint", "typecheck", "test"):
        if script in scripts:
            results.append(_run_command(project_root, [runner, "run", script], timeout=600))
    return results


_FILE_LINE = re.compile(r"^(?P<path>.+?\.(?:[cm]?[jt]sx?|py))(?::\d+|\(\d+,\d+\))?.*$", re.I)
_ESLINT_DIAGNOSTIC = re.compile(r"^\s*\d+:\d+\s+(?P<severity>error|warning)\s+(?P<message>.+)$", re.I)
_TSC_DIAGNOSTIC = re.compile(
    r"^(?P<path>.+?\.(?:[cm]?[jt]sx?))\(\d+,\d+\):\s*(?P<severity>error|warning)\s+(?P<message>.+)$",
    re.I,
)


def _diagnostics(result: VerificationResult, project_root: Path) -> set[tuple[str, str]]:
    diagnostics: set[tuple[str, str]] = set()
    current_path = ""
    for raw_line in result.output.splitlines():
        line = raw_line.strip()
        typescript = _TSC_DIAGNOSTIC.match(line)
        if typescript:
            if typescript.group("severity").lower() == "error":
                diagnostics.add(
                    (_relative_diagnostic_path(typescript.group("path"), project_root), typescript.group("message"))
                )
            continue
        file_line = _FILE_LINE.match(line)
        if file_line and not line.lower().startswith(("error", "warning")):
            current_path = _relative_diagnostic_path(file_line.group("path"), project_root)
            continue
        diagnostic = _ESLINT_DIAGNOSTIC.match(raw_line)
        if diagnostic and diagnostic.group("severity").lower() == "error":
            diagnostics.add((current_path, diagnostic.group("message").strip()))
    return diagnostics


def _relative_diagnostic_path(value: str, project_root: Path) -> str:
    path = Path(value.strip())
    try:
        path = path.resolve().relative_to(project_root.resolve())
    except ValueError:
        pass
    return path.as_posix().lower()


def classify_verification(
    project_root: Path,
    baseline: list[VerificationResult],
    final: list[VerificationResult],
    changed_files: list[str],
) -> list[VerificationResult]:
    """Separate unchanged repository failures from failures relevant to this run."""
    baseline_by_command = {item.command: item for item in baseline}
    changed = {Path(path).as_posix().lower() for path in changed_files}
    classified: list[VerificationResult] = []
    for result in final:
        if result.success:
            result.classification = "PASS"
            classified.append(result)
            continue
        previous = baseline_by_command.get(result.command)
        if previous is None or previous.success:
            result.classification = "NEW_REGRESSION"
            result.note = "Command passed at baseline or was not present there."
            classified.append(result)
            continue

        before_diagnostics = _diagnostics(previous, project_root)
        after_diagnostics = _diagnostics(result, project_root)
        changed_file_failure = any(path in changed for path, _ in after_diagnostics if path)
        new_diagnostics = after_diagnostics - before_diagnostics
        if changed_file_failure or new_diagnostics:
            result.classification = "NEW_REGRESSION"
            result.note = "New or changed-file diagnostics were introduced."
        elif after_diagnostics or result.output.strip() == previous.output.strip():
            result.classification = "PRE_EXISTING_WARNING"
            result.note = "Same unrelated failure was present before implementation."
        else:
            result.classification = "NEW_REGRESSION"
            result.note = "Failure output changed and could not be safely matched to baseline."
        classified.append(result)
    return classified


class StructuredOutputValidationError(ValueError):
    def __init__(self, message: str, *, output: object, raw: str) -> None:
        super().__init__(message)
        self.output = output
        self.raw = raw


def _structured_output(
    agent: Agent,
    prompt: str,
    model: type[BaseModel],
    *,
    native_response_format: bool = False,
) -> tuple[BaseModel, object]:
    schema = json.dumps(model.model_json_schema(), ensure_ascii=False)
    structured_prompt = f"""{prompt}

Return only one valid JSON object matching this JSON Schema exactly.
Do not wrap it in Markdown and do not add prose outside the JSON object.
SCHEMA:
{schema}
"""
    if native_response_format:
        output = agent.kickoff(structured_prompt, response_format=model)
    else:
        output = agent.kickoff(structured_prompt)
    raw = str(getattr(output, "raw", ""))
    try:
        native = getattr(output, "pydantic", None)
        if native is not None:
            return model.model_validate(native), output
        return _model_from_agent_output(raw, model), output
    except ValueError as exc:
        raise StructuredOutputValidationError(str(exc), output=output, raw=raw) from exc


def _model_from_agent_output(raw: str, model: type[BaseModel]) -> BaseModel:
    """Validate a JSON object, optionally wrapped by one exact Markdown code fence."""
    candidate = raw.strip()
    try:
        return model.model_validate_json(candidate)
    except ValueError as direct_error:
        lines = candidate.splitlines()
        if (
            len(lines) >= 3
            and lines[0].strip().lower() in {"```", "```json"}
            and lines[-1].strip() == "```"
        ):
            fenced = "\n".join(lines[1:-1]).strip()
            return model.model_validate_json(fenced)
        raise direct_error


class EngineeringRunner:
    def __init__(
        self,
        project_root: Path,
        task_file: Path,
        state: HaiKieuFlowState | None = None,
        agents: AgentBundle | None = None,
        verifier: Callable[[Path], list[VerificationResult]] = verify_project,
        browser_config: BrowserConfig | None = None,
    ) -> None:
        self.project_root = project_root.resolve()
        self.task_file = task_file.resolve()
        self.state = state or HaiKieuFlowState()
        self.tracker = ChangeTracker()
        self.agents = agents or create_agents(self.project_root, self.tracker)
        self.verifier = verifier
        self.browser_config = browser_config
        self._context_debug = os.environ.get("CREW_CONTEXT_DEBUG") == "1"
        self._debug_stats: dict[str, dict[str, int]] = {}
        self._run_id = uuid.uuid4().hex[:12]
        self._implementer_browser: BrowserInspectTool | None = None
        self._reviewer_browser: BrowserInspectTool | None = None
        self._reviewer_evidence_offset = 0
        self._browser_usage_accounted: dict[str, dict[str, int]] = {
            "implementer": {},
            "reviewer": {},
        }

    def _load_task(self) -> str:
        if not self.task_file.is_file():
            raise FileNotFoundError(f"TASK.md not found: {self.task_file}")
        task = self.task_file.read_text(encoding="utf-8").strip()
        if not task:
            raise ValueError("TASK.md is empty")
        return task

    def _task_reference(self) -> str:
        try:
            return self.task_file.relative_to(self.project_root).as_posix()
        except ValueError:
            return str(self.task_file)

    @staticmethod
    def _compact_brief(brief: LeadBrief, task_length: int) -> dict[str, object]:
        """Bound routine-task prose while retaining requirements and source references."""
        def compact(item: object) -> object:
            if isinstance(item, str):
                return " ".join(item.split())[:600]
            if isinstance(item, list):
                return [compact(child) for child in item[:12]]
            if isinstance(item, dict):
                return {key: compact(child) for key, child in item.items()}
            return item

        value = compact(brief.model_dump())
        assert isinstance(value, dict)
        budget = 6_000 if brief.requires_visual_verification else (4_000 if task_length > 4_000 else 2_500)
        trim_order = ("likely_areas", "risks", "non_goals", "ui_requirements")
        while len(EngineeringRunner._compact_json(value)) > budget:
            trimmed = False
            for key in trim_order:
                items = value.get(key)
                if isinstance(items, list) and len(items) > 1:
                    items.pop()
                    trimmed = True
                    break
            if not trimmed:
                break
        return value

    @staticmethod
    def _compact_json(value: object) -> str:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))

    def _record_execution(self, role: str, output: object, prompt: str) -> None:
        usage = getattr(output, "usage_metrics", None) or {}
        summary = self.state.context_usage.setdefault(
            role,
            {
                "requests": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "cached_prompt_tokens": 0,
                "tool_calls": 0,
                "iterations": 0,
            },
        )
        summary["requests"] += int(usage.get("successful_requests", 0) or 0)
        summary["prompt_tokens"] += int(usage.get("prompt_tokens", 0) or 0)
        summary["completion_tokens"] += int(usage.get("completion_tokens", 0) or 0)
        summary["cached_prompt_tokens"] += int(usage.get("cached_prompt_tokens", 0) or 0)
        messages = getattr(output, "messages", None) or []
        for message in messages:
            if message.get("role") != "assistant":
                continue
            calls = message.get("tool_calls")
            if calls:
                summary["tool_calls"] += len(calls) if isinstance(calls, list) else 1
        summary["iterations"] += sum(
            1 for message in messages if message.get("role") == "assistant"
        )
        if self._context_debug:
            debug = self._debug_stats.setdefault(
                role,
                {"prompt_characters": 0, "messages": 0, "largest_tool_result": 0},
            )
            debug["prompt_characters"] += len(prompt)
            debug["messages"] += len(messages)
            debug["largest_tool_result"] = max(
                debug["largest_tool_result"],
                max(
                    (
                        len(str(message.get("content", "")))
                        for message in messages
                        if message.get("role") == "tool"
                    ),
                    default=0,
                ),
            )

    def _execute_structured(
        self,
        role: str,
        agent: Agent,
        prompt: str,
        model: type[BaseModel],
        *,
        native_response_format: bool = False,
        format_retries: int = 0,
    ) -> BaseModel:
        current_prompt = prompt
        for attempt in range(format_retries + 1):
            try:
                result, output = _structured_output(
                    agent,
                    current_prompt,
                    model,
                    native_response_format=native_response_format,
                )
            except StructuredOutputValidationError as exc:
                self._record_execution(role, exc.output, current_prompt)
                diagnostic = self._write_structured_diagnostic(
                    role=role,
                    agent=agent,
                    model=model,
                    attempt=attempt + 1,
                    max_attempts=format_retries + 1,
                    error=str(exc),
                    raw=exc.raw,
                )
                if attempt >= format_retries:
                    raise RuntimeError(
                        f"{agent.role} did not return valid {model.__name__} JSON after "
                        f"{format_retries + 1} attempt(s); diagnostic: {diagnostic}"
                    ) from exc
                current_prompt = self._structured_retry_prompt(
                    model=model,
                    error=str(exc),
                    raw=exc.raw,
                )
                continue
            self._record_execution(role, output, current_prompt)
            return result
        raise AssertionError("structured output attempt loop ended unexpectedly")

    @staticmethod
    def _sanitize_structured_text(value: str, limit: int = MAX_STRUCTURED_RAW_LOG) -> str:
        sanitized = re.sub(
            r"(?i)\b(bearer)\s+\S+",
            r"\1 <redacted>",
            value,
        )
        sanitized = re.sub(
            r"(?i)\b(api[_-]?key|token|password|secret)\b\s*[:=]\s*[^\s,;]+",
            r"\1=<redacted>",
            sanitized,
        )
        sanitized = re.sub(r"\bsk-[A-Za-z0-9_-]{8,}\b", "<redacted-key>", sanitized)
        if len(sanitized) > limit:
            return sanitized[:limit] + f"\n... truncated {len(sanitized) - limit} characters"
        return sanitized

    @staticmethod
    def _agent_model_alias(agent: Agent) -> str:
        llm = getattr(agent, "llm", None)
        model = getattr(llm, "model", None)
        if model:
            return str(model)
        if isinstance(llm, str):
            return llm
        return "unknown"

    def _write_structured_diagnostic(
        self,
        *,
        role: str,
        agent: Agent,
        model: type[BaseModel],
        attempt: int,
        max_attempts: int,
        error: str,
        raw: str,
    ) -> str:
        artifact_dir = (
            self.project_root
            / ".ai"
            / "crew"
            / "run-artifacts"
            / self._run_id
            / "structured-output"
        )
        artifact_dir.mkdir(parents=True, exist_ok=True)
        path = artifact_dir / f"{role}-attempt-{attempt}.json"
        payload = {
            "role": role,
            "model": self._agent_model_alias(agent),
            "schema": model.__name__,
            "attempt": attempt,
            "max_attempts": max_attempts,
            "retry_count": attempt - 1,
            "validation_error": self._sanitize_structured_text(error, 1_000),
            "sanitized_raw_output": self._sanitize_structured_text(raw),
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        relative = path.relative_to(self.project_root).as_posix()
        print(
            f"[structured-output] role={role} model={payload['model']} "
            f"attempt={attempt}/{max_attempts} diagnostic={relative}"
        )
        return relative

    def _structured_retry_prompt(
        self,
        *,
        model: type[BaseModel],
        error: str,
        raw: str,
    ) -> str:
        schema = json.dumps(model.model_json_schema(), ensure_ascii=False)
        return f"""
Your previous response contained the intended review result but did not validate as {model.__name__}.
Correct formatting/schema only. Preserve the intended PASS or FAIL verdict and every actionable finding.
Do not inspect the repository again, do not call tools, and do not add commentary.
Return exactly one JSON object matching this schema:
{schema}

VALIDATION ERROR:
{self._sanitize_structured_text(error, 1_000)}

PREVIOUS RESPONSE:
{self._sanitize_structured_text(raw)}
"""

    @staticmethod
    def _verification_contract(results: list[VerificationResult]) -> list[dict[str, object]]:
        contract: list[dict[str, object]] = []
        for item in results:
            row: dict[str, object] = {
                "command": item.command,
                "success": item.success,
                "classification": item.classification,
            }
            if item.note:
                row["note"] = item.note
            if not item.success and item.output:
                row["diagnostics"] = _tail(item.output, 2_000)
            if item.full_log_path:
                row["full_log_path"] = item.full_log_path
            contract.append(row)
        return contract

    def _enable_browser_tools(self) -> None:
        if self._implementer_browser is not None:
            return
        visual_brief = self.state.lead_brief.get("visual_brief")
        if not isinstance(visual_brief, dict):
            return
        artifact_root = self.project_root / ".ai" / "crew" / "run-artifacts" / self._run_id
        self._implementer_browser = BrowserInspectTool(
            self.project_root,
            artifact_root / "implementer",
            "haikieu-implementer",
            visual_brief,
            max_visual_checks=6,
            server_config=self.browser_config,
        )
        self._reviewer_browser = BrowserInspectTool(
            self.project_root,
            artifact_root / "reviewer",
            "haikieu-reviewer",
            visual_brief,
            max_visual_checks=4,
            server_config=self.browser_config,
        )
        self.agents.implementer.tools.append(self._implementer_browser)
        self.agents.reviewer.tools.append(self._reviewer_browser)

    def _visual_required(self) -> bool:
        return bool(self.state.lead_brief.get("requires_visual_verification"))

    def _default_visual_scenario(self) -> tuple[str, str, int, int]:
        visual = self.state.lead_brief.get("visual_brief")
        scenarios = visual.get("realistic_scenarios", []) if isinstance(visual, dict) else []
        scenario = scenarios[0] if scenarios and isinstance(scenarios[0], dict) else {}
        return (
            str(scenario.get("name", "normal")),
            str(scenario.get("path", "/")),
            int(scenario.get("viewport_width", 1440)),
            int(scenario.get("viewport_height", 900)),
        )

    def _ensure_visual_evidence(self, tool: BrowserInspectTool, stage: str) -> None:
        before = len(tool.evidence)
        if before and stage == "implementer":
            return
        name, path, width, height = self._default_visual_scenario()
        tool.run(
            action="visual_check",
            target=path,
            width=width,
            height=height,
            name=f"{stage}-{self.state.repair_count}-{name}",
        )

    def _sync_browser_evidence(self) -> None:
        combined: list[dict[str, object]] = []
        for stage, tool in (
            ("implementer", self._implementer_browser),
            ("reviewer", self._reviewer_browser),
        ):
            if tool is None:
                continue
            for item in tool.evidence:
                compact = {key: value for key, value in item.items() if key != "usage"}
                compact["stage"] = stage
                combined.append(compact)
            current_usage = getattr(tool, "usage", {})
            accounted = self._browser_usage_accounted[stage]
            if current_usage:
                summary = self.state.context_usage.setdefault(
                    stage,
                    {
                        "requests": 0,
                        "prompt_tokens": 0,
                        "completion_tokens": 0,
                        "cached_prompt_tokens": 0,
                        "tool_calls": 0,
                        "iterations": 0,
                    },
                )
                for key in ("requests", "prompt_tokens", "completion_tokens", "cached_prompt_tokens"):
                    current = int(current_usage.get(key, 0) or 0)
                    delta = max(0, current - int(accounted.get(key, 0)))
                    summary[key] += delta
                    accounted[key] = current
        self.state.browser_evidence = combined

    @staticmethod
    def _latest_visual_failures(evidence: list[dict[str, object]]) -> list[dict[str, object]]:
        latest: dict[str, dict[str, object]] = {}
        for item in evidence:
            latest[str(item.get("name", "visual"))] = item
        return [item for item in latest.values() if item.get("status") == "FAIL"]

    def _visual_self_review(self) -> None:
        if not self._visual_required() or self._implementer_browser is None:
            return
        self._ensure_visual_evidence(self._implementer_browser, "implementer")
        self._sync_browser_evidence()
        implementer_evidence = [
            item for item in self.state.browser_evidence if item.get("stage") == "implementer"
        ]
        failures = self._latest_visual_failures(implementer_evidence)
        if not failures or self.state.visual_refinement_count >= MAX_VISUAL_REFINEMENTS:
            return
        self.state.visual_refinement_count += 1
        findings = [
            finding
            for item in failures
            for finding in item.get("findings", [])
            if isinstance(finding, str)
        ][:8]
        prior_count = len(self._implementer_browser.evidence)
        self._implement(
            "\nThis is the single allowed visual refinement pass. Fix only the important product/UI issues "
            "below, then render and call browser_inspect visual_check again. Do not add decorative complexity.\n"
            f"VISUAL FINDINGS: {self._compact_json(findings)}\n"
        )
        if len(self._implementer_browser.evidence) == prior_count:
            name, path, width, height = self._default_visual_scenario()
            self._implementer_browser.run(
                action="visual_check",
                target=path,
                width=width,
                height=height,
                name=f"implementer-refined-{name}",
            )
        self._sync_browser_evidence()

    def _enforce_visual_review(self, review: ReviewResult) -> ReviewResult:
        if not self._visual_required():
            review.visual_status = "NOT_REQUIRED"
            return review
        self._sync_browser_evidence()
        implementer = [
            item for item in self.state.browser_evidence if item.get("stage") == "implementer"
        ]
        all_reviewer = [item for item in self.state.browser_evidence if item.get("stage") == "reviewer"]
        reviewer = all_reviewer[self._reviewer_evidence_offset :]
        self._reviewer_evidence_offset = len(all_reviewer)
        implementer_pass = any(item.get("status") == "PASS" for item in implementer)
        reviewer_pass = any(item.get("status") == "PASS" for item in reviewer)
        reviewer_failed = any(item.get("status") == "FAIL" for item in reviewer)
        evidence_paths = [
            str(item["screenshot"])
            for item in reviewer
            if item.get("screenshot")
        ]
        review.visual_evidence = evidence_paths
        if reviewer_failed:
            review.visual_status = "FAIL"
        elif not reviewer:
            review.visual_status = "NOT_VERIFIED"
        elif not reviewer_pass:
            review.visual_status = "NOT_VERIFIED"
        category_pass = (
            review.functional_status == "PASS"
            and review.product_status == "PASS"
            and review.usability_status == "PASS"
        )
        if not implementer_pass or not reviewer_pass or review.visual_status != "PASS" or not category_pass:
            review.verdict = "FAIL"
            if not implementer_pass:
                review.findings.append("Implementer did not produce passing real visual evidence.")
            if not reviewer_pass:
                review.findings.append("Independent required visual verification is missing or failed.")
            if review.functional_status != "PASS":
                review.findings.append("Functional review did not pass.")
            if review.product_status != "PASS":
                review.findings.append("Product appropriateness was not independently passed.")
            if review.usability_status != "PASS":
                review.findings.append("Usability and aesthetic quality were not independently passed.")
        return review

    def _close_browser_tools(self) -> None:
        for tool in (self._reviewer_browser, self._implementer_browser):
            if tool is not None:
                tool.close()

    def _lead(self, task: str) -> LeadBrief:
        prompt = f"""
Inspect the actual repository before deciding. Produce a compact, repository-grounded engineering contract.
Preserve every material requirement and acceptance criterion, but omit conversational narration. Aim for
1,500-2,500 characters for ordinary tasks and never restate source code. Do not edit files or claim
uninspected evidence. Put hard constraints under requirements and concrete checks under acceptance_criteria.
The complete task is already below, so do not spend a tool call rereading the task file.
Explicitly classify ui_task and requires_visual_verification from product impact, not filenames. Any visible
screen/component/form/navigation/responsive work is a UI task, including mixed backend+UI tasks. For UI tasks,
include a 1,000-2,500 character VisualBrief with 3-5 proportional scenarios and positive direction for
typography, spacing, surface contrast, one controlled brand accent, grouping, interaction states, and progressive
disclosure. Minimal is not unstyled. Inspect and follow HaiKieu's real design system, components, and visual
patterns before external inspiration.

TASK FILE: {self._task_reference()}
TASK CONTENT (Lead only):
{task}
"""
        return self._execute_structured("lead", self.agents.lead, prompt, LeadBrief)  # type: ignore[return-value]

    def _implement(self, repair_context: str = "") -> ImplementationReport:
        prompt = f"""
Implement the engineering contract in the actual repository. You are the only agent allowed to write files.
Use the contract first; read {self._task_reference()} directly with workspace_inspect only if details are unclear.
Inspect on demand, batch independent reads/edits, make the smallest complete change, and run one focused check.
After a passing check, finalize without rereading diffs already inspected during implementation.
Never read or modify protected secrets, .git, dependencies, build output, legacy AI data, or paths outside PROJECT_ROOT.
For a UI task, inspect HaiKieu's existing design system, components, screens, and tokens first; use browser_inspect
on the rendered UI, test the VisualBrief's few realistic scenarios, inspect the actual screenshot with
visual_check, and address important hierarchy/usability issues. At most one later orchestrated visual refinement
pass is allowed.

ENGINEERING CONTRACT:
{self._compact_json(self.state.lead_brief)}

{repair_context}
"""
        return self._execute_structured("implementer", self.agents.implementer, prompt, ImplementationReport)  # type: ignore[return-value]

    def _review(self) -> ReviewResult:
        prompt = f"""
Independently inspect targeted diffs/files; no raw diff or Implementer transcript is preloaded. Read
{self._task_reference()} only if the contract is insufficient. FAIL for actionable defects or unmet requirements.
For UI work, enforce required normal/long/empty/narrow browser evidence. Never modify files.
Batch one targeted git_diff call per changed file in your first tool turn; avoid repository-wide rediscovery.
When visual verification is required, independently use browser_inspect to open the relevant route, reproduce
key scenarios, call visual_check, and inspect console/page errors. Source inspection or Implementer claims alone
cannot produce visual PASS. Evaluate product fit, hierarchy, consistency with HaiKieu's real design system and
components, usability, realistic content, and interaction states; FAIL important aesthetic/usability defects
even when tests pass.

REVIEW CONTRACT:
{self._compact_json(self.state.lead_brief)}

CHANGED FILES:
{self._compact_json(self.state.changed_files)}

VERIFICATION SUMMARY:
{self._compact_json(self.state.verification_results)}

BROWSER EVIDENCE REFERENCES:
{self._compact_json(self.state.browser_evidence)}
"""
        return self._execute_structured(
            "reviewer",
            self.agents.reviewer,
            prompt,
            ReviewResult,
            native_response_format=True,
            format_retries=MAX_REVIEWER_FORMAT_RETRIES,
        )  # type: ignore[return-value]

    def _repair_context(self) -> str:
        failed_verification = [
            result
            for result in self.state.verification_results
            if result.get("classification") == "NEW_REGRESSION"
        ]
        return f"""
This is repair cycle {self.state.repair_count}/{MAX_REPAIR_CYCLES}.
Inspect current repository state and fix every listed issue. Prior transcripts and raw diffs are intentionally
omitted; use targeted inspection because the repository is the source of truth.

CHANGED FILES: {self._compact_json(self.state.changed_files)}
FAILED VERIFICATION: {self._compact_json(failed_verification)}
REVIEWER FINDINGS: {self._compact_json(self.state.review.get('findings', []))}
"""

    def _print_context_usage(self) -> None:
        print("\n========================================")
        print("CONTEXT USAGE")
        print("========================================")
        totals = {key: 0 for key in ("requests", "prompt_tokens", "completion_tokens", "cached_prompt_tokens", "tool_calls", "iterations")}
        for role in ("lead", "implementer", "reviewer"):
            usage = self.state.context_usage.get(role, {})
            if not usage:
                continue
            print(f"{role.title()}:")
            print(
                f"  requests: {usage.get('requests', 0)}, prompt: {usage.get('prompt_tokens', 0)}, "
                f"completion: {usage.get('completion_tokens', 0)}, cached: {usage.get('cached_prompt_tokens', 0)}, "
                f"tool calls: {usage.get('tool_calls', 0)}, iterations: {usage.get('iterations', 0)}"
            )
            for key in totals:
                totals[key] += int(usage.get(key, 0))
        print("TOTAL:")
        print(
            f"  requests: {totals['requests']}, prompt: {totals['prompt_tokens']}, "
            f"completion: {totals['completion_tokens']}, cached: {totals['cached_prompt_tokens']}, "
            f"tool calls: {totals['tool_calls']}, iterations: {totals['iterations']}"
        )
        if self._context_debug and self._debug_stats:
            print("DEBUG:")
            for role, values in self._debug_stats.items():
                print(f"  {role}: {self._compact_json(values)}")
        print("========================================")

    def _print_final_report(self) -> None:
        print("\n========================================")
        print("HAIKIEU ENGINEERING CREW")
        print(f"STATUS: {self.state.status}")
        print("========================================")
        print("\nTask:")
        print(self.state.task_path)
        print("\nChanged files:")
        for path in self.state.changed_files:
            print(f"- {path}")
        if not self.state.changed_files:
            print("- None")
        print("\nVerification:")
        for result in self.state.verification_results:
            status = result.get("classification", "PASS" if result["success"] else "NEW_REGRESSION")
            print(f"- {result['command']}: {status}")
        print("\nReview:")
        print(self.state.review.get("verdict", "NOT COMPLETED"))
        if self.state.review.get("summary"):
            print(self.state.review["summary"])
        if self._visual_required():
            print(f"Visual status: {self.state.review.get('visual_status', 'NOT_VERIFIED')}")
            print(f"Visual refinement passes: {self.state.visual_refinement_count}/{MAX_VISUAL_REFINEMENTS}")
            for evidence in self.state.review.get("visual_evidence", []):
                print(f"- {evidence}")
        if self.state.errors:
            print("\nRemaining blockers:")
            for error in self.state.errors:
                print(f"- {error}")
        if self.state.warnings:
            print("\nWarnings:")
            for warning in self.state.warnings:
                print(f"- {warning}")
        print(f"\nRepair cycles: {self.state.repair_count}")
        print("\n========================================")
        self._print_context_usage()

    def run(self) -> dict[str, object]:
        try:
            print("\n[1] Loading task")
            task = self._load_task()
            self.state.task_path = self._task_reference()

            print("[2] Capturing verification baseline")
            baseline = self.verifier(self.project_root)

            print("[3] Lead analyzing repository")
            brief = self._lead(task)
            self.state.lead_brief = self._compact_brief(brief, len(task))
            if self._visual_required():
                self._enable_browser_tools()

            print("[4] Implementing")
            self._implement()
            self._visual_self_review()

            while True:
                self.state.changed_files = sorted(self.tracker.changed_files)
                print("[5] Verifying")
                verification = classify_verification(
                    self.project_root,
                    baseline,
                    self.verifier(self.project_root),
                    self.state.changed_files,
                )
                self.state.verification_results = self._verification_contract(verification)
                self.state.warnings = [
                    f"Pre-existing verification failure: {item.command}"
                    for item in verification
                    if item.classification == "PRE_EXISTING_WARNING"
                ]
                print("[6] Reviewing")
                if self._visual_required() and self._reviewer_browser is not None:
                    self._ensure_visual_evidence(self._reviewer_browser, "reviewer")
                    self._sync_browser_evidence()
                review = self._review()
                review = self._enforce_visual_review(review)
                self.state.review = review.model_dump()
                verification_blocked = any(item.blocking for item in verification)
                if not verification_blocked and review.verdict == "PASS":
                    self.state.status = "DONE_WITH_WARNINGS" if self.state.warnings else "DONE"
                    break
                if self.state.repair_count >= MAX_REPAIR_CYCLES:
                    self.state.status = "BLOCKED"
                    failed = [item.command for item in verification if item.blocking]
                    if failed:
                        self.state.errors.append("Verification failed: " + ", ".join(failed))
                    self.state.errors.extend(review.findings)
                    break

                self.state.repair_count += 1
                print(f"[7] Repairing {self.state.repair_count}/{MAX_REPAIR_CYCLES}")
                self._implement(self._repair_context())
                self._visual_self_review()

        except Exception as exc:
            self.state.status = "BLOCKED"
            self.state.errors.append(str(exc))
        except BaseException:
            self._close_browser_tools()
            raise

        print("[8] Final result")
        try:
            self._print_final_report()
            return self.state.model_dump()
        finally:
            self._close_browser_tools()
