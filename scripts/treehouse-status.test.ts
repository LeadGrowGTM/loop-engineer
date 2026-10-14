import { expect, test } from 'bun:test';
import { parseTreehouseLeases } from './goal-lifecycle/treehouse';

// The parsed contract is Treehouse's `status --json` serialized output.
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

  expect(parseTreehouseLeases(stdout)).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
});

test('typed Treehouse status reports an empty pool as no leases', () => {
  expect(parseTreehouseLeases('A new version of treehouse is available\n[]\n')).toEqual([]);
});

test('typed Treehouse status preserves multi-line pretty-printed entries', () => {
  const stdout = JSON.stringify([{ path: '/pool/slot-1/repository', status: 'leased', lease_holder: 'canonical-goal' }], null, 2);

  expect(parseTreehouseLeases(stdout)).toEqual([{ path: '/pool/slot-1/repository', holder: 'canonical-goal' }]);
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
    '{"path": "/pool/slot-1/repository", "status": "leased"}',
  ]) {
    expect(() => parseTreehouseLeases(stdout)).toThrow();
  }
});
