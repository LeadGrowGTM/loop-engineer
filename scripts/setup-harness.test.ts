import { test, expect, describe } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  AGENT_FILES,
  GUARD_RELATIVE_PATH,
  isValidSkillRouting,
  patchClaudeMd,
  scanSkills,
  seedRoutingTable,
  smokeTest,
} from './setup-harness';

// ── test fixtures ──────────────────────────────────────────────────────────

const TMP_BASE = join(import.meta.dir, '../.test-tmp');
const GUARD_SOURCE = readFileSync(join(import.meta.dir, 'guard-protected-work.ts'), 'utf8');
let tmpCounter = 0;
const VALID_ROUTING = [
  '# Skill Routing',
  '| Task type | Primary skill |',
  '| --- | --- |',
  '| Bug fix | `/diagnosing-bugs` |',
].join('\n');

function scaffold(files: Record<string, string>): string {
  const dir = join(TMP_BASE, String(tmpCounter++));
  rmSync(dir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(abs.replace(/[^/\\]+$/, ''), { recursive: true });
    writeFileSync(abs, content);
  }
  return dir;
}

// ── isValidSkillRouting ────────────────────────────────────────────────────

describe('isValidSkillRouting', () => {
  test('accepts a short routing document with the required structure', () => {
    expect(isValidSkillRouting(VALID_ROUTING)).toBe(true);
  });

  test('rejects long unrelated content', () => {
    expect(isValidSkillRouting(Array(20).fill('garbage').join('\n'))).toBe(false);
  });

  test('rejects blank lines', () => {
    expect(isValidSkillRouting('\n'.repeat(20))).toBe(false);
  });

  test('rejects a malformed routing table', () => {
    const malformed = [
      '# Skill Routing',
      '| Task type | Primary skill |',
      '| not a separator | still not a separator |',
      '| Bug fix | `/diagnosing-bugs` |',
    ].join('\n');

    expect(isValidSkillRouting(malformed)).toBe(false);
  });

  test('rejects a missing-primary route without a closing outer pipe', () => {
    const malformed = [
      '# Skill Routing',
      '| Task type | Primary skill | Notes |',
      '| --- | --- | --- |',
      '| Bug fix | `/diagnosing-bugs` | Valid route |',
      '| New feature',
    ].join('\n');

    expect(isValidSkillRouting(malformed)).toBe(false);
  });

  test('accepts a routing table without outer pipes', () => {
    const routing = [
      '# Skill Routing',
      'Task type | Primary skill | Notes',
      '--- | --- | ---',
      'Bug fix | `/diagnosing-bugs` | Find the cause',
    ].join('\n');

    expect(isValidSkillRouting(routing)).toBe(true);
  });

  test('accepts an escaped pipe inside Notes', () => {
    const routing = [
      '# Skill Routing',
      '| Task type | Primary skill | Notes |',
      '| --- | --- | --- |',
      '| Bug fix | `/diagnosing-bugs` | Keep A \\| B in one cell |',
    ].join('\n');

    expect(isValidSkillRouting(routing)).toBe(true);
  });

  test('rejects routing found only inside a fenced code block', () => {
    const fenced = ['```markdown', VALID_ROUTING, '```'].join('\n');

    expect(isValidSkillRouting(fenced)).toBe(false);
  });

  test('ignores indented-code and HTML-comment routing headings and tables', () => {
    const indentedRouting = VALID_ROUTING
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n');
    const commentedRouting = ['<!--', VALID_ROUTING, '-->'].join('\n');
    const indentedTable = [
      '# Skill Routing',
      '    | Task type | Primary skill |',
      '    | --- | --- |',
      '    | Bug fix | `/diagnosing-bugs` |',
    ].join('\n');
    const commentedTable = [
      '# Skill Routing',
      '<!--',
      '| Task type | Primary skill |',
      '| --- | --- |',
      '| Bug fix | `/diagnosing-bugs` |',
      '-->',
    ].join('\n');

    expect(isValidSkillRouting(indentedRouting)).toBe(false);
    expect(isValidSkillRouting(commentedRouting)).toBe(false);
    expect(isValidSkillRouting(indentedTable)).toBe(false);
    expect(isValidSkillRouting(commentedTable)).toBe(false);
  });
});

