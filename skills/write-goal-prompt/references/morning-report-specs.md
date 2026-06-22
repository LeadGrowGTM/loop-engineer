# Morning Report Specs

## HTML Summary Page

The goal prompt instructs the agent to produce `HANDOFF.html` — a self-contained
single-page visual summary of the entire session. This is the artifact you open in a
browser to get a 30-second overview of what happened overnight.

**Include in the goal prompt's morning report section.** The agent generates it using
the `/dashboard-style` skill conventions if available, or writes clean inline-styled
HTML if not.

**Required sections in the HTML page:**

| Section | Content |
|---------|---------|
| Header | Task name, date, duration (turns used / limit) |
| Status | Overall: DONE / PARTIAL / BLOCKED — with color indicator |
| Phases | Each phase with status badge (green/yellow/red), files produced |
| Files Created | Clickable list of every file written, with byte sizes |
| Decisions Made | Key choices the agent made autonomously |
| Blockers | What needs human decision, highlighted |
| Evidence | Key outputs — test results, counts, screenshots if applicable |

**Styling guidance for the agent:** Dark background (#1a1a1a), cream text (#f5f0e8),
orange accents (#e8a84c) for highlights, monospace for paths/code. Single file, no
external deps, opens in any browser. Use the `/dashboard-style` skill if available
for a polished result.

---

## Excalidraw Diagram

The goal prompt instructs the agent to produce `HANDOFF.excalidraw` — a visual diagram
of the architecture, flow, or work graph produced during the session.

**Excalidraw files are JSON.** The agent writes the JSON directly. Excalidraw files
open at https://excalidraw.com or in the VS Code Excalidraw extension.

**What to diagram depends on task type:**

| Task Type | Diagram Shows |
|-----------|---------------|
| Client setup / GTM pipeline | Pipeline phases, what completed, data flow |
| Feature implementation | Component architecture, file relationships |
| Migration | Before/after, what moved where |
| Research | Information flow, sources → synthesis → outputs |
| Bug fix | Root cause chain, fix location |

**Minimal Excalidraw JSON structure:**

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "claude-code-goal",
  "elements": [
    {
      "type": "rectangle",
      "x": 100, "y": 100, "width": 200, "height": 60,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "#a5d8ff",
      "fillStyle": "solid",
      "roundness": { "type": 3 },
      "id": "unique-id",
      "seed": 1
    },
    {
      "type": "text",
      "x": 120, "y": 115, "width": 160, "height": 30,
      "text": "Phase 1: Setup",
      "fontSize": 16,
      "fontFamily": 1,
      "id": "text-id",
      "containerId": "unique-id"
    },
    {
      "type": "arrow",
      "x": 300, "y": 130, "width": 100, "height": 0,
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
