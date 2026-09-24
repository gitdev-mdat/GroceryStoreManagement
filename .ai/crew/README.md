# HaiKieu Engineering Crew

This CrewAI Flow turns the task in `../TASK.md` into a bounded autonomous engineering run.

The deterministic sequence is:

1. Engineering Lead inspects the repository and creates a structured brief.
2. Implementer inspects and edits the repository using protected workspace tools.
3. The Flow runs `git diff --check` plus existing `lint`, `typecheck`, and `test` scripts when present.
4. Independent Reviewer inspects the actual files and diff and returns a structured PASS or FAIL.
5. Verification or review failures return to the Implementer for at most two repair cycles.
6. The Flow prints a concise DONE or BLOCKED report.

For UI work, the Lead also emits a compact `VisualBrief`. Only then does the Flow attach a
localhost-only browser tool to the Implementer and Reviewer. The Implementer renders realistic
desktop/mobile/content states and may receive one visual refinement pass. The Reviewer gets a
separate browser session and vision check; a UI run cannot pass when reviewer evidence is absent,
failed, or `NOT_VERIFIED`. Screenshots and concise JSON reports are stored below
`.ai/crew/run-artifacts/`, which is ignored by Git. Browser processes and development servers are
closed after each run; a server that was already running is never terminated by the Flow.

The Lead and Reviewer receive inspection tools only. The Implementer is the only agent with edit and project-command tools. All tools resolve the HaiKieu repository root as `C:\WorkSpace VSC\WorkSpace VSC\HaiKieu` and protect secrets, `.git`, dependencies, build output, and archived AI data.

## Normal usage

```powershell
cd 'C:\WorkSpace VSC\WorkSpace VSC\HaiKieu\.ai\crew'
crewai run
```

The only normal human input is `C:\WorkSpace VSC\WorkSpace VSC\HaiKieu\.ai\TASK.md`.

## Safe local validation

```powershell
uv run python -m compileall -q src tests
uv run python -m unittest discover -s tests -v
uv run python -m crew.smoke_9router
```

The unit tests use temporary fixture repositories and mocked agents; they never execute the real task. The
9Router smoke command is intentionally separate: it requires the external `haikieu-*` aliases to have been
created in 9Router and is not a prerequisite for validating this repository-only migration.

The opt-in real-agent visual fixtures operate only in ignored artifact repositories:

```powershell
uv run python tests\run_visual_fixture.py success
uv run python tests\run_visual_fixture.py failure
```

The success fixture must finish `DONE`/`DONE_WITH_WARNINGS` with independent visual `PASS`; the
failure fixture contains intentional mobile overflow and must be rejected by the Reviewer.
