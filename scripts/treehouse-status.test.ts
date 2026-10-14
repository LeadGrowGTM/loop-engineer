import { expect, test } from 'bun:test';
import { LIFECYCLE_DEPENDENCY_VERSIONS } from './lifecycle-dependencies';
import { parseTreehouseLeases, treehouseStatusArgs, treehouseStatusContract } from './goal-lifecycle/treehouse';

// The parsed contracts are Treehouse's `status` table (1.8.0) and `status --json` output (3.1.0).
test('every audited Treehouse version resolves to a status contract and its probe arguments', () => {
  const contracts = LIFECYCLE_DEPENDENCY_VERSIONS.treehouse.map((version) => treehouseStatusContract(`v${version}`));

  expect(contracts).toEqual(['text', 'json']);
  expect(contracts.map(treehouseStatusArgs)).toEqual([['status'], ['status', '--json']]);
  expect(treehouseStatusContract('treehouse 3.1.0')).toBe('json');
});

test('an unaudited Treehouse version fails closed instead of guessing a contract', () => {
  for (const output of ['', 'v2.0.0', 'treehouse 3.1.3', 'not a version']) {
    expect(() => treehouseStatusContract(output)).toThrow(/no audited status contract/);
  }
});

test('typed Treehouse status reports exact leased paths and holders behind an update banner', () => {
  const stdout = [
    'A new version of treehouse is available: v3.1.0 -> v3.1.3',
    'Run "treehouse update" to update',
    '',
    JSON.stringify([
      { slot: 1, path: '/pool/slot-1/repository', status: 'leased', lease_holder: 'canonical-goal', branch: 'wt/canonical-goal' },
      { slot: 2, path: '/pool/slot-2/repository', status: 'free', lease_holder: null },
    ]),
  ].join('\n');

  expect(parseTreehouseLeases(stdout, 'json')).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
});

test('typed Treehouse status reports an empty pool as no leases', () => {
  expect(parseTreehouseLeases('A new version of treehouse is available\n[]\n', 'json')).toEqual([]);
});

test('typed Treehouse status preserves multi-line pretty-printed entries', () => {
  const stdout = JSON.stringify([{ path: '/pool/slot-1/repository', status: 'leased', lease_holder: 'canonical-goal' }], null, 2);

  expect(parseTreehouseLeases(stdout, 'json')).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
});

test('typed Treehouse status fails closed for output it cannot read as lease records', () => {
  for (const stdout of [
    '',
    '1 leased /pool/slot-1/repository (held by canonical-goal)',
    '[',
    '[{"path": "/pool/slot-1/repository"}]',
    '[{"status": "leased"}]',
    '[{"path": "", "status": "leased"}]',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": 7}]',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": null}]',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": "  "}]',
    '{"path": "/pool/slot-1/repository", "status": "leased"}',
    '["/pool/slot-1/repository"]',
  ]) {
    expect(() => parseTreehouseLeases(stdout, 'json')).toThrow();
  }
});

test('tabular Treehouse status reports exact leased paths and ignores free slots', () => {
  const stdout = [
    'treehouse pool .worktrees/ (2 trees)',
    '  1  leased  /pool/slot-1/repository  (held by canonical-goal)',
    '  2  free    /pool/slot-2/repository',
  ].join('\n');

  expect(parseTreehouseLeases(stdout, 'text')).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
  expect(parseTreehouseLeases('treehouse pool .worktrees/ (0 trees)', 'text')).toEqual([]);
});

test('tabular Treehouse status fails closed for a leased row without an exact holder', () => {
  for (const stdout of [
    '  1  leased  /pool/slot-1/repository',
    '  1  leased  /pool/slot-1/repository  (held by )',
    'leased /pool/slot-1/repository (held by canonical-goal)',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": "canonical-goal"}]',
  ]) {
    expect(() => parseTreehouseLeases(stdout, 'text')).toThrow();
  }
});
