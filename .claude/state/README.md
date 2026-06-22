# .claude/state/

SQLite-backed structured state — complement to the markdown KB.

## What lives here

| File         | What                                |
| ------------ | ----------------------------------- |
| `schema.sql` | DB schema (committed)               |
| `triage.db`  | SQLite DB (gitignored — local only) |

## Role split

| Markdown `kb/`                                  | SQLite `triage.db`                                    |
| ----------------------------------------------- | ----------------------------------------------------- |
| Durable knowledge: decisions, analyses, signals | Ephemeral/structured: run log, triage queue, verdicts |
| Agent-writable, human-reviewed                  | Written by harness scripts, queried by CLI            |
| Source of truth for _what we know_              | Source of truth for _what happened_                   |

## CLI

```sh
bun scripts/triage.ts                        # list pending runs + open signals
bun scripts/triage.ts review <id>            # mark run reviewed
bun scripts/triage.ts dismiss <id>           # dismiss without review
bun scripts/triage.ts log --type goal \      # write a run record (called by harness)
  --label "my-goal cycle 1" \
  --verdict PASS --reward 4.2 \
  --cycle-log /abs/path/CYCLE_LOG.md
bun scripts/triage.ts signal <run-id> \      # attach a signal to a run
  --category decision --message "needs X"
```

## Wiring the harness

After checker returns, the goal loop writes a run record:

```bash
bun scripts/triage.ts log \
  --type goal \
  --label "<goal-name> cycle <N>" \
  --verdict <PASS|ITERATE|PLATEAU> \
  --reward <X.X> \
  --cycle-log <abs-path-to-CYCLE_LOG.md> \
  --needs-review <0|1>
```

`--needs-review 1` on PLATEAU or any open signals that need a decision.
