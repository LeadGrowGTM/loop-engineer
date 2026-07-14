# Loop registry (`.harness/loops/`)

Named **templates** for the benchmarking loop (ADR-0005). A template persists only the
**spec** (benchmark + measurement + search + stop + levers/invariants) - not the ledger.
Re-invoking a template starts a **fresh** optimization; it is the reusable, re-pointable
asset you build a library of.

Distinct from a **snapshot** (spec + ledger + best-so-far), which lives in the snapshot
store keyed by `run_id` and is `--resume`d, not re-pointed. See
`docs/benchmarking/snapshot-store.md`. Template = the recipe you re-point. Snapshot =
the in-progress game you resume.

## Layout

```
.harness/loops/
  README.md                       <- this file
  <template-name>.json            <- one named template = one benchmark spec
  email-reply-rate-optimizer.json <- example (below)
```

- `<template-name>` is a kebab slug, unique in this directory.
- Instantiated fresh with `/benchmarking-loop <template-name>` (ADR-0004/0005).
- A template is a benchmark spec (schema: `references/benchmark-intake.md` "Emit") with
  `run_id` omitted - the command assigns a fresh `run_id` at instantiation.

## Template file schema

```json
{
  "name": "<template-name>",
  "description": "<one line - what this optimizer does and what input it re-points at>",
  "spec": {
    "benchmark":   { "flavor": "...", "metric": "...", "direction": "maximize|minimize", "target": null },
    "measurement": { "cadence": "instant|lagging", "command": "...", "settle_window": null },
    "search":      { "mode": "sweep|climb", "candidates": [], "levers": [], "invariants": [] },
    "stop":        { "target": null, "plateau": { "cycles": 3, "min_gain_pct": 1.0 },
                     "budget": { "max_cycles": 10, "max_spend_usd": null, "max_tokens": null } }
  },
  "repoint": ["<field the user supplies at instantiation, e.g. the campaign id or input path>"]
}
```

`repoint` names the parameterized inputs a template expects when re-pointed at new
inputs (e.g. an "email reply-rate optimizer" aimed at a different campaign). Absent =>
the template runs as-is.

## Example (illustrative, not run live)

```json
{
  "name": "email-reply-rate-optimizer",
  "description": "Climb email copy for reply rate on a given campaign; CTA/offer/price frozen.",
  "spec": {
    "benchmark":   { "flavor": "programmatic-kpi", "metric": "reply_rate", "direction": "maximize", "target": 0.08 },
    "measurement": { "cadence": "lagging", "command": null, "settle_window": "72h" },
    "search":      { "mode": "climb",
                     "levers": ["subject_line", "body_copy", "send_time"],
                     "invariants": ["call_to_action", "offer", "price", "factual_claims"] },
    "stop":        { "target": 0.08, "plateau": { "cycles": 3, "min_gain_pct": 1.0 },
                     "budget": { "max_cycles": 12, "max_spend_usd": null, "max_tokens": null } }
  },
  "repoint": ["campaign_id"]
}
```
