from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from crew.engineering import (
    AgentBundle,
    EngineeringRunner,
    ImplementationReport,
    LeadBrief,
    ReviewResult,
    VerificationResult,
    VisualBrief,
    VisualScenario,
    _model_from_agent_output,
    _run_command,
    classify_verification,
    create_agents,
)
from crew.llms import architect_llm, implementer_llm, reviewer_llm
from crew.main import HaiKieuFlow, PROJECT_ROOT, TASK_FILE
from crew.state import HaiKieuFlowState
from crew.workspace import (
    ChangeTracker,
    ProjectCommandTool,
    WorkspaceBoundaryError,
    WorkspaceEditTool,
    WorkspaceInspectTool,
    decode_subprocess_output,
    resolve_workspace_path,
    run_captured_process,
)


class FakeAgent:
    def __init__(self, role: str, responses: list[object]) -> None:
        self.role = role
        self.responses = responses
        self.calls = 0
        self.prompts: list[str] = []
        self.tools: list[object] = []
        self.response_formats: list[object | None] = []

    def kickoff(self, prompt: str, **kwargs: object) -> SimpleNamespace:
        self.prompts.append(prompt)
        response_format = kwargs.get("response_format")
        self.response_formats.append(response_format)
        response = self.responses[min(self.calls, len(self.responses) - 1)]
        self.calls += 1
        raw = response if isinstance(response, str) else response.model_dump_json()
        native = response if response_format is not None and not isinstance(response, str) else None
        return SimpleNamespace(raw=raw, pydantic=native, usage_metrics={}, messages=[])


class FakeBrowserTool:
    name = "browser_inspect"

    def __init__(self, results: list[dict[str, object]] | None = None) -> None:
        self._results = list(results or [])
        self.evidence: list[dict[str, object]] = []
        self.calls = 0
        self.closed = False
        self.usage = {
            "requests": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "cached_prompt_tokens": 0,
        }

    def run(self, **_: object) -> str:
        index = min(self.calls, max(0, len(self._results) - 1))
        result = self._results[index] if self._results else {
            "name": "fixture",
            "status": "NOT_VERIFIED",
            "summary": "fixture unavailable",
            "findings": [],
        }
        self.calls += 1
        self.evidence.append(dict(result))
        return json.dumps(result)

    def close(self) -> None:
        self.closed = True


def visual_brief() -> VisualBrief:
    return VisualBrief(
        page_purpose="Record one daily revenue entry in the S1A ledger",
        primary_user="Vietnamese household-business owner",
        primary_action="Record daily revenue",
        information_hierarchy=["Accounting period", "Revenue date", "Amount", "Action"],
        interaction_model="Confirm the date and open period, then record revenue",
        visual_direction="Trustworthy accounting surfaces, strong hierarchy, one blue accent",
        key_states=["normal", "empty", "long content", "narrow viewport"],
        realistic_scenarios=[
            VisualScenario(name="normal", path="/", viewport_width=1280, viewport_height=800),
            VisualScenario(name="narrow", path="/", viewport_width=390, viewport_height=844),
        ],
        avoid=["gratuitous gradients", "dense dashboard chrome"],
    )


