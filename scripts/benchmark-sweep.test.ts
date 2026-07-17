import { test, expect, describe } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error - plain JS workflow module, no type declarations
import { runSweep, parseReward, rankByDirection } from '../.claude/workflows/benchmark-sweep.js';

describe('benchmark-sweep runSweep', () => {
  // Regression: a candidate whose command exits non-zero must be recorded with a null reward
  // and NOT crash the sweep. This exercises the catch block that referenced the executor-only
  // `log` global and threw ReferenceError on the standalone CLI path (found on the engine's
  // first real run, 2026-07-17).
  test('a failing candidate is recorded (null reward, not kept) and the sweep continues', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'sweep-test-'));
    const spec = {
      run_id: 'r', slug: 's',
      benchmark: { metric: 'n', direction: 'maximize' },
      search: {
        mode: 'sweep',
        candidates: [
          { label: 'good', command: 'printf 5' },
          { label: 'boom', command: 'exit 1' }, // non-zero exit -> measurement throws
          { label: 'better', command: 'printf 9' },
        ],
      },
      stop: { budget: { max_cycles: 10 } },
    };

    const { winner, ledger } = runSweep(spec, { repoRoot });

    expect(ledger).toHaveLength(3); // every candidate recorded, even the failure
    const boom = ledger.find((e: { candidate_label: string }) => e.candidate_label === 'boom')!;
    expect(boom.measurement.reward).toBeNull();
    expect(boom.kept).toBe(false);
    expect(winner.candidate_label).toBe('better'); // 9 > 5, failure excluded from ranking

    const ledgerLines = readFileSync(join(repoRoot, '.harness/goals/s/runs/r/ledger.jsonl'), 'utf8')
      .trim().split('\n');
    expect(ledgerLines).toHaveLength(3);
  });

  test('parseReward takes the last numeric token; rankByDirection honors direction', () => {
    expect(parseReward('accuracy = 0.87')).toBe(0.87);
    expect(parseReward('no number here')).toBeNull();
    const entries = [
      { measurement: { reward: 0.4 } },
      { measurement: { reward: 0.9 } },
    ];
    expect(rankByDirection(entries, 'maximize')[0].measurement.reward).toBe(0.9);
    expect(rankByDirection(entries, 'minimize')[0].measurement.reward).toBe(0.4);
  });
});
