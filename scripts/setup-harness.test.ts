import { test, expect, describe } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { scanSkills, seedRoutingTable, patchClaudeMd, smokeTest, HARNESS_AGENTS } from './setup-harness';

// ── test fixtures ──────────────────────────────────────────────────────────

const TMP_BASE = join(import.meta.dir, '../.test-tmp');
let tmpCounter = 0;

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

describe('HARNESS_AGENTS', () => {
  test('is the full 4-agent set including the prover', () => {
    expect(HARNESS_AGENTS).toContain('harness-planner.md');
    expect(HARNESS_AGENTS).toContain('harness-maker.md');
    expect(HARNESS_AGENTS).toContain('harness-prover.md');
    expect(HARNESS_AGENTS).toContain('harness-checker.md');
    expect(HARNESS_AGENTS).toHaveLength(4);
  });
});

describe('smokeTest', () => {
  test('all pass when all files exist', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': Array(11).fill('| row |').join('\n'),
      'CLAUDE.md': '## Harness\nInstalled.',
    });
    const agentsDir = scaffold(
      Object.fromEntries(HARNESS_AGENTS.map((f) => [f, `---\nname: ${f.replace('.md', '')}\n---`])),
    );

    const results = smokeTest(dir, agentsDir);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  test('fails when harness-prover.md missing from agents dir', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': Array(11).fill('| row |').join('\n'),
      'CLAUDE.md': '## Harness\nInstalled.',
    });
    // every agent except the prover
    const agentsDir = scaffold(
      Object.fromEntries(
        HARNESS_AGENTS.filter((f) => f !== 'harness-prover.md').map((f) => [f, '---']),
      ),
    );

    const results = smokeTest(dir, agentsDir);
    const proverCheck = results.find((r) => r.check.includes('harness-prover'));
    expect(proverCheck?.passed).toBe(false);
  });

  test('fails when harness-planner.md missing from agents dir', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': Array(11).fill('| row |').join('\n'),
      'CLAUDE.md': '## Harness\nInstalled.',
    });
    const agentsDir = scaffold({
      'harness-maker.md': '---',
      'harness-checker.md': '---',
    });

    const results = smokeTest(dir, agentsDir);
    const plannerCheck = results.find((r) => r.check.includes('harness-planner'));
    expect(plannerCheck?.passed).toBe(false);
  });

  test('fails when skill-routing.md is too short (< 10 lines)', () => {
    const dir = scaffold({
      '.harness/skill-routing.md': '| one row |',
      'CLAUDE.md': '## Harness\nInstalled.',
    });
    const agentsDir = scaffold({
      'harness-planner.md': '---',
      'harness-maker.md': '---',
      'harness-checker.md': '---',
    });

    const results = smokeTest(dir, agentsDir);
    const routingCheck = results.find((r) => r.check.includes('skill-routing'));
    expect(routingCheck?.passed).toBe(false);
  });
});