class WorkspaceSafetyTests(unittest.TestCase):
    def test_paths_cannot_escape_or_reach_secrets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(WorkspaceBoundaryError):
                resolve_workspace_path(root, "../outside.txt")
            with self.assertRaises(WorkspaceBoundaryError):
                resolve_workspace_path(root, ".env")
            with self.assertRaises(WorkspaceBoundaryError):
                resolve_workspace_path(root, ".git/config")
            with self.assertRaises(WorkspaceBoundaryError):
                resolve_workspace_path(root, "node_modules/pkg/index.js")
            with self.assertRaises(WorkspaceBoundaryError):
                resolve_workspace_path(root, "secrets/service-account.json")

    def test_edit_tool_writes_only_safe_workspace_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            tracker = ChangeTracker()
            tool = WorkspaceEditTool(root, tracker)
            self.assertEqual(
                tool.run(action="write", path="src/example.txt", content="ok"),
                "OK: write src/example.txt",
            )
            self.assertEqual((root / "src/example.txt").read_text(encoding="utf-8"), "ok")
            self.assertEqual(tracker.changed_files, {"src/example.txt"})
            with self.assertRaises(WorkspaceBoundaryError):
                tool.run(action="write", path="../escape.txt", content="no")

    def test_command_tool_rejects_destructive_and_shell_chained_commands(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tool = ProjectCommandTool(Path(directory))
            self.assertIn("rejected", tool.run(command="git reset --hard"))
            self.assertIn("not allowed", tool.run(command="git status; shutdown"))
            self.assertIn("not allowed", tool.run(command="python -c print(1)"))
            self.assertIn("not allowed", tool.run(command="rg --hidden API_KEY ."))
            self.assertIn("repository-wide", tool.run(command="pnpm run format"))
            self.assertIn("explicit scoped paths", tool.run(command="npx prettier --write ."))

    def test_read_ranges_are_bounded_and_truncation_is_explicit(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "long.txt").write_text(
                "\n".join(f"line {index}" for index in range(1, 401)), encoding="utf-8"
            )
            tool = WorkspaceInspectTool(root)
            output = tool.run(action="read", path="long.txt", start_line=20, end_line=25)
            self.assertIn("line 20", output)
            self.assertIn("line 25", output)
            self.assertNotIn("line 26", output)
            self.assertIn("truncated", output)
            self.assertIn("Request another", output)

    def test_search_results_are_bounded_with_file_line_snippets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "matches.txt").write_text(
                "\n".join(f"needle {index}" for index in range(20)), encoding="utf-8"
            )
            output = WorkspaceInspectTool(root).run(
                action="search", path=".", query="needle", limit=3
            )
            self.assertEqual(output.count("matches.txt:"), 3)
            self.assertIn("search truncated at 3 matches", output)

    def test_repository_git_diff_defaults_to_summary(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess = __import__("subprocess")
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / "example.txt").write_text("before\n", encoding="utf-8")
            subprocess.run(["git", "add", "example.txt"], cwd=root, check=True)
            subprocess.run(
                ["git", "-c", "user.name=Fixture", "-c", "user.email=x@y.invalid", "commit", "-qm", "base"],
                cwd=root,
                check=True,
            )
            (root / "example.txt").write_text("after\n", encoding="utf-8")
            output = WorkspaceInspectTool(root).run(action="git_diff", path=".")
            self.assertIn("example.txt", output)
            self.assertIn("changed file path", output)
            self.assertNotIn("-before", output)

    def test_multi_megabyte_targeted_diff_is_bounded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            subprocess = __import__("subprocess")
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / "large.txt").write_text("before\n", encoding="utf-8")
            subprocess.run(["git", "add", "large.txt"], cwd=root, check=True)
            subprocess.run(
                ["git", "-c", "user.name=Fixture", "-c", "user.email=x@y.invalid", "commit", "-qm", "base"],
                cwd=root,
                check=True,
            )
            (root / "large.txt").write_text("x" * 3_000_000, encoding="utf-8")
            output = WorkspaceInspectTool(root).run(action="git_diff", path="large.txt")
            self.assertLess(len(output), 21_000)
            self.assertIn("truncated", output)


