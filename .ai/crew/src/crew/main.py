#!/usr/bin/env python

import sys
from pathlib import Path

from crewai.flow import Flow, start

from crew.engineering import EngineeringRunner
from crew.state import HaiKieuFlowState


AI_DIR = Path(__file__).resolve().parents[3]
PROJECT_ROOT = AI_DIR.parent
TASK_FILE = AI_DIR / "TASK.md"


def _configure_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8", errors="replace")


class HaiKieuFlow(Flow[HaiKieuFlowState]):
    @start()
    def execute_engineering_workflow(self) -> dict[str, object]:
        runner = EngineeringRunner(
            project_root=PROJECT_ROOT,
            task_file=TASK_FILE,
            state=self.state,
        )
        return runner.run()


def run_flow() -> dict[str, object]:
    _configure_console()
    return HaiKieuFlow().kickoff()


def kickoff() -> None:
    run_flow()


def plot() -> None:
    HaiKieuFlow().plot("haikieu_engineering_flow")


def run_with_trigger() -> None:
    run_flow()


if __name__ == "__main__":
    kickoff()
