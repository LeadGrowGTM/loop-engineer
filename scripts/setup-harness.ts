#!/usr/bin/env bun
/**
 * setup-harness — deterministic core for the /setup-harness skill
 *
 * Usage (called by the skill prompt):
 *   bun scripts/setup-harness.ts scan <dir>
 *   bun scripts/setup-harness.ts seed <dir> <template-path>
 *   bun scripts/setup-harness.ts patch <claude-md-path> <block-string>
 *   bun scripts/setup-harness.ts smoke <target-dir> <agents-dir>
 *   bun scripts/setup-harness.ts install <target-dir>
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';

// ── types ──────────────────────────────────────────────────────────────────

export interface SkillEntry {
  name: string;
  description: string;
  path: string;
}

export interface SmokeResult {
  check: string;
  passed: boolean;
}

// ── scanSkills ─────────────────────────────────────────────────────────────

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key) fields[key] = val;
  }
  return fields;
}

function globSkillMds(dir: string, results: string[] = []): string[] {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.test')) {
      globSkillMds(full, results);
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      results.push(full);
    }
  }
  return results;
}

export function scanSkills(dir: string): SkillEntry[] {
  const paths = globSkillMds(dir);
  const entries: SkillEntry[] = [];
  for (const p of paths) {
    const fm = parseFrontmatter(readFileSync(p, 'utf8'));
    if (!fm || !fm.name) continue;
    entries.push({ name: fm.name, description: fm.description ?? '', path: p });
  }
  return entries;
}

// ── seedRoutingTable ───────────────────────────────────────────────────────

export function seedRoutingTable(skills: SkillEntry[], template: string): string {
  const knownNames = new Set<string>();
  const templateMatches = template.match(/`\/([a-z0-9:_-]+)`/g) ?? [];
  for (const m of templateMatches) knownNames.add(m.replace(/`\//g, '').replace(/`/g, ''));

  const repoSpecific = skills.filter((s) => !knownNames.has(s.name));
  if (!repoSpecific.length) return template;

  const header = `\n\n## Repo-specific skills (auto-seeded by setup-harness)\n\n| Task type | Primary skill | Notes |\n| --- | --- | --- |`;
  const rows = repoSpecific
    .map((s) => `| ${s.description || s.name} | \`/${s.name}\` | (repo-specific) |`)
    .join('\n');

  return template + header + '\n' + rows;
}

// ── patchClaudeMd ──────────────────────────────────────────────────────────

export function patchClaudeMd(content: string, block: string): string {
  const MARKER = '## Harness';
  if (!content.includes(MARKER)) {
    return content.trimEnd() + '\n\n' + block + '\n';
  }
  const start = content.indexOf(MARKER);
  const rest = content.slice(start + MARKER.length);
  const nextMatch = rest.match(/\n+## /);
  const end = nextMatch?.index !== undefined
    ? start + MARKER.length + nextMatch.index
    : content.length;
  const suffix = content.slice(end).replace(/^\n+/, '');
  return content.slice(0, start) + block + (suffix ? '\n\n' + suffix : '\n');
}

// ── smokeTest ──────────────────────────────────────────────────────────────

export function smokeTest(targetDir: string, agentsDir: string): SmokeResult[] {
  const routingPath = join(targetDir, '.harness', 'skill-routing.md');
  const routingOk = existsSync(routingPath) &&
    readFileSync(routingPath, 'utf8').split('\n').length >= 10;

  return [
    {
      check: 'harness-planner.md in agents dir',
      passed: existsSync(join(agentsDir, 'harness-planner.md')),
    },
    {
      check: 'harness-maker.md in agents dir',
      passed: existsSync(join(agentsDir, 'harness-maker.md')),
    },
    {
      check: 'harness-checker.md in agents dir',
      passed: existsSync(join(agentsDir, 'harness-checker.md')),
    },
    {
      check: 'skill-routing.md exists and ≥ 10 lines',
      passed: routingOk,
    },
    {
      check: 'CLAUDE.md has ## Harness block',
      passed: existsSync(join(targetDir, 'CLAUDE.md')) &&
        readFileSync(join(targetDir, 'CLAUDE.md'), 'utf8').includes('## Harness'),
    },
  ];
}

// ── install (CLI entry point) ──────────────────────────────────────────────

if (import.meta.main) {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'scan') {
    const results = scanSkills(rest[0]);
    console.log(JSON.stringify(results, null, 2));
  } else if (cmd === 'smoke') {
    const results = smokeTest(rest[0], rest[1]);
    for (const r of results) {
      console.log(`${r.passed ? '✓' : '✗'} ${r.check}`);
    }
    if (!results.every((r) => r.passed)) process.exit(1);
  } else if (cmd === 'install') {
    const targetDir = rest[0];
    const agentsDir = join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.claude', 'agents');
    const sourceAgentsDir = join(import.meta.dir, '../.claude/agents');

    mkdirSync(agentsDir, { recursive: true });
    for (const f of ['harness-planner.md', 'harness-maker.md', 'harness-checker.md']) {
      copyFileSync(join(sourceAgentsDir, f), join(agentsDir, f));
      console.log(`Copied ${f} → ${agentsDir}`);
    }

    const templatePath = join(import.meta.dir, '../skills/setup-harness/routing-template.md');
    const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : '';
    const skills = scanSkills(targetDir);
    const routing = seedRoutingTable(skills, template);
    mkdirSync(join(targetDir, '.harness'), { recursive: true });
    writeFileSync(join(targetDir, '.harness', 'skill-routing.md'), routing);
    console.log(`Wrote .harness/skill-routing.md (${skills.length} skills scanned)`);

    // Working-dir home for goal runs (BRIEF/PLAN/issues/PROGRESS/CYCLE_LOG/HANDOFF live under here).
    mkdirSync(join(targetDir, '.harness', 'goals'), { recursive: true });

    // Seed a per-project backlog so tasks-axi scopes to THIS repo, not the monorepo root.
    mkdirSync(join(targetDir, '.claude'), { recursive: true });
    const tasksTomlPath = join(targetDir, '.tasks.toml');
    if (existsSync(tasksTomlPath)) {
      console.log('.tasks.toml already present — left as-is');
    } else {
      writeFileSync(
        tasksTomlPath,
        'backend = "markdown"\n\n[markdown]\npath = ".claude/backlog.md"\narchive = ".claude/done-archive.md"\ndone_keep = 30\n',
      );
      console.log('Wrote .tasks.toml (per-project backlog → .claude/backlog.md)');
    }

    // Seed a per-project treehouse pool so parallel worktrees anchor to THIS repo.
    // treehouse resolves the nearest treehouse.toml from cwd; without one, a run from
    // the project would fall through to the monorepo pool.
    const treehouseTomlPath = join(targetDir, 'treehouse.toml');
    if (existsSync(treehouseTomlPath)) {
      console.log('treehouse.toml already present — left as-is');
    } else {
      writeFileSync(treehouseTomlPath, 'max_trees = 16\nroot = ".tmp/treehouse/"\n');
      console.log('Wrote treehouse.toml (per-project worktree pool)');
    }

    const claudeMdPath = join(targetDir, 'CLAUDE.md');
    if (existsSync(claudeMdPath)) {
      const sha = (() => { try { return require('child_process').execSync('git -C ' + __dirname + ' rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
      const block = `## Harness\nInstalled: ${new Date().toISOString().slice(0, 10)}. Source: LeadGrowGTM/loop-engineer@${sha}.\nRouting: \`.harness/skill-routing.md\`. Goals: \`.harness/goals/<slug>/\`. Backlog: \`.tasks.toml\` → \`.claude/backlog.md\` (project-scoped). Worktrees: \`treehouse.toml\` (project-scoped). Agents: global (\`~/.claude/agents/\`).`;
      writeFileSync(claudeMdPath, patchClaudeMd(readFileSync(claudeMdPath, 'utf8'), block));
      console.log('Updated CLAUDE.md ## Harness block');
    }

    const smoke = smokeTest(targetDir, agentsDir);
    console.log('\nSmoke test:');
    for (const r of smoke) console.log(`  ${r.passed ? '✓' : '✗'} ${r.check}`);
  } else {
    console.error('Commands: scan <dir> | smoke <target-dir> <agents-dir> | install <target-dir>');
    process.exit(1);
  }
}
