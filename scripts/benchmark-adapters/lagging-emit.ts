#!/usr/bin/env bun
/**
 * lagging measurement adapter - emit-job stub.
 *
 * Contract: docs/benchmarking/measurement-adapter.md ("Lagging cadence").
 * A lagging benchmark cannot finish in-session: the variant ships live and the
 * reward accrues over a settle_window. The harness EMITS a scheduled job to an
 * external orchestrator (n8n / trigger.dev / Hermes) carrying a resume_key, then
 * hands off - it does NOT own the scheduler (ADR-0002).
 *
 * STUB ONLY. buildEmitJob constructs + returns/writes a valid payload. It NEVER
 * dispatches to a live orchestrator and NEVER calls a paid API (dispatched_live is
 * always false, job_ref always null). Wiring an actual dispatch is out of scope
 * for the unsupervised build (OBJECTIVE "do NOT run any lagging loop live").
 *
 * Usage:
 *   bun scripts/benchmark-adapters/lagging-emit.ts <spec.json> <variant_id>   print payload
 *   bun scripts/benchmark-adapters/lagging-emit.ts --selftest                 assertions
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

export interface EmitJob {
  orchestrator: 'n8n' | 'trigger.dev' | 'hermes';
  job_ref: string | null;
  resume_key: string;
  run_dir: string;
  variant_id: string;
  settle_window: string;
  benchmark: {
    unit: string;
    direction: 'maximize' | 'minimize';
    ship_command: string | null;
    measure_command: string | null;
  };
  resume: { command: string; on_return: string };
  emitted: true;
  returned: false;
  dispatched_live: false;
}

/**
 * Build a lagging emit-job payload from a benchmark spec + the variant to ship.
 * Pure: no I/O, no dispatch. Returns the stubbed payload (dispatched_live=false).
 */
export function buildEmitJob(
  spec: any,
  variantId: string,
  runId: string,
): EmitJob {
  const m = spec?.measurement ?? {};
  if (m.cadence && m.cadence !== 'lagging') {
    throw new Error(`lagging-emit: spec.measurement.cadence is "${m.cadence}", expected "lagging"`);
  }
  const settleWindow = m.settle_window ?? spec?.stop?.settle_window;
  if (!settleWindow) {
    throw new Error('lagging-emit: spec is missing settle_window (required for lagging cadence, ADR-0002)');
  }
  const slug = spec?.slug ?? spec?.benchmark?.slug ?? 'benchmark';
  const runDir = `.harness/goals/${slug}/runs/${runId}`;
  return {
    orchestrator: m.orchestrator ?? 'trigger.dev',
    job_ref: null,
    resume_key: runId,
    run_dir: runDir,
    variant_id: variantId,
    settle_window: settleWindow,
    benchmark: {
      unit: spec?.benchmark?.unit ?? m.unit ?? 'reward',
      direction: spec?.benchmark?.direction ?? 'maximize',
      ship_command: m.ship_command ?? null,
      measure_command: m.measure_command ?? m.command ?? null,
    },
    resume: {
      command: `/benchmarking-loop --resume ${runId}`,
      on_return:
        'ingest reward -> ledger measurement (cadence=lagging, settled=true) -> continue cycle N+1',
    },
    emitted: true,
    returned: false,
    dispatched_live: false,
  };
}

/**
 * Write the stubbed payload into the run dir. Returns the file path. Still no
 * live dispatch - persisting the payload is what "emit-stub" means.
 */
export function writeEmitJob(job: EmitJob): string {
  const out = resolve(job.run_dir, 'emit-job.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(job, null, 2));
  return out;
}

// ───────────────────────── selftest (zero-cost, no dispatch) ─────────────────────────

function selftest(): void {
  const spec = {
    slug: 'reply-rate-climb',
    benchmark: { unit: 'reply_rate', direction: 'maximize' },
    measurement: {
      cadence: 'lagging',
      settle_window: '72h',
      orchestrator: 'n8n',
      ship_command: 'ship-variant.sh',
      measure_command: 'read-reply-rate.sh',
    },
  };
  const job = buildEmitJob(spec, 'v0007', 'reply-rate-climb-20260713');
  const checks: Array<[string, boolean]> = [
    ['resume_key is run_id', job.resume_key === 'reply-rate-climb-20260713'],
    ['orchestrator from spec', job.orchestrator === 'n8n'],
    ['settle_window copied', job.settle_window === '72h'],
    ['measure_command carried', job.benchmark.measure_command === 'read-reply-rate.sh'],
    ['resume command well-formed', job.resume.command === '/benchmarking-loop --resume reply-rate-climb-20260713'],
    ['NOT dispatched live', job.dispatched_live === false],
    ['job_ref null (stub)', job.job_ref === null],
    ['emitted true', job.emitted === true],
    ['returned false', job.returned === false],
    ['run_dir keyed by run_id', job.run_dir === '.harness/goals/reply-rate-climb/runs/reply-rate-climb-20260713'],
  ];
  let missingWindow = false;
  try {
    buildEmitJob({ slug: 'x', measurement: { cadence: 'lagging' } }, 'v1', 'r1');
  } catch {
    missingWindow = true;
  }
  checks.push(['missing settle_window throws', missingWindow]);

  let pass = 0;
  for (const [name, ok] of checks) {
    if (ok) pass++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  }
  console.log(`\n${pass}/${checks.length} emit-stub assertions passed`);
  if (pass !== checks.length) process.exit(1);
}

if (import.meta.main) {
  const arg = process.argv[2];
  if (!arg || arg === '--selftest') {
    selftest();
  } else {
    const spec = JSON.parse(readFileSync(resolve(arg), 'utf8'));
    const variantId = process.argv[3] ?? 'v0001';
    const runId = spec?.run_id ?? `${spec?.slug ?? 'benchmark'}-run`;
    const job = buildEmitJob(spec, variantId, runId);
    console.log(JSON.stringify(job, null, 2));
    console.log('\n// STUB: payload built, NOT dispatched (dispatched_live=false).');
  }
}