class AgentPermissionTests(unittest.TestCase):
    def test_only_implementer_has_write_and_command_tools(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            agents = create_agents(Path(directory), ChangeTracker())
            lead_tools = {tool.name for tool in agents.lead.tools}
            implementer_tools = {tool.name for tool in agents.implementer.tools}
            reviewer_tools = {tool.name for tool in agents.reviewer.tools}
            self.assertEqual(lead_tools, {"workspace_inspect"})
            self.assertEqual(reviewer_tools, {"workspace_inspect"})
            self.assertEqual(
                implementer_tools,
                {"workspace_inspect", "workspace_edit", "project_command"},
            )

    def test_router_aliases_are_migrated_to_haikieu(self) -> None:
        self.assertEqual(architect_llm.model, "haikieu-architect")
        self.assertEqual(implementer_llm.model, "haikieu-implementer")
        self.assertEqual(reviewer_llm.model, "haikieu-reviewer")

    def test_flow_identity_and_repository_paths_are_haikieu(self) -> None:
        self.assertIsInstance(HaiKieuFlow().state, HaiKieuFlowState)
        expected_root = Path(__file__).resolve().parents[3]
        self.assertEqual(PROJECT_ROOT, expected_root)
        self.assertEqual(TASK_FILE, expected_root / ".ai" / "TASK.md")


class CommandRunnerRegressionTests(unittest.TestCase):
    def test_utf8_vietnamese_bytes_decode_without_windows_code_page(self) -> None:
        text = "Kiểm thử tiếng Việt: đường, Nguyễn, hoàn tất"
        self.assertEqual(decode_subprocess_output(text.encode("utf-8")), text)

    def test_invalid_bytes_are_replaced_instead_of_raising(self) -> None:
        decoded = decode_subprocess_output(b"valid\xff\xfeoutput")
        self.assertEqual(decoded, "valid��output")

    def test_none_stdout_and_stderr_are_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            completed = SimpleNamespace(returncode=0, stdout=None, stderr=None)
            with patch("crew.workspace.subprocess.run", return_value=completed):
                result = run_captured_process(["fixture"], cwd=Path(directory), timeout=1)
            self.assertEqual(result.stdout, "")
            self.assertEqual(result.stderr, "")

    def test_windows_command_wrapper_is_resolved_before_launch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            completed = SimpleNamespace(returncode=0, stdout=b"9.0.0", stderr=b"")
            with (
                patch("crew.workspace.shutil.which", return_value=r"C:\tools\pnpm.CMD"),
                patch("crew.workspace.subprocess.run", return_value=completed) as run,
            ):
                result = run_captured_process(["pnpm", "--version"], cwd=Path(directory), timeout=1)
            self.assertEqual(run.call_args.args[0][0], r"C:\tools\pnpm.CMD")
            self.assertEqual(result.stdout, "9.0.0")

    def test_nonzero_exit_code_is_failure_with_unicode_stderr(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = _run_command(
                Path(directory),
                [
                    sys.executable,
                    "-c",
                    "import sys; sys.stderr.buffer.write('lỗi kiểm thử'.encode('utf-8')); raise SystemExit(7)",
                ],
                timeout=10,
            )
            self.assertEqual(result.exit_code, 7)
            self.assertFalse(result.success)
            self.assertIn("lỗi kiểm thử", result.stderr)

    def test_successful_command_preserves_unicode_output(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = _run_command(
                Path(directory),
                [
                    sys.executable,
                    "-c",
                    "import sys; sys.stdout.buffer.write('Thành công ✓'.encode('utf-8'))",
                ],
                timeout=10,
            )
            self.assertEqual(result.exit_code, 0)
            self.assertTrue(result.success)
            self.assertEqual(result.stdout, "Thành công ✓")

    def test_command_with_invalid_output_bytes_still_uses_exit_code(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = _run_command(
                Path(directory),
                [sys.executable, "-c", "import sys; sys.stdout.buffer.write(b'good\\xffbad')"],
                timeout=10,
            )
            self.assertEqual(result.exit_code, 0)
            self.assertTrue(result.success)
            self.assertIn("�", result.stdout)

    def test_project_command_returns_structured_result(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            payload = json.loads(ProjectCommandTool(Path(directory)).run(command="git status"))
            self.assertEqual(
                set(payload),
                {"command", "exit_code", "summary", "success"},
            )
            self.assertEqual(payload["success"], payload["exit_code"] == 0)

    def test_large_command_output_is_concise_and_full_log_is_retrievable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = SimpleNamespace(returncode=0, stdout="x" * 5_000, stderr="")
            with patch("crew.workspace.run_captured_process", return_value=result):
                payload = json.loads(ProjectCommandTool(root).run(command="git status"))
            self.assertLess(len(payload["summary"]), 1_500)
            log_path = root / payload["full_log_path"]
            self.assertTrue(log_path.is_file())
            self.assertEqual(log_path.read_text(encoding="utf-8"), "x" * 5_000)


class ReviewerStructuredOutputTests(unittest.TestCase):
    @staticmethod
    def _runner(root: Path, reviewer: FakeAgent) -> tuple[EngineeringRunner, FakeAgent]:
        task_file = root / "TASK.md"
        task_file.write_text("Review the controlled fixture", encoding="utf-8")
        implementer = FakeAgent(
            "Implementer", [ImplementationReport(summary="controlled implementation")]
        )
        runner = EngineeringRunner(
            root,
            task_file,
            agents=AgentBundle(
                lead=FakeAgent("Engineering Lead", [LeadBrief(objective="controlled fixture")]),
                implementer=implementer,
                reviewer=reviewer,
            ),
            verifier=lambda _: [VerificationResult(command="fixture", exit_code=0)],
        )
        return runner, implementer

    def test_valid_pass_review_result_parses(self) -> None:
        result = _model_from_agent_output(
            '{"verdict":"PASS","summary":"all requirements met","findings":[]}',
            ReviewResult,
        )
        self.assertEqual(result.verdict, "PASS")

    def test_valid_fail_review_result_preserves_findings(self) -> None:
        result = _model_from_agent_output(
            '{"verdict":"FAIL","summary":"defect found","findings":["wrong field mapping"]}',
            ReviewResult,
        )
        self.assertEqual(result.verdict, "FAIL")
        self.assertEqual(result.findings, ["wrong field mapping"])

    def test_invalid_or_arbitrary_prose_never_becomes_pass(self) -> None:
        for raw in (
            "PASS",
            'Review complete: {"verdict":"PASS","summary":"looks fine"}',
            "```json\nnot-json\n```",
        ):
            with self.subTest(raw=raw), self.assertRaises(ValueError):
                _model_from_agent_output(raw, ReviewResult)

    def test_schema_invalid_json_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            _model_from_agent_output(
                '{"verdict":"MAYBE","summary":"uncertain","findings":[]}',
                ReviewResult,
            )

    def test_controlled_pass_fixture_uses_native_response_format(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reviewer = FakeAgent(
                "Independent Reviewer",
                [ReviewResult(verdict="PASS", summary="controlled pass")],
            )
            runner, _ = self._runner(Path(directory), reviewer)
            result = runner._review()
            self.assertEqual(result.verdict, "PASS")
            self.assertEqual(reviewer.response_formats, [ReviewResult])

    def test_controlled_fail_fixture_preserves_actionable_findings(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reviewer = FakeAgent(
                "Independent Reviewer",
                [
                    ReviewResult(
                        verdict="FAIL",
                        summary="controlled rejection",
                        findings=["SKU and product name are still concatenated"],
                    )
                ],
            )
            runner, _ = self._runner(Path(directory), reviewer)
            result = runner._review()
            self.assertEqual(result.verdict, "FAIL")
            self.assertEqual(
                result.findings,
                ["SKU and product name are still concatenated"],
            )

    def test_malformed_first_response_is_corrected_without_implementer_repair(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reviewer = FakeAgent(
                "Independent Reviewer",
                [
                    "I reviewed the change and it passes.",
                    ReviewResult(verdict="PASS", summary="corrected structured pass"),
                ],
            )
            runner, implementer = self._runner(Path(directory), reviewer)
            result = runner.run()
            self.assertEqual(result["status"], "DONE")
            self.assertEqual(reviewer.calls, 2)
            self.assertEqual(implementer.calls, 1)
            self.assertIn("Correct formatting/schema only", reviewer.prompts[1])
            self.assertNotIn("REVIEW CONTRACT", reviewer.prompts[1])

    def test_retry_exhaustion_blocks_without_implementer_repair(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            reviewer = FakeAgent(
                "Independent Reviewer",
                ["not json", "still not json; API_KEY=do-not-log-this"],
            )
            runner, implementer = self._runner(Path(directory), reviewer)
            result = runner.run()
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(reviewer.calls, 2)
            self.assertEqual(implementer.calls, 1)
            self.assertTrue(
                any("did not return valid ReviewResult JSON" in error for error in result["errors"])
            )
            diagnostics = list(
                (Path(directory) / ".ai" / "crew" / "run-artifacts").rglob(
                    "reviewer-attempt-2.json"
                )
            )
            self.assertEqual(len(diagnostics), 1)
            diagnostic = diagnostics[0].read_text(encoding="utf-8")
            self.assertIn('"model": "unknown"', diagnostic)
            self.assertIn('"retry_count": 1', diagnostic)
            self.assertNotIn("do-not-log-this", diagnostic)


class WorkflowTests(unittest.TestCase):
    def _agents(self, verdict: str = "FAIL") -> tuple[AgentBundle, FakeAgent]:
        lead = FakeAgent(
            "Engineering Lead",
            [LeadBrief(objective="fixture", requirements=["edit fixture"])],
        )
        implementer = FakeAgent(
            "Implementer",
            [ImplementationReport(summary="fixture implementation")],
        )
        reviewer = FakeAgent(
            "Independent Reviewer",
            [ReviewResult(verdict=verdict, summary="fixture review", findings=["fixture finding"])],
        )
        return AgentBundle(lead=lead, implementer=implementer, reviewer=reviewer), implementer

    def test_successful_workflow_finishes_done(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Safe fixture task", encoding="utf-8")
            agents, implementer = self._agents(verdict="PASS")
            runner = EngineeringRunner(
                root,
                task_file,
                agents=agents,
                verifier=lambda _: [VerificationResult(command="fixture", exit_code=0, stdout="ok")],
            )
            result = runner.run()
            self.assertEqual(result["status"], "DONE")
            self.assertEqual(result["repair_count"], 0)
            self.assertEqual(implementer.calls, 1)

    def test_lead_marks_known_ui_fixture_and_produces_compact_visual_brief(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Redesign the daily-revenue screen and its mobile state", encoding="utf-8")
            ui_brief = LeadBrief(
                objective="Improve daily-revenue screen",
                requirements=["Preserve behavior"],
                ui_task=True,
                requires_visual_verification=True,
                visual_brief=visual_brief(),
            )
            lead = FakeAgent("Engineering Lead", [ui_brief])
            runner = EngineeringRunner(
                root,
                task_file,
                agents=AgentBundle(
                    lead=lead,
                    implementer=FakeAgent("Implementer", [ImplementationReport(summary="done")]),
                    reviewer=FakeAgent("Independent Reviewer", [ReviewResult(verdict="PASS", summary="ok")]),
                ),
            )
            result = runner._lead(task_file.read_text(encoding="utf-8"))
            compact = runner._compact_brief(result, 50)
            self.assertTrue(compact["ui_task"])
            self.assertTrue(compact["requires_visual_verification"])
            self.assertIsInstance(compact["visual_brief"], dict)
            self.assertLess(len(runner._compact_json(compact)), 6_001)

    def test_non_ui_task_does_not_gain_browser_tools(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Refactor a parser", encoding="utf-8")
            agents, _ = self._agents(verdict="PASS")
            result = EngineeringRunner(
                root,
                task_file,
                agents=agents,
                verifier=lambda _: [VerificationResult(command="fixture", exit_code=0)],
            ).run()
            self.assertEqual(result["status"], "DONE")
            self.assertFalse(any(getattr(tool, "name", "") == "browser_inspect" for tool in agents.implementer.tools))
            self.assertFalse(any(getattr(tool, "name", "") == "browser_inspect" for tool in agents.reviewer.tools))

    def test_ui_implementer_receives_visual_brief_and_browser_capability(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Improve the daily-revenue page", encoding="utf-8")
            agents, implementer = self._agents(verdict="PASS")
            runner = EngineeringRunner(root, task_file, agents=agents)
            runner.state.lead_brief = LeadBrief(
                objective="Improve daily-revenue page",
                ui_task=True,
                requires_visual_verification=True,
                visual_brief=visual_brief(),
            ).model_dump()
            implementer_browser = FakeBrowserTool()
            reviewer_browser = FakeBrowserTool()
            runner._implementer_browser = implementer_browser  # type: ignore[assignment]
            runner._reviewer_browser = reviewer_browser  # type: ignore[assignment]
            agents.implementer.tools.append(implementer_browser)
            agents.reviewer.tools.append(reviewer_browser)
            runner._implement()
            self.assertIn("visual_brief", implementer.prompts[0])
            self.assertIn("browser_inspect", implementer.prompts[0])
            self.assertIn("browser_inspect", {getattr(tool, "name", "") for tool in agents.reviewer.tools})
            self.assertEqual({getattr(tool, "name", "") for tool in agents.reviewer.tools}, {"browser_inspect"})

    def test_visual_self_review_allows_only_one_refinement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Improve the daily-revenue page", encoding="utf-8")
            agents, implementer = self._agents(verdict="PASS")
            runner = EngineeringRunner(root, task_file, agents=agents)
            runner.state.lead_brief = LeadBrief(
                objective="Improve daily-revenue page",
                ui_task=True,
                requires_visual_verification=True,
                visual_brief=visual_brief(),
            ).model_dump()
            browser = FakeBrowserTool([
                {"name": "normal", "status": "FAIL", "findings": ["Weak hierarchy"]},
                {"name": "normal", "status": "FAIL", "findings": ["Still weak"]},
            ])
            runner._implementer_browser = browser  # type: ignore[assignment]
            runner._visual_self_review()
            runner._visual_self_review()
            self.assertEqual(runner.state.visual_refinement_count, 1)
            self.assertEqual(implementer.calls, 1)
            self.assertEqual(browser.calls, 2)
            self.assertNotIn("data:image", json.dumps(runner.state.browser_evidence))

    def test_missing_or_unverified_visual_evidence_cannot_pass(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Improve the daily-revenue page", encoding="utf-8")
            agents, _ = self._agents(verdict="PASS")
            runner = EngineeringRunner(root, task_file, agents=agents)
            runner.state.lead_brief = LeadBrief(
                objective="Improve daily-revenue page",
                ui_task=True,
                requires_visual_verification=True,
                visual_brief=visual_brief(),
            ).model_dump()
            runner._implementer_browser = FakeBrowserTool([
                {"name": "normal", "status": "NOT_VERIFIED", "summary": "vision unavailable"}
            ])  # type: ignore[assignment]
            runner._reviewer_browser = FakeBrowserTool()  # type: ignore[assignment]
            runner._implementer_browser.run()
            review = runner._enforce_visual_review(
                ReviewResult(verdict="PASS", summary="source looks correct", visual_status="PASS")
            )
            self.assertEqual(review.verdict, "FAIL")
            self.assertEqual(review.visual_status, "NOT_VERIFIED")
            self.assertTrue(any("visual verification" in finding for finding in review.findings))

    def test_passing_independent_visual_evidence_allows_visual_pass(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Improve the daily-revenue page", encoding="utf-8")
            agents, _ = self._agents(verdict="PASS")
            runner = EngineeringRunner(root, task_file, agents=agents)
            runner.state.lead_brief = LeadBrief(
                objective="Improve daily-revenue page",
                ui_task=True,
                requires_visual_verification=True,
                visual_brief=visual_brief(),
            ).model_dump()
            passed = {"name": "normal", "status": "PASS", "screenshot": ".ai/crew/run-artifacts/a.png"}
            runner._implementer_browser = FakeBrowserTool([passed])  # type: ignore[assignment]
            runner._reviewer_browser = FakeBrowserTool([passed])  # type: ignore[assignment]
            runner._implementer_browser.run()
            runner._reviewer_browser.run()
            review = runner._enforce_visual_review(
                ReviewResult(
                    verdict="PASS",
                    summary="looks good",
                    functional_status="PASS",
                    product_status="PASS",
                    usability_status="PASS",
                    visual_status="PASS",
                )
            )
            self.assertEqual(review.verdict, "PASS")
            self.assertEqual(review.visual_status, "PASS")
            self.assertEqual(review.visual_evidence, [".ai/crew/run-artifacts/a.png"])

    def test_browser_usage_is_accounted_once_per_role(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("UI fixture", encoding="utf-8")
            agents, _ = self._agents(verdict="PASS")
            runner = EngineeringRunner(root, task_file, agents=agents)
            implementer_browser = FakeBrowserTool()
            reviewer_browser = FakeBrowserTool()
            implementer_browser.usage.update({"requests": 2, "prompt_tokens": 1200, "completion_tokens": 80})
            reviewer_browser.usage.update({"requests": 1, "prompt_tokens": 700, "completion_tokens": 50})
            runner._implementer_browser = implementer_browser  # type: ignore[assignment]
            runner._reviewer_browser = reviewer_browser  # type: ignore[assignment]
            runner._sync_browser_evidence()
            runner._sync_browser_evidence()
            self.assertEqual(runner.state.context_usage["implementer"]["requests"], 2)
            self.assertEqual(runner.state.context_usage["implementer"]["prompt_tokens"], 1200)
            self.assertEqual(runner.state.context_usage["reviewer"]["completion_tokens"], 50)

    def test_structured_output_accepts_exact_fenced_json(self) -> None:
        raw = '```json\n{"verdict":"PASS","summary":"Ổn định","findings":[]}\n```'
        result = _model_from_agent_output(raw, ReviewResult)
        self.assertEqual(result.verdict, "PASS")
        self.assertEqual(result.summary, "Ổn định")

    def test_unchanged_pre_existing_failure_finishes_with_warnings(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Safe fixture task", encoding="utf-8")
            agents, implementer = self._agents(verdict="PASS")
            diagnostic = f"{root / 'legacy.tsx'}\n  1:1  error  Existing issue  fixture/rule"
            runner = EngineeringRunner(
                root,
                task_file,
                agents=agents,
                verifier=lambda _: [
                    VerificationResult(command="lint", exit_code=1, stdout=diagnostic)
                ],
            )
            result = runner.run()
            self.assertEqual(result["status"], "DONE_WITH_WARNINGS")
            self.assertEqual(result["repair_count"], 0)
            self.assertEqual(implementer.calls, 1)
            self.assertEqual(
                result["verification_results"][0]["classification"],
                "PRE_EXISTING_WARNING",
            )

    def test_command_that_passed_at_baseline_and_then_fails_blocks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Safe fixture task", encoding="utf-8")
            agents, implementer = self._agents(verdict="PASS")
            calls = 0

            def verifier(_: Path) -> list[VerificationResult]:
                nonlocal calls
                calls += 1
                exit_code = 0 if calls == 1 else 1
                return [VerificationResult(command="lint", exit_code=exit_code, stderr="new failure")]

            result = EngineeringRunner(root, task_file, agents=agents, verifier=verifier).run()
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(result["repair_count"], 2)
            self.assertEqual(implementer.calls, 3)

    def test_new_or_changed_file_diagnostics_are_regressions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            legacy = root / "legacy.tsx"
            changed = root / "changed.tsx"
            baseline = [
                VerificationResult(
                    command="lint",
                    exit_code=1,
                    stdout=f"{legacy}\n  1:1  error  Existing issue  fixture/rule",
                )
            ]
            final = [
                VerificationResult(
                    command="lint",
                    exit_code=1,
                    stdout=(
                        f"{legacy}\n  1:1  error  Existing issue  fixture/rule\n"
                        f"{changed}\n  2:1  error  New issue  fixture/rule"
                    ),
                )
            ]
            result = classify_verification(root, baseline, final, ["changed.tsx"])
            self.assertEqual(result[0].classification, "NEW_REGRESSION")
            self.assertTrue(result[0].blocking)

            same_file_new_error = [
                VerificationResult(
                    command="lint",
                    exit_code=1,
                    stdout=(
                        f"{legacy}\n  1:1  error  Existing issue  fixture/rule\n"
                        "  3:1  error  Additional issue  fixture/other-rule"
                    ),
                )
            ]
            self.assertTrue(
                classify_verification(root, baseline, same_file_new_error, [])[0].blocking
            )
            unchanged_but_relevant = [
                VerificationResult(command="lint", exit_code=1, stdout=baseline[0].stdout)
            ]
            self.assertTrue(
                classify_verification(root, baseline, unchanged_but_relevant, ["legacy.tsx"])[0].blocking
            )

    def test_repair_loop_has_hard_maximum_of_two(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Safe fixture task", encoding="utf-8")
            agents, implementer = self._agents(verdict="FAIL")
            runner = EngineeringRunner(
                root,
                task_file,
                agents=agents,
                verifier=lambda _: [VerificationResult(command="fixture", exit_code=1, stderr="failed")],
            )
            result = runner.run()
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(result["repair_count"], 2)
            self.assertEqual(implementer.calls, 3)

    def test_reviewer_finding_drives_one_compact_repair_then_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("Fix the two-file fixture", encoding="utf-8")
            lead = FakeAgent("Engineering Lead", [LeadBrief(objective="fix fixture")])
            implementer = FakeAgent(
                "Implementer",
                [ImplementationReport(summary="initial"), ImplementationReport(summary="repaired")],
            )
            reviewer = FakeAgent(
                "Independent Reviewer",
                [
                    ReviewResult(
                        verdict="FAIL",
                        summary="intentional fixture defect found",
                        findings=["second file still uses the old result"],
                    ),
                    ReviewResult(verdict="PASS", summary="defect repaired"),
                ],
            )
            runner = EngineeringRunner(
                root,
                task_file,
                agents=AgentBundle(lead=lead, implementer=implementer, reviewer=reviewer),
                verifier=lambda _: [VerificationResult(command="fixture", exit_code=0)],
            )
            result = runner.run()
            self.assertEqual(result["status"], "DONE")
            self.assertEqual(result["repair_count"], 1)
            self.assertEqual(implementer.calls, 2)
            self.assertIn("second file still uses the old result", implementer.prompts[1])
            self.assertNotIn("intentional fixture defect found", implementer.prompts[1])

    def test_role_prompts_pass_references_and_contracts_not_transcripts(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            full_task_marker = "FULL_TASK_ONLY_FOR_LEAD_" + ("x" * 2_000)
            task_file = root / "TASK.md"
            task_file.write_text(full_task_marker, encoding="utf-8")
            lead = FakeAgent(
                "Engineering Lead",
                [LeadBrief(objective="compact", requirements=["required"])],
            )
            implementer = FakeAgent(
                "Implementer",
                [ImplementationReport(summary="IMPLEMENTER_TRANSCRIPT_SENTINEL")],
            )
            reviewer = FakeAgent(
                "Independent Reviewer",
                [ReviewResult(verdict="PASS", summary="reviewed")],
            )
            runner = EngineeringRunner(
                root,
                task_file,
                agents=AgentBundle(lead=lead, implementer=implementer, reviewer=reviewer),
                verifier=lambda _: [VerificationResult(command="fixture", exit_code=0)],
            )
            runner.run()
            self.assertIn(full_task_marker, lead.prompts[0])
            self.assertNotIn(full_task_marker, implementer.prompts[0])
            self.assertNotIn(full_task_marker, reviewer.prompts[0])
            self.assertNotIn("IMPLEMENTER_TRANSCRIPT_SENTINEL", reviewer.prompts[0])

    def test_reviewer_gets_no_automatic_raw_diff_and_keeps_visual_gate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("UI fixture", encoding="utf-8")
            agents, _ = self._agents(verdict="PASS")
            runner = EngineeringRunner(root, task_file, agents=agents)
            runner.state.task_path = "TASK.md"
            runner.state.lead_brief = LeadBrief(
                objective="UI fixture", ui_requirements=["narrow viewport"]
            ).model_dump()
            runner.state.changed_files = ["ui.py"]
            runner.state.browser_evidence = [{"scenario": "narrow", "path": "artifacts/narrow.png"}]
            raw_diff_marker = "RAW_GIT_DIFF_SHOULD_NOT_BE_IN_PROMPT"
            (root / "ui.py").write_text(raw_diff_marker, encoding="utf-8")
            runner._review()
            reviewer = agents.reviewer
            self.assertNotIn(raw_diff_marker, reviewer.prompts[0])
            self.assertIn("artifacts/narrow.png", reviewer.prompts[0])
            self.assertIn("normal/long/empty/narrow", reviewer.prompts[0])

    def test_repair_context_contains_findings_not_previous_conversation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            task_file = root / "TASK.md"
            task_file.write_text("fixture", encoding="utf-8")
            agents, _ = self._agents()
            runner = EngineeringRunner(root, task_file, agents=agents)
            runner.state.repair_count = 1
            runner.state.changed_files = ["src/a.py"]
            runner.state.verification_results = [
                {"command": "test", "classification": "NEW_REGRESSION", "diagnostics": "assertion failed"}
            ]
            runner.state.review = {
                "verdict": "FAIL",
                "summary": "PREVIOUS_REVIEW_CONVERSATION",
                "findings": ["handle empty input"],
            }
            prompt = runner._repair_context()
            self.assertIn("handle empty input", prompt)
            self.assertIn("assertion failed", prompt)
            self.assertNotIn("PREVIOUS_REVIEW_CONVERSATION", prompt)

    def test_agents_have_finite_role_specific_iteration_limits_and_no_memory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            agents = create_agents(Path(directory), ChangeTracker())
            self.assertEqual((agents.lead.max_iter, agents.implementer.max_iter, agents.reviewer.max_iter), (12, 28, 16))
            self.assertTrue(all(agent.memory in (None, False) for agent in (agents.lead, agents.implementer, agents.reviewer)))
            self.assertTrue(all(agent.respect_context_window for agent in (agents.lead, agents.implementer, agents.reviewer)))


if __name__ == "__main__":
    unittest.main()