function runChecked(command: string[]): void {
  const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' });
  if (result.exitCode !== 0) {
    throw new Error(`${command.join(' ')} failed (${result.exitCode})\n${result.stderr.toString()}`);
  }
}

// ── scanSkills ─────────────────────────────────────────────────────────────

describe('scanSkills', () => {
  test('tracer bullet: finds one SKILL.md and extracts name + description', () => {
    const dir = scaffold({
      'skills/tdd/SKILL.md': `---
name: tdd
description: Test-driven development skill
---
# TDD
Body here.
`,
    });

    const results = scanSkills(dir);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('tdd');
    expect(results[0].description).toBe('Test-driven development skill');
  });

  test('finds multiple SKILL.md files across nested dirs', () => {
    const dir = scaffold({
      '.claude/skills/cold-email-copywriter/SKILL.md': `---
name: cold-email-copywriter
description: Writes cold email sequences
---`,
      '.claude/skills/research/SKILL.md': `---
name: research
description: Market research skill
---`,
    });

    const results = scanSkills(dir);
    const names = results.map((r) => r.name).sort();

    expect(names).toEqual(['cold-email-copywriter', 'research']);
  });

  test('skips files without YAML frontmatter', () => {
    const dir = scaffold({
      'skills/no-frontmatter/SKILL.md': `# Just a heading\nNo frontmatter here.`,
    });

    const results = scanSkills(dir);
    expect(results).toHaveLength(0);
  });

  test('returns empty array when no SKILL.md files exist', () => {
    const dir = scaffold({ 'README.md': '# nothing' });
    expect(scanSkills(dir)).toEqual([]);
  });
});

// ── seedRoutingTable ───────────────────────────────────────────────────────

describe('seedRoutingTable', () => {
  const TEMPLATE = `| Task type | Primary skill | Notes |
| --- | --- | --- |
| New feature (code) | \`/tdd\` | Write failing tests first |
| Content / copy | \`/cold-email-copywriter\` | Write → shape → verify |`;

  test('includes rows for skills found in the template', () => {
    const skills = [{ name: 'tdd', description: 'TDD skill', path: '/x' }];
    const result = seedRoutingTable(skills, TEMPLATE);
    expect(result).toContain('/tdd');
  });

  test('appends repo-specific row for skills not in template', () => {
    const skills = [{ name: 'my-custom-skill', description: 'Does custom things', path: '/x' }];
    const result = seedRoutingTable(skills, TEMPLATE);
    expect(result).toContain('my-custom-skill');
    expect(result).toContain('(repo-specific)');
  });

  test('output is valid markdown table (starts with pipe)', () => {
    const result = seedRoutingTable([], TEMPLATE);
    const lines = result.split('\n').filter((l) => l.trim());
    expect(lines[0]).toMatch(/^\|/);
  });

  test('escapes a pipe-bearing description into validator-safe routing', () => {
    const skills = [{
      name: 'compare-systems',
      description: 'Compare system A | system B',
      path: '/x',
    }];
    const result = seedRoutingTable(skills, `# Skill Routing\n\n${TEMPLATE}`);

    expect(result).toContain('Compare system A \\| system B');
    expect(isValidSkillRouting(result)).toBe(true);
  });
});

// ── patchClaudeMd ──────────────────────────────────────────────────────────

