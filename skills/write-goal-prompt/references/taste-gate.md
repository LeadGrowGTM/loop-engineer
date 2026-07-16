# Taste Gate — Decision rule for client-facing goal flavor

Compiles personal + repo + client brand taste into the goal prompt as approved quality criteria and constraints, applied after the clarity gate and before formatting. Prevents unattended runs from straying beyond "what we would build."

## When the taste gate fires

After Phase 0.5 (clarity gate resolved), before Phase 2 (goal formatting). Applies to BOTH grilled and spec-mode goals.

## The router (route before loading taste files)

Answer: is this goal taste-relevant?

| Goal shape | Taste-relevant? | Rule |
| --- | --- | --- |
| UI/UX design, frontend, web interface, design system, visual polish, CSS/layout, accessibility | **YES** | Load: `ux-taste.md` + `ui-taste.md` + `opinions.md` + repo `.harness/taste.md` |
| Email copy, marketing copy, messaging, sales materials, content, documentation text | **YES** | Load: `copy-taste.md` + `opinions.md` + repo `.harness/taste.md` |
| Client-facing flow, brand interaction, user-visible feature, any client-side behavior | **YES** | Load: task-domain taste files (above) + `opinions.md` + repo `.harness/taste.md` |
| Backend, infra, migration, data schema, mechanical tooling, internal systems, API guts, database design | **NO** | Skip taste gate. No approval step. No compilation. Continue to Phase 2. |
| Ambiguous (could be either — e.g., "refactor authentication") | **AMBIGUOUS** | Ask the user ONE clarifying question: "Is this for a user-facing feature or an internal system?" Never ask when default is clear. |

**Rule:** Never ask when the default is clear. For a genuinely ambiguous shape, ask the ONE question above, inline, in the single question round — then route on the answer.

## The approval table (present after loading)

Once taste files are loaded, present candidate entries to the user in a single table for one-glance accept/edit/drop:

| Entry | Source file | Tone/type | Recommended |
| --- | --- | --- | --- |
| "Never ship without alt text on every image" | `ux-taste.md` | rule | Keep |
| "Button labels must be verbs, never nouns" | `ui-taste.md` | rule | Keep |
| "Use Copilot voice when onboarding" | `opinions.md` (personal) | brand opinion | Keep / Edit / Drop |
| "Minimum 2 weeks of security audit" | `.harness/taste.md` (repo) | process rule | Keep / Drop |

**Format:**
- Entry: exact text from the taste file (one bullet point, including the rule and its example if present)
- Source file: which taste file it came from
- Tone/type: "rule", "brand opinion", "process rule", etc. — helps the user reason
- Recommended: "Keep", "Edit" (user offers new text), or "Drop" (remove before compilation)

Front-load the table so the user can resteer before compilation. Never auto-apply taste entries; approval is required.

## Compilation (after approval — translate entries → goal prompt rules)

For each approved entry:

**(a) If the entry is a quality criterion** (e.g., "all buttons must have tooltips"):
- Add it to the goal's **"Done means"** section as a checkable bullet:
  ```
  Done means:
  - <existing criterion>
  - <new taste criterion — exact text from the approved entry>
  ```

**(b) If the entry is a must-NOT-touch constraint** (e.g., "never refactor auth without spec review"):
- Add it to **[CONSTRAINTS]** as a must-NOT-touch line:
  ```
  [CONSTRAINTS]
  Do NOT touch unsupervised:
  - <existing constraint>
  - <taste constraint — exact wording>
  ```

**(c) Audit line (every goal, always):**
Insert inside `[TASK]` block, after "Stack:" or at the end:
```
Taste applied: <comma-separated list of entry names, or "none" if no entries approved>
```

Example:
```
Taste applied: "Button labels must be verbs", "Copilot voice on onboarding", "Minimum 2 weeks security audit"
```

If no entries were approved: `Taste applied: none`

## Precedence (what loads first)

**For client-facing goals** (YES route):
1. Client brand guidelines (if the goal lives in a client-scoped `.nexus.json` folder, fetch via `nexus_context` — see Nexus hook below)
2. Repo taste (`.harness/taste.md`)
3. Personal taste (`ux-taste.md`, `ui-taste.md`, `copy-taste.md`, `opinions.md`)

When two layers propose conflicting rules, the higher-precedence layer wins: client brand beats repo, repo beats personal. Present all three layers in the approval table so the user can re-rank or drop lower-precedence entries.

**For internal goals** (taste-relevant but not client-facing):
1. Personal taste first (no client brand or repo taste to consult)
2. Repo taste (`.harness/taste.md` — optional)
3. Client brand (skip entirely for internal goals)

**Load order in the approval table:**
Show all layers in precedence order (top to bottom in the table). Mark the source so the user can spot conflicts.

## Nexus hook (documented only; non-blocking)

**This is a documented fallback, not required for v1.2.0.**

When the goal lives in a client-scoped `.nexus.json` folder (indicating a client-specific goal), invoke the Nexus knowledge-graph lookup after approval:

```
nexus_context <client-slug>
```

This returns the client's curated brand guidelines, positioning, and proven patterns. Merge them into the approval table ABOVE the repo and personal layers (brand truth takes precedence).

**Non-blocking fallback:**
- If `nexus_context` fails (no network, missing client, empty result) → continue without it. Absence never blocks the goal.
- If the client has no stored guidelines → continue with repo + personal taste only.
- Document the Nexus query in the approval table as a "Client brand guidelines" row (greyed out if not found).

## Taste files (reference only — seeded by `setup-harness.ts install`)

Personal taste lives in `~/.claude/taste/`:
- `ux-taste.md` — user experience rules (interaction, usability, accessibility)
- `ui-taste.md` — visual and CSS rules (typography, spacing, color, responsive)
- `copy-taste.md` — writing voice and messaging rules (tone, terminology, structure)
- `opinions.md` — personal engineering opinions (patterns, anti-patterns, tool preferences)

Repo taste lives in `.harness/taste.md`:
- One file per repo with sections: `## Design & UX`, `## Code opinions`, `## Voice`
- Seeded by `setup-harness.ts install <target>` when the repo is initialized

Client brand lives in Nexus (optional v1.3 lookup):
- Fetched via `nexus_context <slug>` when the goal is in a client folder
- Overrides repo and personal taste if present

## What NOT to do

- Do not skip the approval step. Auto-apply taste without user confirmation is a silent override.
- Do not ask the user to edit taste files during the goal run. If a taste entry doesn't fit, the user drops it at approval time.
- Do not invent taste entries if the files don't exist. If `~/.claude/taste/opinions.md` is missing, load what exists from `setup-harness.ts` install or skip that layer entirely.
- Do not let Nexus failures block the goal. If the Nexus query times out or returns empty, continue with repo + personal taste.
- Do not apply taste to backend/infra goals. The router default (NO) is clear; do not ask unless the goal shape is genuinely ambiguous.
