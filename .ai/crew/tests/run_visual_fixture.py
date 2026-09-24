from __future__ import annotations

import argparse
import json
import socket
import subprocess
import sys
import uuid
from pathlib import Path

from crew.browser import BrowserConfig
from crew.engineering import (
    EngineeringRunner,
    LeadBrief,
    ReviewResult,
    VisualBrief,
    VisualScenario,
    create_agents,
)
from crew.workspace import ChangeTracker


CREW_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = CREW_ROOT / "run-artifacts"


def _port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _command(command: list[str], root: Path) -> None:
    subprocess.run(command, cwd=root, check=True, capture_output=True)


def _create_project(*, broken: bool) -> Path:
    label = "failure" if broken else "success"
    root = ARTIFACT_ROOT / f"real-agent-{label}-{uuid.uuid4().hex[:8]}"
    root.mkdir(parents=True)
    if broken:
        markup = """<!doctype html><html><head><meta charset="utf-8"><title>HaiKieu fixture</title>
<style>body{margin:0;font-family:Arial;background:#fff;color:#777}.shell{width:1800px;padding:12px}.row{display:flex;gap:4px}.card{border:1px solid #eee;padding:8px}button{background:#ddd;border:0;padding:6px}</style></head>
<body><main class="shell"><h1>Ghi nhận doanh thu</h1><div class="row"><section class="card"><h2>Doanh thu hôm nay</h2><p>Chưa có dữ liệu</p><button>Ghi nhận</button></section><section class="card"><h2>Trạng thái sổ</h2><p>Tháng 09/2026 đang mở</p><button>Xem sổ S1A</button></section></div></main></body></html>"""
        task = "Review the intentionally unresolved UI defect in index.html. Do not edit it."
    else:
        markup = """<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HaiKieu fixture</title>
<style>body{font-family:Arial;margin:0}.wrap{padding:16px}.revenue{display:flex}.panel{padding:10px;border:1px solid #ddd}</style></head>
<body><main class="wrap"><p>HẢI KIỀU · SỔ DOANH THU S1A</p><h1>Ghi nhận doanh thu hàng ngày</h1><p>Mỗi ngày một dòng doanh thu, diễn giải được tạo tự động.</p><section class="revenue"><article class="panel"><h2>Doanh thu ngày 23/09/2026</h2><p>Chưa có dữ liệu cho ngày này</p><button data-testid="record-revenue">Ghi nhận doanh thu</button></article><article class="panel"><h2>Kỳ kế toán</h2><p>Tháng 09/2026 · Đang mở</p></article></section></main></body></html>"""
        task = """Redesign index.html as a polished, production-quality HaiKieu S1A daily-revenue page while preserving all existing Vietnamese copy and data-testid values.

Use the existing static HTML/CSS only; do not add dependencies. Follow the practical accounting-app patterns visible in the fixture: establish a clear S1A hierarchy, restrained blue brand accent, grouped form/status surfaces, legible typography and spacing, useful hover/focus states, and a prominent revenue-entry action. Keep the experience calm, trustworthy, and task-focused. Support normal desktop, long-content, empty, and 390px-wide scenarios without horizontal overflow. Use the URL query `state=long` and `state=empty` to render realistic long-description and no-record variants with small inline JavaScript. Verify the actual rendered page in the browser at `/index.html`, `/index.html?state=long`, and `/index.html?state=empty`."""
    (root / "index.html").write_text(markup, encoding="utf-8")
    (root / "TASK.md").write_text(task, encoding="utf-8")
    _command(["git", "init", "-q"], root)
    _command(["git", "add", "index.html", "TASK.md"], root)
    _command(
        ["git", "-c", "user.name=Fixture", "-c", "user.email=fixture@invalid", "commit", "-qm", "fixture"],
        root,
    )
    return root


def _browser_config(port: int) -> BrowserConfig:
    return BrowserConfig(
        app_url=f"http://127.0.0.1:{port}",
        server_command=[sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        ready_timeout=20,
    )


def run_success() -> dict[str, object]:
    root = _create_project(broken=False)
    runner = EngineeringRunner(root, root / "TASK.md", browser_config=_browser_config(_port()))
    result = runner.run()
    return {
        "fixture": "success",
        "project": str(root),
        "status": result["status"],
        "visual_status": result.get("review", {}).get("visual_status"),
        "visual_refinement_count": result.get("visual_refinement_count"),
        "repair_count": result.get("repair_count"),
        "changed_files": result.get("changed_files"),
        "evidence": result.get("browser_evidence"),
        "context_usage": result.get("context_usage"),
        "errors": result.get("errors"),
    }


def run_failure() -> dict[str, object]:
    root = _create_project(broken=True)
    tracker = ChangeTracker()
    runner = EngineeringRunner(
        root,
        root / "TASK.md",
        agents=create_agents(root, tracker),
        browser_config=_browser_config(_port()),
    )
    runner.state.task_path = "TASK.md"
    runner.state.lead_brief = LeadBrief(
        objective="Independently review the intentionally defective S1A revenue page",
        requirements=["Do not edit files", "Reject horizontal overflow and weak visual hierarchy"],
        acceptance_criteria=["Reviewer opens the real page at a narrow viewport", "Visual defect is rejected"],
        ui_task=True,
        requires_visual_verification=True,
        visual_brief=VisualBrief(
            page_purpose="Record one daily revenue entry in HaiKieu's S1A workflow",
            primary_user="Vietnamese household-business owner",
            primary_action="Record daily revenue",
            information_hierarchy=["Accounting period", "Revenue date", "Amount", "Primary action"],
            interaction_model="Confirm the date and period status, then record revenue",
            visual_direction="Trustworthy accounting surface, clear hierarchy, restrained blue accent",
            key_states=["normal", "narrow viewport"],
            realistic_scenarios=[
                VisualScenario(name="narrow", path="/index.html", viewport_width=390, viewport_height=844)
            ],
            avoid=["horizontal overflow", "flat ungrouped content", "indistinct actions"],
        ),
    ).model_dump()
    runner._enable_browser_tools()
    assert runner._implementer_browser is not None
    runner._implementer_browser._evidence = [
        {
            "name": "fixture-prior-check",
            "status": "PASS",
            "screenshot": "fixture-prior-check.png",
            "summary": "Synthetic prior implementer claim; reviewer must independently verify.",
            "findings": [],
        }
    ]
    try:
        assert runner._reviewer_browser is not None
        runner._ensure_visual_evidence(runner._reviewer_browser, "reviewer")
        runner._sync_browser_evidence()
        review = runner._enforce_visual_review(runner._review())
        runner.state.review = review.model_dump()
        runner._sync_browser_evidence()
        return {
            "fixture": "failure",
            "project": str(root),
            "verdict": review.verdict,
            "visual_status": review.visual_status,
            "findings": review.findings,
            "evidence": runner.state.browser_evidence,
            "context_usage": runner.state.context_usage,
        }
    finally:
        runner._close_browser_tools()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("success", "failure"))
    args = parser.parse_args()
    result = run_success() if args.mode == "success" else run_failure()
    result_path = Path(str(result["project"])) / "fixture-result.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("FIXTURE_RESULT=" + json.dumps(result, ensure_ascii=False))
    if args.mode == "success" and result["status"] not in {"DONE", "DONE_WITH_WARNINGS"}:
        raise SystemExit(1)
    if args.mode == "failure" and result["verdict"] != "FAIL":
        raise SystemExit(1)
