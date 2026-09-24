from __future__ import annotations

import json

from crew.engineering import EngineeringRunner, LeadBrief, VisualBrief, VisualScenario


def main() -> None:
    task = "Improve the daily-revenue entry UI while preserving behavior. " * 300
    brief = LeadBrief(
        objective="Create a polished, responsive S1A daily-revenue experience",
        requirements=["Preserve behavior", "Use existing product patterns", "No horizontal overflow"],
        acceptance_criteria=["Normal, long, empty, and narrow states render correctly"],
        ui_task=True,
        requires_visual_verification=True,
        visual_brief=VisualBrief(
            page_purpose="Record one daily revenue entry in the S1A ledger",
            primary_user="Vietnamese household-business owner",
            primary_action="Record daily revenue",
            information_hierarchy=["Accounting period", "Revenue date", "Amount", "Action"],
            interaction_model="Confirm the date and open period, then record revenue",
            visual_direction="Trustworthy accounting surfaces, clear type hierarchy, restrained blue accent",
            key_states=["normal", "long", "empty", "narrow"],
            realistic_scenarios=[
                VisualScenario(name="normal", path="/s1a/revenue"),
                VisualScenario(name="long", path="/s1a/revenue?state=long"),
                VisualScenario(name="empty", path="/s1a/revenue?state=empty"),
                VisualScenario(name="narrow", path="/s1a/revenue", viewport_width=390, viewport_height=844),
            ],
            avoid=["gratuitous gradients", "dense dashboard chrome"],
        ),
    )
    evidence = [
        {
            "stage": stage,
            "name": scenario,
            "status": "PASS",
            "screenshot": f".ai/crew/run-artifacts/run/{stage}/{scenario}.png",
            "summary": "Rendered without overflow; hierarchy and primary action are clear.",
            "findings": [],
        }
        for stage in ("implementer", "reviewer")
        for scenario in ("normal", "long", "empty", "narrow")
    ]
    legacy = json.dumps(
        {
            "task_for_every_role": [task, task, task],
            "raw_screenshot_base64": "A" * 3_000_000,
            "visual_notes": evidence,
        }
    )
    optimized = json.dumps(
        {
            "contract": EngineeringRunner._compact_brief(brief, len(task)),
            "evidence_references": evidence,
        },
        separators=(",", ":"),
    )
    result = {
        "fixture": "representative-ui-context",
        "legacy_characters": len(legacy),
        "optimized_characters": len(optimized),
        "estimated_legacy_tokens": len(legacy) // 4,
        "estimated_optimized_tokens": len(optimized) // 4,
        "reduction_percent": round((1 - len(optimized) / len(legacy)) * 100, 2),
        "inline_image_payload_in_optimized": "data:image" in optimized or "A" * 100 in optimized,
    }
    print("VISUAL_CONTEXT_BENCHMARK_JSON=" + json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