describe('patchClaudeMd', () => {
  const BLOCK = `## Harness
Installed: 2026-06-24. Source: LeadGrowGTM/loop-engineer@d979922.
Routing: \`.harness/skill-routing.md\`. Agents: global (\`~/.claude/agents/\`).`;

  test('inserts block when no ## Harness section exists', () => {
    const content = `# My Project\n\n## Other Section\nsome content\n`;
    const result = patchClaudeMd(content, BLOCK);
    expect(result).toContain('## Harness');
    expect(result).toContain('d979922');
  });

  test('replaces existing ## Harness block in-place', () => {
    const content = `# Project\n\n## Harness\nOld harness block.\n\n## Other\ncontent\n`;
    const result = patchClaudeMd(content, BLOCK);
    expect(result).not.toContain('Old harness block.');
    expect(result).toContain('d979922');
    // only one ## Harness heading
    expect(result.split('## Harness').length).toBe(2);
  });

  test('running twice produces identical output (idempotent)', () => {
    const content = `# Project\n\n## Other\ncontent\n`;
    const once = patchClaudeMd(content, BLOCK);
    const twice = patchClaudeMd(once, BLOCK);
    expect(once).toBe(twice);
  });
});

// ── smokeTest ──────────────────────────────────────────────────────────────

describe('smokeTest', () => {
  test('all pass when all files exist', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': VALID_ROUTING,
      'CLAUDE.md': '## Harness\nInstalled.',
      [GUARD_RELATIVE_PATH]: GUARD_SOURCE,
    });
    const agentsDir = scaffold(Object.fromEntries(
      AGENT_FILES.map((file) => [file, `---\nname: ${file.replace('.md', '')}\n---`]),
    ));

    const results = smokeTest(dir, agentsDir);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  test('fails when harness-planner.md missing from agents dir', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': VALID_ROUTING,
      'CLAUDE.md': '## Harness\nInstalled.',
      [GUARD_RELATIVE_PATH]: GUARD_SOURCE,
    });
    const agentsDir = scaffold(Object.fromEntries(
      AGENT_FILES.filter((file) => file !== 'harness-planner.md').map((file) => [file, '---']),
    ));

    const results = smokeTest(dir, agentsDir);
    const plannerCheck = results.find((r) => r.check.includes('harness-planner'));
    expect(plannerCheck?.passed).toBe(false);
  });

  test('fails when skill-routing.md is malformed', () => {
    const malformedRouting = [
      '# Skill Routing',
      '| Task type | Primary skill |',
      '| not a separator | still not a separator |',
      '| Bug fix | `/diagnosing-bugs` |',
    ].join('\n');
    const dir = scaffold({
      '.harness/skill-routing.md': malformedRouting,
      'CLAUDE.md': '## Harness\nInstalled.',
      [GUARD_RELATIVE_PATH]: GUARD_SOURCE,
    });
    const agentsDir = scaffold(Object.fromEntries(AGENT_FILES.map((file) => [file, '---'])));

    const results = smokeTest(dir, agentsDir);
    const routingCheck = results.find((r) => r.check.includes('skill-routing'));
    expect(routingCheck?.passed).toBe(false);
  });

  test('fails when skill-routing.md is too short (< 10 lines)', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': '| one row |',
      'CLAUDE.md': '## Harness\nInstalled.',
      [GUARD_RELATIVE_PATH]: GUARD_SOURCE,
    });
    const agentsDir = scaffold(Object.fromEntries(AGENT_FILES.map((file) => [file, '---'])));

    const results = smokeTest(dir, agentsDir);
    const routingCheck = results.find((r) => r.check.includes('skill-routing'));
    expect(routingCheck?.passed).toBe(false);
  });

  test('fails when the target guard is missing', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': VALID_ROUTING,
      'CLAUDE.md': '## Harness\nInstalled.',
    });
    const agentsDir = scaffold(Object.fromEntries(AGENT_FILES.map((file) => [file, '---'])));

    const results = smokeTest(dir, agentsDir);
    const guardCheck = results.find((result) => result.check.includes('guard-protected-work'));
    expect(guardCheck?.passed).toBe(false);
  });

  test('fails when the target guard cannot execute', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': VALID_ROUTING,
      'CLAUDE.md': '## Harness\nInstalled.',
      [GUARD_RELATIVE_PATH]: 'throw new Error("broken guard");\n',
    });
    const agentsDir = scaffold(Object.fromEntries(AGENT_FILES.map((file) => [file, '---'])));

    const results = smokeTest(dir, agentsDir);
    const guardCheck = results.find((result) => result.check.includes('guard-protected-work'));
    expect(guardCheck?.passed).toBe(false);
  });

  test('smoke CLI rejects a target-controlled guard without executing it', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-harness-untrusted-guard-'));
    const target = join(root, 'target');
    const agentsDir = join(root, 'agents');
    const outsideSentinel = join(root, 'outside-sentinel.bin');
    const sentinel = Buffer.from([9, 8, 7, 6, 5, 4]);
    mkdirSync(join(target, '.harness'), { recursive: true });
    mkdirSync(join(target, 'scripts'), { recursive: true });
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(join(target, '.harness', 'skill-routing.md'), VALID_ROUTING);
    writeFileSync(join(target, 'CLAUDE.md'), '## Harness\nInstalled.');
    writeFileSync(outsideSentinel, sentinel);
    writeFileSync(
      join(target, GUARD_RELATIVE_PATH),
      `import { writeFileSync } from 'fs';\nwriteFileSync(${JSON.stringify(outsideSentinel)}, 'executed');\nconsole.log('guard-protected-work');\n`,
    );
    for (const file of AGENT_FILES) writeFileSync(join(agentsDir, file), '---');

    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, 'setup-harness.ts'), 'smoke', target, agentsDir],
      { stdout: 'pipe', stderr: 'pipe' },
    );

    expect({
      failed: result.exitCode !== 0,
      outsideSentinelUnchanged: readFileSync(outsideSentinel).equals(sentinel),
    }).toEqual({
      failed: true,
      outsideSentinelUnchanged: true,
    });
  });
});

