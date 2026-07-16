# Morning Report Specs

## HTML Summary Page

The goal prompt instructs the agent to produce `HANDOFF.html` — a self-contained
single-page visual summary of the entire session. This is the artifact you open in a
browser to get a 30-second overview of what happened overnight.

**Include in the goal prompt's morning report section.** The agent generates it using
the `/dashboard-style` skill conventions if available, or writes clean inline-styled
HTML if not.

**Required sections in the HTML page:**

| Section        | Content                                                         |
| -------------- | --------------------------------------------------------------- |
| Header         | Task name, date, duration (turns used / limit)                  |
| Status         | Overall: DONE / PARTIAL / BLOCKED — with color indicator        |
| Phases         | Each phase with status badge (green/yellow/red), files produced |
| Files Created  | Clickable list of every file written, with byte sizes           |
| Decisions Made | Key choices the agent made autonomously                         |
| Blockers       | What needs human decision, highlighted                          |
| Evidence       | Key outputs — test results, counts, screenshots if applicable   |

**Styling guidance for the agent:** Dark background (#1a1a1a), cream text (#f5f0e8),
orange accents (#e8a84c) for highlights, monospace for paths/code. Single file, no
external deps, opens in any browser. Use the `/dashboard-style` skill if available
for a polished result.

---

## Publish via lavish-axi (deliver the report as a hosted URL)

Writing `HANDOFF.html` to disk is not enough for an overnight handoff — by morning the
agent's session is gone and there is no local server to open the file interactively.
**Publish the report** so I wake up to a clickable link I can open from anywhere
(including my phone). This is the delivery mechanism per
`~/.claude/rules/html-artifacts-lavish.md`.

**Command — headless-safe (no browser required, just an HTTPS POST):**

```bash
lavish-axi share HANDOFF.html --password <pw>
```

- `share` inlines local assets and POSTs the single-file HTML to **ht-ml.app**, then
  prints a **visitable URL** and a one-time secret **`update_key`**. No account or API
  key needed. It does NOT need a browser or a running Lavish server, so it works inside
  a detached overnight gnhf run.
- **`--password <pw>` is MANDATORY.** ht-ml.app pages are PUBLIC by default and may be
  indexed/scraped. Morning reports describe client and business work — never publish
  one without a password. Generate a fresh random password per report (do not reuse a
  hardcoded one, do not commit it to a public repo).

**Capture the public URL in `HANDOFF.md`** so the link survives after the agent exits. Add a
block at the very top of `HANDOFF.md`:

```markdown
## 📋 Published Report

- **URL:** https://ht-ml.app/<slug>
```

**NEVER write the password or `update_key` into `HANDOFF.md`.** HANDOFF.md lives in the
working tree and could be committed. The `update_key` is update/delete-capable — if it
leaks, anyone who finds the URL can modify or delete the hosted page.

Instead, write the password and `update_key` to **`HANDOFF.secret.local`** and immediately
add `HANDOFF.secret.local` to `.gitignore`. This keeps the secrets out of the working tree
while preserving them for morning access. Save the `update_key` — it is shown only once
and is what lets you update or delete the hosted page later via ht-ml.app.

**Offline / air-gapped fallback:** if ht-ml.app is unreachable (network blocked overnight),
fall back to `lavish-axi export HANDOFF.html --out HANDOFF.export.html` — a portable
single-file copy with assets inlined — and note in `HANDOFF.md` that publishing was
skipped and why. Never let a failed publish block the rest of the morning report.

**In-session variant (only when I am at the machine):** if the run finishes while I am
present (in-session `/goal`, not overnight gnhf), serve it interactively instead:
`lavish-axi HANDOFF.html` for an annotatable review surface, then background
`lavish-axi poll HANDOFF.html` for feedback. Overnight runs skip this — there is no
browser — and go straight to `share`.

---

## Excalidraw Diagram

The goal prompt instructs the agent to produce `HANDOFF.excalidraw` — a visual diagram
of the architecture, flow, or work graph produced during the session.

**Excalidraw files are JSON.** The agent writes the JSON directly. Excalidraw files
open at https://excalidraw.com or in the VS Code Excalidraw extension.

**What to diagram depends on task type:**

| Task Type                   | Diagram Shows                                   |
| --------------------------- | ----------------------------------------------- |
| Client setup / GTM pipeline | Pipeline phases, what completed, data flow      |
| Feature implementation      | Component architecture, file relationships      |
| Migration                   | Before/after, what moved where                  |
| Research                    | Information flow, sources → synthesis → outputs |
| Bug fix                     | Root cause chain, fix location                  |

**Minimal Excalidraw JSON structure:**

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "claude-code-goal",
  "elements": [
    {
      "type": "rectangle",
      "x": 100,
      "y": 100,
      "width": 200,
      "height": 60,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "#a5d8ff",
      "fillStyle": "solid",
      "roundness": { "type": 3 },
      "id": "unique-id",
      "seed": 1
    },
    {
      "type": "text",
      "x": 120,
      "y": 115,
      "width": 160,
      "height": 30,
      "text": "Phase 1: Setup",
      "fontSize": 16,
      "fontFamily": 1,
      "id": "text-id",
      "containerId": "unique-id"
    },
    {
      "type": "arrow",
      "x": 300,
      "y": 130,
      "width": 100,
      "height": 0,
      "startBinding": { "elementId": "unique-id", "focus": 0, "gap": 1 },
      "endBinding": { "elementId": "next-id", "focus": 0, "gap": 1 },
      "id": "arrow-id"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

**Color coding for status:**

- `#a5d8ff` (blue) — completed
- `#b2f2bb` (green) — verified/passing
- `#ffec99` (yellow) — partial/workaround
- `#ffc9c9` (red) — blocked/needs decision
- `#e9ecef` (gray) — not started

**Layout:** Flow left-to-right for pipelines, top-to-bottom for hierarchies. Keep it
readable — 5-15 elements max. This is a summary diagram, not a full architecture doc.

---

## Run Metrics section

The goal prompt instructs the agent to append a `## Run Metrics` section to HANDOFF.md
at run end. This is the machine-readable summary of the goal run, used by aggregator
scripts to benchmark goal-loop performance.

**Fields** (one per line, `key: value` format, exactly in this order):

| Field | Description | Example |
| --- | --- | --- |
| `started` | ISO-8601 from `date -Is`, captured at turn 1 | `2026-07-17T10:30:45+05:30` |
| `finished` | ISO-8601 from `date -Is`, at run end | `2026-07-17T12:45:30+05:30` |
| `wall_clock_minutes` | elapsed time in minutes | `135` |
| `turns_used` | count of turns consumed | `42` |
| `turn_budget` | max turns allowed for this run | `80` |
| `cycles_used` | count of eval-loop cycles | `2` |
| `max_cycles` | max cycles allowed | `3` |
| `reward_final` | final reward signal value | `4.8` |
| `reward_per_cycle` | comma-separated list of per-cycle scores | `4.2, 4.8` |
| `commits` | count of git commits in this run | `5` |
| `tests_delta` | test count change (e.g. "25->31") | `47->52` |

**Full example section in HANDOFF.md:**

```markdown
## Run Metrics

started: 2026-07-17T10:30:45+05:30
finished: 2026-07-17T12:45:30+05:30
wall_clock_minutes: 135
turns_used: 42
turn_budget: 80
cycles_used: 2
max_cycles: 3
reward_final: 4.8
reward_per_cycle: 4.2, 4.8
commits: 5
tests_delta: 47->52
```
