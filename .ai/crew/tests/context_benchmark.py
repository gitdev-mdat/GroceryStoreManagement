from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from crew.engineering import AgentBundle, EngineeringRunner, VerificationResult, create_agents
from crew.workspace import ChangeTracker, run_captured_process


class MeteredAgent:
    def __init__(self, agent: Any, role_key: str, records: list[dict[str, Any]]) -> None:
        self._agent = agent
        self.role = agent.role
        self.tools = agent.tools
        self.role_key = role_key
        self.records = records

    def kickoff(self, prompt: str, *args: Any, **kwargs: Any) -> Any:
        output = self._agent.kickoff(prompt, *args, **kwargs)
        messages = getattr(output, "messages", []) or []
        self.records.append(
            {
                "role": self.role_key,
                "prompt_characters": len(prompt),
                "usage": getattr(output, "usage_metrics", None) or {},
                "message_count": len(messages),
                "tool_calls": sum(
                    len(message["tool_calls"])
                    if isinstance(message.get("tool_calls"), list)
                    else 1
                    for message in messages
                    if message.get("role") == "assistant" and message.get("tool_calls")
                ),
                "iterations": max(1, sum(1 for message in messages if message.get("role") == "assistant")),
            }
        )
        return output


def _write_fixture(root: Path) -> Path:
    (root / "src").mkdir()
    (root / "tests").mkdir()
    (root / "src" / "pricing.py").write_text(
        "def total_cents(unit_cents: int, quantity: int) -> int:\n"
        "    return unit_cents * quantity\n",
        encoding="utf-8",
    )
    (root / "src" / "receipt.py").write_text(
        "from .pricing import total_cents\n\n"
        "def receipt_line(unit_cents: int, quantity: int) -> str:\n"
        "    return f'Total: {total_cents(unit_cents, quantity)} cents'\n",
        encoding="utf-8",
    )
    (root / "tests" / "test_pricing.py").write_text(
        "import unittest\n"
        "from src.pricing import total_cents\n"
        "from src.receipt import receipt_line\n\n"
        "class PricingTests(unittest.TestCase):\n"
        "    def test_regular_quantity(self):\n"
        "        self.assertEqual(total_cents(250, 3), 750)\n\n"
        "    def test_bulk_discount(self):\n"
        "        self.assertEqual(total_cents(250, 10), 2250)\n\n"
        "    def test_receipt(self):\n"
        "        self.assertEqual(receipt_line(250, 10), 'Total after discount: 2250 cents')\n",
        encoding="utf-8",
    )
    task = root / "TASK.md"
    task.write_text(
        "Implement a 10% bulk discount when quantity is 10 or more. "
        "Keep integer-cent arithmetic. Update the receipt label to say "
        "'Total after discount' only when the discount applies. Preserve the existing API, "
        "change both relevant source files, and make all tests pass.\n",
        encoding="utf-8",
    )
    subprocess.run(["git", "init", "-q"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.email", "fixture@example.invalid"], cwd=root, check=True)
    subprocess.run(["git", "config", "user.name", "Context Fixture"], cwd=root, check=True)
    subprocess.run(["git", "add", "."], cwd=root, check=True)
    subprocess.run(["git", "commit", "-qm", "fixture baseline"], cwd=root, check=True)
    return task


def _verify(root: Path) -> list[VerificationResult]:
    result = run_captured_process(
        ["python", "-m", "unittest", "discover", "-s", "tests"],
        cwd=root,
        timeout=60,
    )
    return [
        VerificationResult(
            command="python -m unittest discover -s tests",
            exit_code=result.returncode,
            stdout=result.stdout,
            stderr=result.stderr,
        )
    ]


def main() -> None:
    records: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="crew-context-fixture-") as directory:
        root = Path(directory)
        task = _write_fixture(root)
        tracker = ChangeTracker()
        actual = create_agents(root, tracker)
        agents = AgentBundle(
            lead=MeteredAgent(actual.lead, "lead", records),
            implementer=MeteredAgent(actual.implementer, "implementer", records),
            reviewer=MeteredAgent(actual.reviewer, "reviewer", records),
        )
        runner = EngineeringRunner(root, task, agents=agents, verifier=_verify)
        runner.tracker = tracker
        result = runner.run()

        totals: dict[str, dict[str, int]] = {}
        for record in records:
            role = record["role"]
            summary = totals.setdefault(
                role,
                {
                    "requests": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "cached_prompt_tokens": 0,
                    "tool_calls": 0,
                    "iterations": 0,
                    "prompt_characters": 0,
                },
            )
            usage = record["usage"]
            summary["requests"] += int(usage.get("successful_requests", 0) or 0)
            summary["prompt_tokens"] += int(usage.get("prompt_tokens", 0) or 0)
            summary["completion_tokens"] += int(usage.get("completion_tokens", 0) or 0)
            summary["cached_prompt_tokens"] += int(usage.get("cached_prompt_tokens", 0) or 0)
            summary["tool_calls"] += record["tool_calls"]
            summary["iterations"] += record["iterations"]
            summary["prompt_characters"] += record["prompt_characters"]

        print(
            "CONTEXT_BENCHMARK_JSON="
            + json.dumps(
                {
                    "status": result["status"],
                    "repair_count": result["repair_count"],
                    "changed_files": result["changed_files"],
                    "roles": totals,
                    "executions": records,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )


if __name__ == "__main__":
    main()
