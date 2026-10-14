import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeTaskDetail } from './goal-lifecycle/tasks-axi';

// Explicit opt-in: real installed CLI tools, disposable repository and HOME; no model calls.
test.skipIf(process.env.LOOP_ENGINEER_LIVE_CLI_TEST !== '1')('real CLI setup, start, restart, blocked retention, success and exact lease return', async () => {
  const root = mkdtempSync(join(tmpdir(), 'loop-live-cli-test-'));
  const repo = join(root, 'repo');
  const home = join(root, 'home');
  mkdirSync(repo); mkdirSync(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  async function command(argv: string[], cwd = repo) {
    const child = Bun.spawn(argv, { cwd, env, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { stdout, stderr, exitCode };
  }
  async function git(args: string[], cwd = repo) {
    const r = await command(['git', ...args], cwd);
    expect(r.exitCode).toBe(0);
    return r.stdout.trim();
  }
  await git(['init', '-b', 'main']);
  await git(['config', 'user.name', 'Disposable CLI Proof']);
  await git(['config', 'user.email', 'proof@example.invalid']);
  writeFileSync(join(repo, 'CLAUDE.md'), '# Disposable fixture\n');
  const setup = await command([process.execPath, join(import.meta.dir, 'setup-harness.ts'), 'install', repo]);
  expect(setup.exitCode).toBe(0);
  expect(existsSync(join(repo, '.worktrees'))).toBe(true);
  await git(['add', '.']); await git(['commit', '-m', 'fixture']);
  await git(['switch', '-c', 'source-proof']);
  async function lifecycle(args: string[], cwd = repo) {
    const r = await command([process.execPath, join(import.meta.dir, 'goal-lifecycle.ts'), ...args], cwd);
    const body = JSON.parse(r.stdout);
    console.log(`REAL_CLI ${args[0]} ${body.code} ${body.message}`);
    return { ...r, body };
  }
  const started = await lifecycle(['start', '--repo', repo, '--task-id', 'live-proof', '--title', 'Live proof']);
  expect(started.body.ok).toBe(true);
  const run = started.body.data.manifestPath;
  const cwd = started.body.data.worktreePath;
  const directory = started.body.data.runDirectory;
  expect(await git(['branch', '--show-current'], cwd)).toBe('wt/live-proof');
  const before = await lifecycle(['validate', '--run', run], cwd);
  expect(before.body.code).toBe('GRILL_RECEIPT_MISSING');
  writeFileSync(join(directory, 'candidate-GRILL.json'), JSON.stringify({
    schemaVersion: 1, taskId: 'live-proof', skill: { name: 'batch-grill-me', version: '1.0.0', sourceHash: '92a426f9ed319ca6f54ecf8fabe8c57f82e42dd71e7e5a2d11415fb6f903557f' },
    rounds: [], recommendations: [], settledDecisions: [], finalFrontierCount: 0, status: 'complete', redaction: { redacted: false, fields: [] },
  }));
  expect((await lifecycle(['record-grill', '--run', run, '--receipt', join(directory, 'candidate-GRILL.json')], cwd)).body.ok).toBe(true);
  writeFileSync(join(directory, 'BRIEF.md'), '# Synthetic lifecycle protocol fixture\n');
  writeFileSync(join(directory, 'HARNESS.md'), '# No agent delivery claimed\n');
  expect((await lifecycle(['validate', '--run', run], cwd)).body.ok).toBe(true);
  expect((await lifecycle(['validate', '--run', run], cwd)).body.ok).toBe(true);
  expect((await lifecycle(['finish', '--run', run], cwd)).body.code).toBe('FINISH_PRECONDITION_FAILED');
  writeFileSync(join(directory, 'HANDOFF.md'), '# Real CLI protocol proof, synthetic artifacts\n');
  await git(['add', '.harness'], cwd); await git(['commit', '-m', 'protocol fixture'], cwd);
  expect((await lifecycle(['validate', '--run', run], cwd)).body.ok).toBe(true);
  const progressHead = await git(['rev-parse', 'HEAD'], cwd);
  const progressTree = await git(['rev-parse', 'HEAD^{tree}'], cwd);
  const unrelatedHead = await git(['commit-tree', progressTree, '-m', 'unrelated fixture identity'], cwd);
  await git(['update-ref', 'refs/heads/wt/live-proof', unrelatedHead], cwd);
  expect((await lifecycle(['validate', '--run', run], cwd)).body.code).toBe('LEASE_IDENTITY_MISMATCH');
  await git(['update-ref', 'refs/heads/wt/live-proof', progressHead], cwd);
  expect((await lifecycle(['validate', '--run', run], cwd)).body.ok).toBe(true);
  const blocked = await lifecycle(['finish', '--run', run, '--outcome', 'blocked'], cwd);
  expect(blocked.body.ok).toBe(true);
  const held = await command(['treehouse', 'status', '--json']);
  expect(JSON.parse(held.stdout).some((entry: any) => entry.path === cwd && entry.lease_holder === 'live-proof' && entry.status === 'leased')).toBe(true);
  await git(['add', '.harness'], cwd); await git(['commit', '-m', 'recovery fixture'], cwd);
  expect((await lifecycle(['finish', '--run', run], cwd)).body.ok).toBe(true);
  const task = await command(['tasks-axi', 'show', 'live-proof', '--full', '--file', join(repo, '.claude/backlog.md')]);
  expect(decodeTaskDetail(task.stdout).state).toBe('done');
  const pool = await command(['treehouse', 'status', '--json']);
  expect(JSON.parse(pool.stdout).some((entry: any) => entry.path === cwd && entry.status === 'leased')).toBe(false);
  expect(await git(['branch', '--show-current'])).toBe('source-proof');
  console.log(`REAL_CLI_EVIDENCE ${root}`);
}, 90_000);
