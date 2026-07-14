#!/usr/bin/env bun
/**
 * instant measurement adapter - the exogenous stdout->number reward source.
 *
 * Contract: docs/benchmarking/measurement-adapter.md ("Instant cadence").
 * Reward = the LAST numeric token of the command's stdout. Deterministic and
 * model-free: the number comes from outside the model. No paid API - the command
 * is a local no-cost process.
 *
 * This is the canonical reference impl. benchmark-sweep.js inlines the identical
 * parseReward/measureInstant rule (P4 shipped before P7); this file is the shared
 * contract and the extraction target if the rule ever changes.
 *
 * Usage:
 *   bun scripts/benchmark-adapters/instant.ts '<command>'   run + print JSON reward block
 *   bun scripts/benchmark-adapters/instant.ts --selftest    zero-cost parse-rule assertions
 */

import { execSync } from 'child_process';

export interface Measurement {
  cadence: 'instant';
  reward: number;
  unit: string;
  cost_usd: number;
  source: string;
  measured_at_cycle: number | null;
  settled: true;
}

/**
 * Parse the reward from stdout: the last numeric token, or null if none.
 * A number is -?\d+(?:\.\d+)?(?:[eE][+-]?\d+)? (matches benchmark-sweep.js).
 */
export function parseReward(stdout: string): number | null {
  const matches = String(stdout).match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1]);
}

/**
 * Run a local command and return its numeric reward + raw stdout.
 * Throws if the command produces no number (recorded null/kept:false upstream).
 */
export function measureInstant(
  command: string,
  opts: { cwd?: string; unit?: string; cycle?: number } = {},
): { reward: number; stdout: string; measurement: Measurement } {
  const stdout = execSync(command, {
    cwd: opts.cwd,
    encoding: 'utf8',
    shell: true as unknown as string,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const reward = parseReward(stdout);
  if (reward === null) {
    throw new Error(`instant measurement produced no number for: ${command}\nstdout: ${stdout}`);
  }
  const measurement: Measurement = {
    cadence: 'instant',
    reward,
    unit: opts.unit ?? 'reward',
    cost_usd: 0.0,
    source: command,
    measured_at_cycle: opts.cycle ?? null,
    settled: true,
  };
  return { reward, stdout, measurement };
}

// ───────────────────────── selftest (zero-cost, no external command) ─────────────────────────

function selftest(): void {
  const cases: Array<[string, number | null]> = [
    ['0.062', 0.062],
    ['reply_rate: 0.071\nfinal 0.088', 0.088],
    ['latency_ms=1234', 1234],
    ['result -2.5e-3', -0.0025],
    ['no number here', null],
    ['', null],
    ['1 2 3', 3],
  ];
  let pass = 0;
  for (const [input, want] of cases) {
    const got = parseReward(input);
    const ok = got === want;
    if (ok) pass++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  parseReward(${JSON.stringify(input)}) = ${got} (want ${want})`);
  }
  console.log(`\n${pass}/${cases.length} parse assertions passed`);
  if (pass !== cases.length) process.exit(1);
}

if (import.meta.main) {
  const arg = process.argv[2];
  if (!arg || arg === '--selftest') {
    selftest();
  } else {
    const { measurement } = measureInstant(arg, { unit: process.argv[3] });
    console.log(JSON.stringify(measurement, null, 2));
  }
}
