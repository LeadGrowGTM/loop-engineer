# 02 - Provider detection layer
Status: done
Blocked by: none

## Parent
Goal: harness-provider-model-routing (BRIEF.md, PLAN.md — no PRD.md; this is an autonomous
goal loop, not an interactive `/to-prd` intake).

## What to build
A thin, side-effect-isolated detection module `scripts/detect-provider.ts` exporting
`detectProvider(env): Detected` where `Detected` matches the shape `scripts/resolve-role-model.ts`
(Phase 1) expects as its `detected` parameter (`{ provider: 'native' | 'claudex' | 'codex' }`).
All I/O — reading the claudex/codex proxy's session `providers=…` signal and `Bun.which('codex')`
— is confined to this one file, and both are injectable through the `env` parameter for tests
(no test may depend on ambient real environment state or a real `codex` binary on PATH). Default
to `native` when neither signal is present. Document the exact signal name (env var or session
context key) the `providers=…` signal reads from as a single exported constant with a comment
citing `docs/DEPENDENCIES.md` §"Running under claudex" as the source — this is an open ambiguity
per PLAN.md, so make the assumption a one-line, easy-to-correct fact, not logic buried inline.

## Acceptance criteria
- `scripts/detect-provider.ts` exports `detectProvider(env): Detected`; every read of an env var or `Bun.which` result happens through the injected `env` parameter, not a bare ambient global — grep confirms no bare `process.env` or `Bun.which` call sites outside the parameter's own injection point.
- Returns `provider: 'claudex'` when the injected `providers=` signal indicates claudex is active.
- Returns `provider: 'codex'` when the injected `Bun.which('codex')` stand-in resolves truthy and no claudex signal is present.
- Returns `provider: 'native'` when neither signal is present — this is the documented default, tested explicitly.
- Documents (and tests) the precedence when both signals are present simultaneously — claudex session signal wins, since it means a live proxied session is in progress; a codex-binary-only environment models "no Anthropic access at all."
- `scripts/detect-provider.test.ts` covers all four cases above using an injected fake env/which — no live network or filesystem PATH lookup.
- `bun test scripts/detect-provider.test.ts` exits 0 — paste the pass count as proof in PROGRESS.md.

## Skill routing
`tdd` — artifact: `scripts/detect-provider.ts` + `scripts/detect-provider.test.ts`