describe('install CLI', () => {
  test('fails closed before writes when target scripts links outside the target', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-harness-linked-scripts-'));
    const target = join(root, 'target');
    const outsideScripts = join(root, 'outside-scripts');
    const home = join(root, 'home');
    mkdirSync(target, { recursive: true });
    mkdirSync(outsideScripts, { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(target, 'CLAUDE.md'), '# Fixture\n');

    const outsideGuard = join(outsideScripts, 'guard-protected-work.ts');
    const sentinel = Buffer.from([0, 255, 17, 34, 51, 68]);
    writeFileSync(outsideGuard, sentinel);
    symlinkSync(
      outsideScripts,
      join(target, 'scripts'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, 'setup-harness.ts'), 'install', target],
      {
        env: { ...process.env, HOME: home, USERPROFILE: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect({
      failed: result.exitCode !== 0,
      outsideSentinelUnchanged: readFileSync(outsideGuard).equals(sentinel),
      agentsCopied: existsSync(join(home, '.claude', 'agents')),
    }).toEqual({
      failed: true,
      outsideSentinelUnchanged: true,
      agentsCopied: false,
    });
  });

  test('fails closed before writes when the guard file links outside the target', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-harness-linked-guard-'));
    const target = join(root, 'target');
    const home = join(root, 'home');
    const outsideGuard = join(root, 'outside-guard.ts');
    const sentinel = Buffer.from([101, 102, 103, 104]);
    mkdirSync(join(target, 'scripts'), { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(target, 'CLAUDE.md'), '# Fixture\n');
    writeFileSync(outsideGuard, sentinel);
    try {
      symlinkSync(
        outsideGuard,
        join(target, GUARD_RELATIVE_PATH),
        process.platform === 'win32' ? 'file' : undefined,
      );
    } catch (error) {
      if (
        process.platform === 'win32' &&
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error.code === 'EPERM' || error.code === 'EACCES')
      ) {
        return;
      }
      throw error;
    }

    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, 'setup-harness.ts'), 'install', target],
      {
        env: { ...process.env, HOME: home, USERPROFILE: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect({
      failed: result.exitCode !== 0,
      outsideSentinelUnchanged: readFileSync(outsideGuard).equals(sentinel),
      agentsCopied: existsSync(join(home, '.claude', 'agents')),
    }).toEqual({
      failed: true,
      outsideSentinelUnchanged: true,
      agentsCopied: false,
    });
  });

  test('fails closed before writes on a non-directory intermediate component', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-harness-file-component-'));
    const target = join(root, 'target');
    const home = join(root, 'home');
    const scriptsPath = join(target, 'scripts');
    const sentinel = Buffer.from([201, 202, 203, 204]);
    mkdirSync(target, { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(target, 'CLAUDE.md'), '# Fixture\n');
    writeFileSync(scriptsPath, sentinel);

    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, 'setup-harness.ts'), 'install', target],
      {
        env: { ...process.env, HOME: home, USERPROFILE: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect({
      failed: result.exitCode !== 0,
      intermediateUnchanged: readFileSync(scriptsPath).equals(sentinel),
      agentsCopied: existsSync(join(home, '.claude', 'agents')),
    }).toEqual({
      failed: true,
      intermediateUnchanged: true,
      agentsCopied: false,
    });
  });

  test('seeds treehouse readiness without runner state or execution guidance', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-harness-install-'));
    const target = join(root, 'target repo');
    const home = join(root, 'home');
    mkdirSync(target, { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(target, 'CLAUDE.md'), '# Fixture\n');
    runChecked(['git', '-C', target, 'init', '-b', 'setup-test']);
    runChecked(['git', '-C', target, 'config', 'user.name', 'Setup Test']);
    runChecked(['git', '-C', target, 'config', 'user.email', 'setup@example.test']);
    runChecked(['git', '-C', target, 'add', '--', 'CLAUDE.md']);
    runChecked(['git', '-C', target, 'commit', '-m', 'fixture']);

    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, 'setup-harness.ts'), 'install', target],
      {
        env: { ...process.env, HOME: home, USERPROFILE: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect(result.exitCode).toBe(0);
    const installedGuard = readFileSync(join(target, GUARD_RELATIVE_PATH), 'utf8');
    expect(installedGuard).toBe(GUARD_SOURCE);
    expect(result.stdout.toString()).toContain('guard-protected-work.ts exists and executes');
    const guardHelp = Bun.spawnSync(
      [process.execPath, join(target, GUARD_RELATIVE_PATH), '--help'],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    expect(guardHelp.exitCode).toBe(0);
    const guardCapture = Bun.spawnSync(
      [
        process.execPath,
        join(target, GUARD_RELATIVE_PATH),
        'capture',
        '--repo', target,
        '--active-id', 'C24',
        '--allowed-path', 'CLAUDE.md',
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    );
    expect(guardCapture.exitCode).toBe(0);
    expect(JSON.parse(guardCapture.stdout.toString())).toMatchObject({
      schemaVersion: 1,
      operation: 'capture',
      activeId: 'C24',
    });
    const gitignore = readFileSync(join(target, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.tmp/treehouse/');
    expect(gitignore).not.toContain('.gnhf-runs/');
    const claudeMd = readFileSync(join(target, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('non-launching readiness');
    expect(claudeMd.toLowerCase()).not.toContain('gnhf');
  });

  test('exits nonzero when the final smoke checks fail', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-harness-smoke-failure-'));
    const target = join(root, 'target');
    const home = join(root, 'home');
    mkdirSync(target, { recursive: true });
    mkdirSync(home, { recursive: true });

    const result = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, 'setup-harness.ts'), 'install', target],
      {
        env: { ...process.env, HOME: home, USERPROFILE: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout.toString()).toContain('✗ CLAUDE.md has ## Harness block');
  });
});
