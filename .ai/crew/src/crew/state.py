from typing import Literal

from pydantic import BaseModel, Field


class HaiKieuFlowState(BaseModel):
    task_path: str = ""
    lead_brief: dict[str, object] = Field(default_factory=dict)
    verification_results: list[dict[str, object]] = Field(default_factory=list)
    browser_evidence: list[dict[str, object]] = Field(default_factory=list)
    review: dict[str, object] = Field(default_factory=dict)
    context_usage: dict[str, dict[str, int]] = Field(default_factory=dict)
    visual_refinement_count: int = 0
    repair_count: int = 0
    status: Literal["RUNNING", "DONE", "DONE_WITH_WARNINGS", "BLOCKED"] = "RUNNING"
    changed_files: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
