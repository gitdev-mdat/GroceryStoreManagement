from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from context_benchmark import MeteredAgent, _verify, _write_fixture
from crew.engineering import (
    AgentBundle,
    EngineeringRunner,
    ImplementationReport,
    LeadBrief,
    ReviewResult,
    create_agents,
)
from crew.workspace import ChangeTracker, run_captured_process


class LegacyTransportRunner(EngineeringRunner):
    """Benchmark-only reproduction of the pre-refactor cross-stage payloads."""

    _legacy_task = ""

    def _lead(self, task: str) -> LeadBrief:
        self._legacy_task = task
        return super()._lead(task)

    def _implement(self, repair_context: str = "") -> ImplementationReport:
        prompt = f"""
Implement the task in the actual repository. You are the only agent allowed to write files.
Inspect any additional context you need, make the smallest complete change, and run useful checks.

TASK:
{self._legacy_task}

ENGINEERING LEAD BRIEF:
{json.dumps(self.state.lead_brief, ensure_ascii=False, indent=2)}

{repair_context}
"""
        return self._execute_structured(
            "implementer", self.agents.implementer, prompt, ImplementationReport
        )  # type: ignore[return-value]

    def _review(self) -> ReviewResult:
        diff_result = run_captured_process(
            ["git", "diff", "--", *self.state.changed_files],
            cwd=self.project_root,
            timeout=60,
        )
        prompt = f"""
Independently review the actual repository after implementation. Judge the real code and diff.
Never modify files.

TASK:
{self._legacy_task}

LEAD BRIEF:
{json.dumps(self.state.lead_brief, ensure_ascii=False, indent=2)}

CHANGED FILES:
{json.dumps(self.state.changed_files, ensure_ascii=False)}

DETERMINISTIC VERIFICATION:
{json.dumps(self.state.verification_results, ensure_ascii=False, indent=2)}

CURRENT GIT DIFF FOR CHANGED FILES:
{diff_result.stdout + diff_result.stderr}
"""
        return self._execute_structured(
            "reviewer", self.agents.reviewer, prompt, ReviewResult
        )  # type: ignore[return-value]


def _make_task_heavy(task_file: Path) -> None:
    matrix = "\n".join(
        f"- Case {index:03d}: for unit price {100 + index} cents, quantities 1-9 keep the gross total; "
        f"quantities 10+ return exactly floor(gross*90/100), and the receipt label changes only at 10."
        for index in range(1, 91)
    )
    task_file.write_text(
        "Implement a 10% bulk discount when quantity is 10 or more. Keep integer-cent arithmetic. "
        "Update the receipt label to say 'Total after discount' only when the discount applies. "
        "Preserve the existing API, change both relevant source files, and make all tests pass.\n\n"
        "Acceptance matrix (intentionally verbose to model a real long TASK.md):\n"
        + matrix,
        encoding="utf-8",
    )
    subprocess.run(["git", "add", "TASK.md"], cwd=task_file.parent, check=True)
    subprocess.run(["git", "commit", "--amend", "--no-edit", "-q"], cwd=task_file.parent, check=True)


def _totals(records: list[dict[str, Any]]) -> dict[str, Any]:
    roles: dict[str, dict[str, int]] = {}
    for record in records:
        usage = record["usage"]
        target = roles.setdefault(
            record["role"],
            {"requests": 0, "prompt_tokens": 0, "completion_tokens": 0, "cached_prompt_tokens": 0},
        )
        target["requests"] += int(usage.get("successful_requests", 0) or 0)
        target["prompt_tokens"] += int(usage.get("prompt_tokens", 0) or 0)
        target["completion_tokens"] += int(usage.get("completion_tokens", 0) or 0)
        target["cached_prompt_tokens"] += int(usage.get("cached_prompt_tokens", 0) or 0)
    total = {
        key: sum(role[key] for role in roles.values())
        for key in ("requests", "prompt_tokens", "completion_tokens", "cached_prompt_tokens")
    }
    return {"roles": roles, "total": total}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("legacy", "optimized"))
    args = parser.parse_args()
    records: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="crew-context-heavy-") as directory:
        root = Path(directory)
        task = _write_fixture(root)
        _make_task_heavy(task)
        tracker = ChangeTracker()
        actual = create_agents(root, tracker)
        agents = AgentBundle(
            lead=MeteredAgent(actual.lead, "lead", records),
            implementer=MeteredAgent(actual.implementer, "implementer", records),
            reviewer=MeteredAgent(actual.reviewer, "reviewer", records),
        )
        runner_type = LegacyTransportRunner if args.mode == "legacy" else EngineeringRunner
        runner = runner_type(root, task, agents=agents, verifier=_verify)
        runner.tracker = tracker
        result = runner.run()
        print(
            "CONTEXT_HEAVY_BENCHMARK_JSON="
            + json.dumps(
                {
                    "mode": args.mode,
                    "task_characters": len(task.read_text(encoding="utf-8")),
                    "status": result["status"],
                    "repair_count": result["repair_count"],
                    **_totals(records),
                },
                sort_keys=True,
            )
        )


if __name__ == "__main__":
    main()
