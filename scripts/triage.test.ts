import { test, expect, describe } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cmdLog, cmdSignal, cmdReview } from './triage';

const SCHEMA_SQL = readFileSync(
  resolve(import.meta.dir, '../.claude/state/schema.sql'),
  'utf8',
);

function createTestDb(): Database {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('cmdLog — needs-review flag', () => {
  test('--needs-review true stores 1', () => {
    const db = createTestDb();
    cmdLog(db, { type: 'goal', label: 'test', 'needs-review': 'true' });
    const row = db.query('SELECT needs_review FROM runs WHERE id=1').get() as any;
    expect(row.needs_review).toBe(1);
  });

  test('--needs-review yes stores 1', () => {
    const db = createTestDb();
    cmdLog(db, { type: 'goal', label: 'test', 'needs-review': 'yes' });
    const row = db.query('SELECT needs_review FROM runs WHERE id=1').get() as any;
    expect(row.needs_review).toBe(1);
  });

  test('--needs-review 1 stores 1', () => {
    const db = createTestDb();
    cmdLog(db, { type: 'goal', label: 'test', 'needs-review': '1' });
    const row = db.query('SELECT needs_review FROM runs WHERE id=1').get() as any;
    expect(row.needs_review).toBe(1);
  });

  test('no needs-review flag stores 0', () => {
    const db = createTestDb();
    cmdLog(db, { type: 'goal', label: 'test' });
    const row = db.query('SELECT needs_review FROM runs WHERE id=1').get() as any;
    expect(row.needs_review).toBe(0);
  });
});

describe('cmdSignal — atomicity', () => {
  test('success: signal row inserted AND run flagged needs_review=1', () => {
    const db = createTestDb();
    db
      .query("INSERT INTO runs (ts, type, label) VALUES ('2024-01-01T00:00:00Z', 'goal', 'test')")
      .run();

    cmdSignal(db, '1', { category: 'blocker', message: 'something broke' });

    const signal = db.query('SELECT * FROM signals WHERE run_id=1').get() as any;
    const run = db.query('SELECT needs_review FROM runs WHERE id=1').get() as any;
    expect(signal).not.toBeNull();
    expect(signal.category).toBe('blocker');
    expect(run.needs_review).toBe(1);
  });

  test('FK violation: invalid run_id leaves signals table empty', () => {
    const db = createTestDb();

    expect(() =>
      cmdSignal(db, '999', { category: 'blocker', message: 'orphan signal' }),
    ).toThrow();

    const count = db.query('SELECT COUNT(*) as n FROM signals').get() as any;
    expect(count.n).toBe(0);
  });
});

describe('cmdReview', () => {
  test('missing id throws with useful message', () => {
    const db = createTestDb();
    expect(() => cmdReview(db, '999')).toThrow('Run #999 not found or already reviewed.');
  });

  test('pending run gets marked reviewed', () => {
    const db = createTestDb();
    db
      .query("INSERT INTO runs (ts, type, label) VALUES ('2024-01-01T00:00:00Z', 'goal', 'test')")
      .run();

    cmdReview(db, '1');

    const row = db.query('SELECT status FROM runs WHERE id=1').get() as any;
    expect(row.status).toBe('reviewed');
  });
});
