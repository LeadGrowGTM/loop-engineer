# Context Management: Durable Lifecycle Restart

Before clearing or compacting context, persist `RUN.json`, `GRILL.json`, `BRIEF.md`, and `HARNESS.md`
in the recorded absolute run directory. Emit the lean restart pointer only after all four exist.

The next context starts from the pointer, changes to its absolute run path, reads `RUN.json` and
`HARNESS.md`, and makes `goal-lifecycle validate --run <RUN.json>` its first action. A non-ready
result stops routing and execution; Planner and Maker remain unreachable. Do not recreate state from
conversation memory or select another run location.

After a compact, state the current phase, completed evidence, file in progress, and next action.
