import { test, expect, describe } from 'bun:test';
import { parseRunMetrics } from './run-metrics';
import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { mkdtemp } from 'fs';
import { promisify } from 'util';

const mkdtempAsync = promisify(mkdtemp);

describe('parseRunMetrics', () => {
  test('parses HANDOFF.md with complete Run Metrics section to expected values', async () => {
    const tmpDir = await mkdtempAsync('/tmp/run-metrics-test-');
    const goalsDir = resolve(tmpDir, 'goals');
    const runDir = resolve(goalsDir, 'test-run');

    await mkdir(runDir, { recursive: true });
    const handoffContent = `# HANDOFF — test-run

## Run Metrics
started: 2026-07-17T10:00:00+08:00
finished: 2026-07-17T11:30:00+08:00
wall_clock_minutes: 90
turns_used: 25
turn_budget: 60
cycles_used: 2
max_cycles: 3
reward_final: 4.5
reward_per_cycle: 4.5, 4.2
commits: 5
tests_delta: 25->31
`;
    await writeFile(resolve(runDir, 'HANDOFF.md'), handoffContent);

    const results = parseRunMetrics(goalsDir);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      slug: 'test-run',
      started: '2026-07-17T10:00:00+08:00',
      finished: '2026-07-17T11:30:00+08:00',
      wall_clock_minutes: '90',
      turns_used: '25',
      turn_budget: '60',
      cycles_used: '2',
      max_cycles: '3',
      reward_final: '4.5',
      reward_per_cycle: '4.5, 4.2',
      commits: '5',
      tests_delta: '25->31',
    });
  });

  test('handles HANDOFF.md without Run Metrics section as metrics-missing, not error', async () => {
    const tmpDir = await mkdtempAsync('/tmp/run-metrics-test-');
    const goalsDir = resolve(tmpDir, 'goals');
    const runDir = resolve(goalsDir, 'test-run-no-metrics');

    await mkdir(runDir, { recursive: true });
    const handoffContent = `# HANDOFF — test-run-no-metrics

## Other Section

This run has no metrics.
`;
    await writeFile(resolve(runDir, 'HANDOFF.md'), handoffContent);

    const results = parseRunMetrics(goalsDir);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      slug: 'test-run-no-metrics',
      metricsStatus: 'no metrics',
    });
    expect(results[0].started).toBeUndefined();
  });

  test("parser's field list matches R1's 11 field names exactly", async () => {
    const tmpDir = await mkdtempAsync('/tmp/run-metrics-test-');
    const goalsDir = resolve(tmpDir, 'goals');
    const runDir = resolve(goalsDir, 'field-test');

    await mkdir(runDir, { recursive: true });
    const handoffContent = `# HANDOFF — field-test

## Run Metrics
started: 2026-07-17T10:00:00+08:00
finished: 2026-07-17T11:30:00+08:00
wall_clock_minutes: 90
turns_used: 25
turn_budget: 60
cycles_used: 2
max_cycles: 3
reward_final: 4.5
reward_per_cycle: 4.5, 4.2
commits: 5
tests_delta: 25->31
`;
    await writeFile(resolve(runDir, 'HANDOFF.md'), handoffContent);

    const results = parseRunMetrics(goalsDir);
    const run = results[0];

    const expectedFields = [
      'started',
      'finished',
      'wall_clock_minutes',
      'turns_used',
      'turn_budget',
      'cycles_used',
      'max_cycles',
      'reward_final',
      'reward_per_cycle',
      'commits',
      'tests_delta',
    ];

    const parsedFields = expectedFields.filter((field) => field in run && run[field as keyof typeof run] !== undefined);
    expect(parsedFields).toHaveLength(expectedFields.length);
    expect(parsedFields.sort()).toEqual(expectedFields.sort());
  });
});
