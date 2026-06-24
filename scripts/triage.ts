#!/usr/bin/env bun
/**
 * triage — inspect and manage the harness run log
 *
 * Usage:
 *   bun scripts/triage.ts                          list pending runs + open signals
 *   bun scripts/triage.ts review <id>              mark run reviewed
 *   bun scripts/triage.ts dismiss <id>             dismiss run
 *   bun scripts/triage.ts log --type goal ...      write a run record (harness hook)
 *   bun scripts/triage.ts signal <run-id> ...      attach a signal to a run
 */

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';

const DB_PATH = resolve(import.meta.dir, '../.claude/state/triage.db');
const SCHEMA_PATH = resolve(import.meta.dir, '../.claude/state/schema.sql');

function openDb(): Database {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  if (existsSync(SCHEMA_PATH)) {
    db.exec(readFileSync(SCHEMA_PATH, 'utf8'));
  }
  return db;
}

function now(): string {
  return new Date().toISOString();
}

function parseArgs(argv: string[]): { cmd: string; pos: string[]; flags: Record<string, string> } {
  const pos: string[] = [];
  const flags: Record<string, string> = {};
  let cmd = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      flags[a.slice(2)] = argv[++i] ?? '1';
    } else if (!cmd) {
      cmd = a;
    } else {
      pos.push(a);
    }
  }
  return { cmd, pos, flags };
}

// ── commands ──────────────────────────────────────────────────────────────

export function cmdList(db: Database) {
  const runs = db
    .query(
      `SELECT id, ts, type, label, verdict, reward_signal, needs_review, status
       FROM runs WHERE status = 'pending' ORDER BY ts DESC LIMIT 20`,
    )
    .all() as any[];

  const signals = db
    .query(
      `SELECT s.id, s.run_id, s.category, s.message, r.label AS run_label
       FROM signals s JOIN runs r ON r.id = s.run_id
       WHERE s.status = 'open' ORDER BY s.ts DESC`,
    )
    .all() as any[];

  if (!runs.length && !signals.length) {
    console.log('Triage inbox empty. Nothing pending.');
    return;
  }

  if (runs.length) {
    console.log(`\n── Pending runs (${runs.length}) ──`);
    for (const r of runs) {
      const flag = r.needs_review ? ' ⚑' : '';
      const reward = r.reward_signal != null ? ` ${r.reward_signal}/5` : '';
      const verdict = r.verdict ? ` [${r.verdict}]` : '';
      console.log(
        `  #${r.id}  ${r.ts.slice(0, 16)}  ${r.type}  ${r.label}${verdict}${reward}${flag}`,
      );
    }
  }

  if (signals.length) {
    console.log(`\n── Open signals (${signals.length}) ──`);
    for (const s of signals) {
      console.log(
        `  signal#${s.id} → run#${s.run_id} (${s.run_label})  [${s.category}]  ${s.message}`,
      );
    }
  }

  console.log('\n  review <id> | dismiss <id>');
}

export function cmdReview(db: Database, id: string) {
  const result = db
    .query(`UPDATE runs SET status='reviewed', reviewed_at=? WHERE id=? AND status='pending'`)
    .run(now(), Number(id));
  if ((result as any).changes === 0) {
    throw new Error(`Run #${id} not found or already reviewed.`);
  }
  console.log(`Run #${id} marked reviewed.`);
}

export function cmdDismiss(db: Database, id: string) {
  const result = db
    .query(`UPDATE runs SET status='dismissed', reviewed_at=? WHERE id=? AND status='pending'`)
    .run(now(), Number(id));
  if ((result as any).changes === 0) {
    throw new Error(`Run #${id} not found or already actioned.`);
  }
  console.log(`Run #${id} dismissed.`);
}

export function cmdLog(db: Database, flags: Record<string, string>) {
  const type = flags['type'];
  const label = flags['label'];
  if (!type || !label) {
    throw new Error('--type and --label are required');
  }
  // Fix 6: accept '1', 'true', 'yes' as truthy values for --needs-review
  const needsReview = ['1', 'true', 'yes'].includes(
    (flags['needs-review'] ?? '').toLowerCase(),
  )
    ? 1
    : 0;
  const result = db
    .query(
      `INSERT INTO runs (ts, type, label, verdict, reward_signal, cycle_log, needs_review)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      now(),
      type,
      label,
      flags['verdict'] ?? null,
      flags['reward'] != null ? parseFloat(flags['reward']) : null,
      flags['cycle-log'] ?? null,
      needsReview,
    );
  const id = (result as any).lastInsertRowid;
  console.log(`Run #${id} logged.`);
}

export function cmdSignal(db: Database, runId: string, flags: Record<string, string>) {
  const category = flags['category'];
  const message = flags['message'];
  if (!runId || !category || !message) {
    throw new Error('<run-id>, --category and --message are required');
  }
  // Fix 4: atomic — signal INSERT + run needs_review UPDATE in one transaction
  const tx = db.transaction(() => {
    const result = db
      .query(`INSERT INTO signals (run_id, ts, category, message) VALUES (?, ?, ?, ?)`)
      .run(Number(runId), now(), category, message);
    db.query(`UPDATE runs SET needs_review=1 WHERE id=?`).run(Number(runId));
    return result;
  });
  const result = tx();
  const id = (result as any).lastInsertRowid;
  console.log(`Signal #${id} attached to run #${runId}.`);
}

// ── main ──────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const { cmd, pos, flags } = parseArgs(process.argv.slice(2));
  const db = openDb();
  let exitCode = 0;
  // Fix 5: try/finally ensures db.close() runs on any error path
  try {
    switch (cmd) {
      case '':
      case 'list':
        cmdList(db);
        break;
      case 'review':
        cmdReview(db, pos[0]);
        break;
      case 'dismiss':
        cmdDismiss(db, pos[0]);
        break;
      case 'log':
        cmdLog(db, flags);
        break;
      case 'signal':
        cmdSignal(db, pos[0], flags);
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
        console.error(
          'Commands: list, review <id>, dismiss <id>, log --type --label [...], signal <run-id> --category --message',
        );
        exitCode = 1;
    }
  } catch (e: any) {
    console.error(e.message);
    exitCode = 1;
  } finally {
    db.close();
  }
  if (exitCode) process.exit(exitCode);
}
