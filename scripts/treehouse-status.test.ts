import { expect, test } from 'bun:test';
import { LIFECYCLE_DEPENDENCY_VERSIONS } from './lifecycle-dependencies';
import { parseTreehouseLeases, parseTreehouseSlots, treehouseStatusArgs, treehouseStatusContract } from './goal-lifecycle/treehouse';

// The real CLI contracts: Treehouse 1.8.0 `status` rows and 3.1.0 `status --json` records on stdout, banner and empty-pool notice on stderr.
const parse = (stdout: string, contract: 'json' | 'text', stderr = '') => parseTreehouseLeases({ stdout, stderr }, contract);
const UPDATE_BANNER = 'A new version of treehouse is available: v3.1.0 -> v3.1.3\nRun "treehouse update" to update\n';
const EMPTY_POOL_NOTICE = '🌳 No worktrees in pool.\n';

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

test('typed Treehouse status reports exact leased paths while the banner stays on stderr', () => {
  const stdout = JSON.stringify([
    { slot: 1, path: '/pool/slot-1/repository', status: 'leased', lease_holder: 'canonical-goal', branch: 'wt/canonical-goal' },
    { slot: 2, path: '/pool/slot-2/repository', status: 'available', lease_holder: null },
  ]);

  expect(parse(stdout, 'json', UPDATE_BANNER)).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
});

test('typed Treehouse status reports an empty pool as no leases', () => {
  expect(parse('[]\n', 'json', UPDATE_BANNER)).toEqual([]);
});

test('typed Treehouse status reads a single-entry pool and pretty-printed entries', () => {
  const entries = [{ path: '/pool/slot-1/repository', status: 'leased', lease_holder: 'canonical-goal' }];

  expect(parse(JSON.stringify(entries), 'json')).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
  expect(parse(JSON.stringify(entries, null, 2), 'json')).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
});

test('typed Treehouse status fails closed for output it cannot read as lease records', () => {
  for (const stdout of [
    '',
    '1 leased /pool/slot-1/repository (held by canonical-goal)',
    'A new version of treehouse is available\n[]',
    '[',
    '[{"path": "/pool/slot-1/repository"}]',
    '[{"status": "leased"}]',
    '[{"path": "", "status": "leased"}]',
    '[{"path": "/pool/slot-1/repository", "status": "frozen"}]',
    '[{"path": "/pool/slot-1/repository", "status": "free"}]',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": 7}]',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": null}]',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": "  "}]',
    '{"path": "/pool/slot-1/repository", "status": "leased"}',
    '["/pool/slot-1/repository"]',
  ]) {
    expect(() => parse(stdout, 'json')).toThrow();
  }
});

test('typed Treehouse status accepts every audited non-lease pool status', () => {
  for (const status of ['available', 'dirty', 'in-use', "you're here", 'damaged', 'unverified']) {
    expect(parse(JSON.stringify([{ path: '/pool/slot-1/repository', status }]), 'json')).toEqual([]);
  }
});

test('Treehouse status reports every pool slot for audit while leases stay leased-only', () => {
  const json = JSON.stringify([
    { path: '/pool/slot-1/repository', status: 'leased', lease_holder: 'canonical-goal' },
    { path: '/pool/slot-2/repository', status: 'available', lease_holder: null },
    { path: '/pool/slot-3/repository', status: 'dirty', lease_holder: null },
  ]);
  const text = [
    '1     leased       /pool/slot-1/repository  (held by canonical-goal)',
    '                   bash (891911), bun (891912)',
    '2     available    /pool/slot-2/repository',
    '3     dirty        /pool/slot-3/repository',
  ].join('\n');
  const slots = [
    { path: '/pool/slot-1/repository', status: 'leased', holder: 'canonical-goal' },
    { path: '/pool/slot-2/repository', status: 'available', holder: null },
    { path: '/pool/slot-3/repository', status: 'dirty', holder: null },
  ];

  expect(parseTreehouseSlots({ stdout: json, stderr: UPDATE_BANNER }, 'json')).toEqual(slots);
  expect(parseTreehouseSlots({ stdout: text, stderr: UPDATE_BANNER }, 'text')).toEqual(slots);
  expect(parse(json, 'json')).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
});

test('tabular Treehouse status reports exact leased paths and ignores available slots', () => {
  const stdout = [
    '1     leased       /pool/slot-1/repository  (held by canonical-goal)',
    '                   bash (891911), bun (891912)',
    '2     available    /pool/slot-2/repository',
  ].join('\n');

  expect(parse(stdout, 'text', UPDATE_BANNER)).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
});

test('tabular Treehouse status accepts an empty pool only with the audited empty-pool notice', () => {
  expect(parse('', 'text', UPDATE_BANNER + EMPTY_POOL_NOTICE)).toEqual([]);
  expect(() => parse('', 'text', UPDATE_BANNER)).toThrow(/audited empty-pool message/);
  expect(() => parse('\n  \n', 'text', '')).toThrow(/audited empty-pool message/);
});

test('tabular Treehouse status fails closed for rows it cannot read as pool records', () => {
  for (const stdout of [
    '1     leased       /pool/slot-1/repository',
    '1     leased       /pool/slot-1/repository  (held by )',
    'leased /pool/slot-1/repository (held by canonical-goal)',
    '1     frozen       /pool/slot-1/repository',
    '1     free         /pool/slot-2/repository',
    '                   bash (891911), bun (891912)',
    'leased       /pool/slot-1/repository  (held by canonical-goal)',
    '[{"path": "/pool/slot-1/repository", "status": "leased", "lease_holder": "canonical-goal"}]',
  ]) {
    expect(() => parse(stdout, 'text', EMPTY_POOL_NOTICE)).toThrow();
  }
});
