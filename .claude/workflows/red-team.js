// Workflow-DSL script. Runs only within the Workflow executor.
// The `phase()`, `parallel()`, `agent()`, `log()`, and `args` globals are injected at
// runtime by the executor. Standalone syntax check will fail on top-level `return` — that
// is expected and correct. The file has valid JS syntax; it is not a standalone module.

export const meta = {
  name: 'red-team',
  description:
    'Adversarially break what was just built. Spawns four attack roles in parallel — hostile user, careless user, performance, security — each hunting only from its own angle along the whole path from entry to failure. Merges into one worst-first list of holes, each with the exact trigger. Does not defend the code; attacks it.',
  whenToUse:
    'The verify phase of a goal loop, or any time a feature/flow needs adversarial proof rather than rubric scoring. Pass args.target (what was built, one paragraph), args.paths (files/dirs to read), args.entryPoint (how a user/caller reaches it). Optional args.outOfScope.',
  phases: [{ title: 'Attack' }, { title: 'Merge' }],
};

// ───────────────────────── args / defaults ─────────────────────────
const a = args || {};
const TARGET = a.target;
const PATHS = a.paths;
if (!TARGET || !PATHS) {
  throw new Error(
    'red-team requires args.target (what was built) and args.paths (files/dirs to read).',
  );
}
const ENTRY = a.entryPoint || '(infer the entry point from the code)';
const OUT_OF_SCOPE = a.outOfScope || '(nothing explicitly out of scope)';

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'title', 'trigger', 'pathway', 'impact'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          title: { type: 'string' },
          trigger: { type: 'string', description: 'Exact input/state that sets it off' },
          pathway: { type: 'string', description: 'Entry → failure, step by step' },
          impact: { type: 'string', description: 'What breaks: crash, leak, loop, corruption, wrong result' },
        },
      },
    },
  },
};

// One role's attack brief. Each role is blind to the others and hunts ONLY its angle.
function attackBrief(role, lens) {
  return `You are a red-team agent in the "${role}" role. You did NOT write this code and you owe it no charity. Your only job is to find where it breaks from your angle — do not praise it, do not defend it, do not suggest it's probably fine.

What was built:
"""
${TARGET}
"""
Entry point (how it's reached): ${ENTRY}
Out of scope (do not report these): ${OUT_OF_SCOPE}

Read these paths in full before attacking: ${Array.isArray(PATHS) ? PATHS.join(', ') : PATHS}

Your angle — ${role}: ${lens}

Method: walk the WHOLE path from entry to failure. For every hole, give the exact
trigger (concrete input or state, not "bad input"), the pathway from entry to the
failure, and the concrete impact. Prefer one real, reproducible hole over five vague
"could maybe". Rank your own findings by severity. If you genuinely find nothing in
your angle after a real attack, return an empty findings array — do not invent filler.`;
}

const ROLES = [
  {
    role: 'hostile user',
    lens:
      'A motivated attacker feeding deliberately malicious input — injection, oversized/empty/Unicode/negative values, auth bypass, replay, tampering with anything client-controlled. What input breaks it or gets you somewhere you should not be?',
  },
  {
    role: 'careless user',
    lens:
      'A normal user doing normal-but-unanticipated things — double-clicks, back button, refresh mid-flow, wrong order, missing optional field, stale tab, slow network, duplicate submit. What ordinary edge case got skipped?',
  },
  {
    role: 'performance',
    lens:
      'Where does it get slow, allocate without bound, do N+1 work, hold a lock, never release, or loop? What load or data shape makes it crawl or fall over? Hunt unbounded growth and accidental quadratics.',
  },
  {
    role: 'security',
    lens:
      'Secrets/PII exposure, missing authz checks, plaintext credentials on disk, SSRF, path traversal, unsafe deserialization, missing rate limits, leaky errors. Where does it leak, over-trust, or fail open?',
  },
];

// ───────────────────────── Phase 1: Attack (parallel) ─────────────────────────
// Barrier is correct here: the merge step dedupes across ALL roles at once
// (two roles often find the same hole from different angles).
phase('Attack');
const perRole = await parallel(
  ROLES.map((r) => () =>
    agent(attackBrief(r.role, r.lens), {
      label: `attack:${r.role.replace(/\s+/g, '-')}`,
      phase: 'Attack',
      schema: FINDINGS_SCHEMA,
      agentType: 'Explore',
    }).then((res) => ({ role: r.role, findings: (res && res.findings) || [] })),
  ),
);

const raw = perRole
  .filter(Boolean)
  .flatMap((r) => r.findings.map((f) => ({ ...f, foundBy: r.role })));

// Nothing to merge — short-circuit (mirrors the article's "0 findings → skip verify").
if (raw.length === 0) {
  return { holes: [], rolesRun: ROLES.length, note: 'No holes found after a full four-angle attack.' };
}

// ───────────────────────── Phase 2: Merge (worst-first) ─────────────────────────
phase('Merge');
const MERGE_SCHEMA = {
  type: 'object',
  required: ['holes'],
  properties: {
    holes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'title', 'trigger', 'impact', 'foundBy'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          title: { type: 'string' },
          trigger: { type: 'string' },
          impact: { type: 'string' },
          foundBy: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const merged = await agent(
  `You are the red-team synthesizer. Below are raw findings from four attack roles against the same target. Merge them into ONE list, worst-first.

Rules:
- Collapse duplicates: if two roles found the same hole, emit it once with both role names in foundBy. Same root cause = same hole even if worded differently.
- Order strictly by severity: critical → high → medium → low. Within a tier, most-certain-to-reproduce first.
- Keep the exact trigger for each. Do not soften it. Do not add holes that aren't in the input.
- Do not editorialize or add a "looks good overall" note. This is an attack list.

Raw findings (JSON):
${JSON.stringify(raw, null, 2)}`,
  { label: 'merge:synthesize', phase: 'Merge', schema: MERGE_SCHEMA },
);

const holes = (merged && merged.holes) || [];
const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
for (const h of holes) bySeverity[h.severity] = (bySeverity[h.severity] || 0) + 1;

log(
  `red-team: ${holes.length} holes — ${bySeverity.critical} critical, ${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low`,
);

return { holes, bySeverity, rolesRun: ROLES.length };
