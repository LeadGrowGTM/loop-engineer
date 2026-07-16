#!/usr/bin/env bun
/**
 * run-metrics — aggregate metrics from goal HANDOFF files
 *
 * Usage:
 *   bun scripts/run-metrics.ts [goals-dir]
 *
 * Scans goals directory for HANDOFF files with Run Metrics sections
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface RunMetrics {
  slug: string;
  metricsStatus?: string;
  started?: string;
  finished?: string;
  wall_clock_minutes?: string;
  turns_used?: string;
  turn_budget?: string;
  cycles_used?: string;
  max_cycles?: string;
  reward_final?: string;
  reward_per_cycle?: string;
  commits?: string;
  tests_delta?: string;
}

const REQUIRED_FIELDS = [
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

export function parseRunMetrics(goalsDir: string): RunMetrics[] {
  const results: RunMetrics[] = [];

  if (!existsSync(goalsDir)) {
    return results;
  }

  let slugs: string[] = [];
  try {
    slugs = readdirSync(goalsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  } catch (e) {
    return results;
  }

  for (const slug of slugs) {
    const handoffPath = resolve(goalsDir, slug, 'HANDOFF.md');

    if (!existsSync(handoffPath)) {
      results.push({ slug, metricsStatus: 'no metrics' });
      continue;
    }

    let content: string;
    try {
      content = readFileSync(handoffPath, 'utf8');
    } catch (e) {
      results.push({ slug, metricsStatus: 'no metrics' });
      continue;
    }

    const metricsMatch = content.match(/## Run Metrics\n([\s\S]*?)(?=\n## |\n*$)/);
    if (!metricsMatch) {
      results.push({ slug, metricsStatus: 'no metrics' });
      continue;
    }

    const metricsBlock = metricsMatch[1];
    const metrics: RunMetrics = { slug };
    const fields: Record<string, string> = {};

    const lines = metricsBlock.trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        fields[key] = value.trim();
      }
    }

    for (const field of REQUIRED_FIELDS) {
      if (field in fields) {
        metrics[field as keyof RunMetrics] = fields[field];
      }
    }

    results.push(metrics);
  }

  return results;
}

function formatTable(runs: RunMetrics[]): void {
  if (runs.length === 0) {
    console.log('No runs found.');
    return;
  }

  const rows: string[][] = [];
  const header = ['Slug', 'Started', 'Wall Clock (min)', 'Turns', 'Cycles', 'Reward'];
  rows.push(header);

  for (const run of runs) {
    const slug = run.slug;
    const started = run.started || '—';
    const wallClock = run.wall_clock_minutes || '—';
    const turns = run.turns_used || '—';
    const cycles = run.cycles_used || '—';
    const reward = run.reward_final || '—';

    if (run.metricsStatus === 'no metrics') {
      rows.push([`${slug}  (no metrics)`, '', '', '', '', '']);
    } else {
      rows.push([slug, started, wallClock, turns, cycles, reward]);
    }
  }

  const colWidths: number[] = [];
  for (let i = 0; i < header.length; i++) {
    colWidths[i] = Math.max(...rows.map((row) => (row[i] || '').length));
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = row
      .map((cell, j) => {
        if (i === 0) {
          return cell.padEnd(colWidths[j]);
        } else {
          return (cell || '').padEnd(colWidths[j]);
        }
      })
      .join('  ');
    console.log(line);
  }
}

if (import.meta.main) {
  const goalsDir = process.argv[2] || resolve(import.meta.dir, '../.harness/goals');
  const runs = parseRunMetrics(goalsDir);
  formatTable(runs);
  process.exit(0);
}
