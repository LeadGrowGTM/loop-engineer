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

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path';

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

export type LifecycleDependencyState = 'ready' | 'workspace-onboarding-required' | 'installable-drift';

export interface LifecycleDependency {
  name: 'tasks-axi' | 'treehouse' | 'batch-grill-me';
  state: LifecycleDependencyState;
  ready: boolean;
}

export interface LifecycleDependencyReport {
  dependencies: LifecycleDependency[];
  ready: boolean;
}

export const AGENT_FILES = [
  'harness-planner.md',
  'harness-maker.md',
  'harness-prover.md',
  'harness-checker.md',
  'harness-shipper.md',
] as const;

export const SKILL_ROUTING_REQUIRED_STRUCTURE =
  'a Skill Routing heading and a Task type/Primary skill table with a separator and at least one route row';

function isEscaped(value: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

type MarkdownFence = {
  marker: '`' | '~';
  width: number;
};

function openingFence(line: string): MarkdownFence | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return null;
  return {
    marker: match[1][0] as MarkdownFence['marker'],
    width: match[1].length,
  };
}

function closesFence(line: string, fence: MarkdownFence): boolean {
  const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
  return match !== null && match[1][0] === fence.marker && match[1].length >= fence.width;
}

function stripHtmlComments(
  line: string,
  startsInsideComment: boolean,
): { visible: string; endsInsideComment: boolean } {
  let visible = '';
  let insideComment = startsInsideComment;
  let cursor = 0;

  while (cursor < line.length) {
    if (insideComment) {
      const commentEnd = line.indexOf('-->', cursor);
      if (commentEnd === -1) return { visible, endsInsideComment: true };
      insideComment = false;
      cursor = commentEnd + 3;
      continue;
    }

    const commentStart = line.indexOf('<!--', cursor);
    if (commentStart === -1) {
      visible += line.slice(cursor);
      break;
    }
    visible += line.slice(cursor, commentStart);
    insideComment = true;
    cursor = commentStart + 4;
  }

  return { visible, endsInsideComment: insideComment };
}

function activeMarkdownLines(content: string): Array<string | null> {
  let fence: MarkdownFence | null = null;
  let insideComment = false;

  return content.split(/\r?\n/).map((rawLine) => {
    if (fence) {
      if (closesFence(rawLine, fence)) fence = null;
      return null;
    }

    const stripped = stripHtmlComments(rawLine, insideComment);
    insideComment = stripped.endsInsideComment;
    if (/^(?: {4}|\t)/.test(stripped.visible)) return null;

    const openedFence = openingFence(stripped.visible);
    if (openedFence) {
      fence = openedFence;
      return null;
    }
    return stripped.visible;
  });
}

function parseMarkdownTableRow(line: string): string[] | null {
  const row = line.trim();
  const pipeIndexes: number[] = [];
  for (let index = 0; index < row.length; index += 1) {
    if (row[index] === '|' && !isEscaped(row, index)) pipeIndexes.push(index);
  }
  if (pipeIndexes.length === 0) return null;

  const startsWithOuterPipe = pipeIndexes[0] === 0;
  const endsWithOuterPipe = pipeIndexes.at(-1) === row.length - 1;
  const rowStart = startsWithOuterPipe ? 1 : 0;
  const rowEnd = endsWithOuterPipe ? row.length - 1 : row.length;
  const delimiters = pipeIndexes.filter((index) => index >= rowStart && index < rowEnd);

  const cells: string[] = [];
  let cellStart = rowStart;
  for (const delimiter of delimiters) {
    cells.push(row.slice(cellStart, delimiter).trim());
    cellStart = delimiter + 1;
  }
  cells.push(row.slice(cellStart, rowEnd).trim());
  return cells;
}

export function isValidSkillRouting(content: string): boolean {
  const lines = activeMarkdownLines(content);
  const headingIndex = lines.findIndex((line) =>
    line !== null && /^#{1,6}\s+.*\bskill routing\b/i.test(line.trim()),
  );
  if (headingIndex === -1) return false;

  let foundRoutingTable = false;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const header = parseMarkdownTableRow(lines[index] ?? '');
    const isRoutingHeader = header?.[0]?.toLowerCase() === 'task type' &&
      header[1]?.toLowerCase() === 'primary skill';
    if (!header || !isRoutingHeader) continue;
    foundRoutingTable = true;

    const separator = parseMarkdownTableRow(lines[index + 1] ?? '');
    if (!separator || separator.length !== header.length) return false;
    if (!separator.every((cell) => /^:?-{3,}:?$/.test(cell))) return false;

    let routeCount = 0;
    let routeIndex = index + 2;
    for (; routeIndex < lines.length; routeIndex += 1) {
      const route = parseMarkdownTableRow(lines[routeIndex] ?? '');
      if (!route) break;
      if (
        route.length !== header.length ||
        route[0].length === 0 ||
        route[1].length === 0
      ) {
        return false;
      }
      routeCount += 1;
    }
    if (routeCount === 0) return false;
    index = routeIndex - 1;
  }

  return foundRoutingTable;
}

export const GUARD_RELATIVE_PATH = 'scripts/guard-protected-work.ts';
const SOURCE_GUARD_PATH = join(import.meta.dir, 'guard-protected-work.ts');
const VENDORED_GRILL_RELATIVE_PATH = '.claude/skills/batch-grill-me/SKILL.md';
const SOURCE_GRILL_PATH = join(import.meta.dir, '../skills/setup-harness/vendor/batch-grill-me/SKILL.md');
const TREEHOUSE_CONFIG = 'max_trees = 16\nroot = ".worktrees/"\n';

type ContainedPathKind = 'directory' | 'regular-file';

function lstatIfPresent(path: string): ReturnType<typeof lstatSync> | null {
  try {
    return lstatSync(path);
  } catch (error) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

function pathKey(path: string): string {
  const resolved = resolve(path);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function pathsMatch(left: string, right: string): boolean {
  return pathKey(left) === pathKey(right);
}

function isPathContained(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (
    rel !== '..' &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
}

function canonicalExistingEntry(path: string): string {
  const stats = lstatIfPresent(path);
  if (!stats) throw new Error(`Required path does not exist: ${path}`);
  if (stats.isSymbolicLink()) {
    throw new Error(`Refusing symbolic link, junction, or reparse path: ${path}`);
  }

  const canonical = realpathSync.native(path);
  const canonicalParent = realpathSync.native(dirname(path));
  const expected = resolve(canonicalParent, basename(path));
  if (!pathsMatch(canonical, expected)) {
    throw new Error(`Refusing symbolic link, junction, or reparse path: ${path}`);
  }
  return canonical;
}

function trustedTargetDirectory(targetDir: string): string {
  const requested = resolve(targetDir);
  const stats = lstatIfPresent(requested);
  if (!stats) throw new Error(`Target directory does not exist: ${requested}`);
  if (!stats.isDirectory()) throw new Error(`Target is not a directory: ${requested}`);
  return canonicalExistingEntry(requested);
}

function trustedContainedPath(
  trustedTargetDir: string,
  relativePath: string,
  expectedKind: ContainedPathKind,
): string {
  const candidate = resolve(trustedTargetDir, relativePath);
  if (!isPathContained(trustedTargetDir, candidate)) {
    throw new Error(`Refusing path outside target: ${candidate}`);
  }

  const rel = relative(trustedTargetDir, candidate);
  const components = rel === '' ? [] : rel.split(sep);
  let current = trustedTargetDir;

  for (let index = 0; index < components.length; index += 1) {
    current = join(current, components[index]);
    const stats = lstatIfPresent(current);
    if (!stats) break;

    const canonical = canonicalExistingEntry(current);
    if (!isPathContained(trustedTargetDir, canonical)) {
      throw new Error(`Refusing path outside target: ${current}`);
    }

    const isFinal = index === components.length - 1;
    if ((!isFinal || expectedKind === 'directory') && !stats.isDirectory()) {
      throw new Error(`Expected directory path component: ${current}`);
    }
    if (isFinal && expectedKind === 'regular-file' && !stats.isFile()) {
      throw new Error(`Expected regular file: ${current}`);
    }
  }

  return candidate;
}

function trustedHomeDirectory(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (!home) throw new Error('Cannot determine home directory for agents install (HOME/USERPROFILE unset)');
  return trustedTargetDirectory(home);
}

function mkdirTrustedHomePath(relativePath: string): string {
  const home = trustedHomeDirectory();
  const destination = trustedContainedPath(home, relativePath, 'directory');
  mkdirSync(destination, { recursive: true });
  return trustedContainedPath(home, relativePath, 'directory');
}

type InstallPaths = {
  targetDir: string;
  agentsDir: string;
  guardPath: string;
  routingPath: string;
  goalsDir: string;
  claudeDir: string;
  tasksTomlPath: string;
  treehouseTomlPath: string;
  gitignorePath: string;
  claudeMdPath: string;
  grillSkillPath: string;
};

// Fail closed with zero side effects when any install destination - including
// the global agents directory - is untrusted, before any mkdir/copy/write runs.
function validateInstallPaths(targetDir: string): InstallPaths {
  const trustedTargetDir = trustedTargetDirectory(targetDir);
  return {
    targetDir: trustedTargetDir,
    agentsDir: trustedContainedPath(trustedHomeDirectory(), '.claude/agents', 'directory'),
    guardPath: trustedContainedPath(trustedTargetDir, GUARD_RELATIVE_PATH, 'regular-file'),
    routingPath: trustedContainedPath(
      trustedTargetDir,
      '.harness/skill-routing.md',
      'regular-file',
    ),
    goalsDir: trustedContainedPath(trustedTargetDir, '.harness/goals', 'directory'),
    claudeDir: trustedContainedPath(trustedTargetDir, '.claude', 'directory'),
    tasksTomlPath: trustedContainedPath(trustedTargetDir, '.tasks.toml', 'regular-file'),
    treehouseTomlPath: trustedContainedPath(trustedTargetDir, 'treehouse.toml', 'regular-file'),
    gitignorePath: trustedContainedPath(trustedTargetDir, '.gitignore', 'regular-file'),
    claudeMdPath: trustedContainedPath(trustedTargetDir, 'CLAUDE.md', 'regular-file'),
    grillSkillPath: trustedContainedPath(
      trustedHomeDirectory(),
      VENDORED_GRILL_RELATIVE_PATH,
      'regular-file',
    ),
  };
}

function commandIsUsable(command: string, cwd: string): boolean {
  try {
    const result = Bun.spawnSync([command, '--version'], { cwd, stdout: 'pipe', stderr: 'pipe' });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export function doctorLifecycleDependencies(targetDir: string): LifecycleDependencyReport {
  const trustedTargetDir = trustedTargetDirectory(targetDir);
  const tasksAxiReady = commandIsUsable('tasks-axi', trustedTargetDir);
  const treehouseReady = commandIsUsable('treehouse', trustedTargetDir);
  let grillReady = false;
  try {
    const grillPath = trustedContainedPath(
      trustedHomeDirectory(),
      VENDORED_GRILL_RELATIVE_PATH,
      'regular-file',
    );
    grillReady = existsSync(grillPath) &&
      readFileSync(grillPath).equals(readFileSync(SOURCE_GRILL_PATH));
  } catch {
    grillReady = false;
  }
  const dependencies: LifecycleDependency[] = [
    {
      name: 'tasks-axi',
      state: tasksAxiReady ? 'ready' : 'workspace-onboarding-required',
      ready: tasksAxiReady,
    },
    {
      name: 'treehouse',
      state: treehouseReady ? 'ready' : 'workspace-onboarding-required',
      ready: treehouseReady,
    },
    {
      name: 'batch-grill-me',
      state: grillReady ? 'ready' : 'installable-drift',
      ready: grillReady,
    },
  ];
  return { dependencies, ready: dependencies.every((dependency) => dependency.ready) };
}

function treehouseProvesNoActiveLeases(targetDir: string): boolean {
  try {
    const result = Bun.spawnSync(['treehouse', 'status'], { cwd: targetDir, stdout: 'pipe', stderr: 'pipe' });
    if (result.exitCode !== 0) return false;
    const status = result.stdout.toString().trim();
    return /^(?:NO_ACTIVE_LEASES|no active leases|no leases)$/i.test(status);
  } catch {
    return false;
  }
}

function isLegacyTreehouseConfig(content: string): boolean {
  return /^\s*root\s*=\s*["']\.tmp\/treehouse\/["']\s*$/m.test(content);
}

function repairLegacyTreehouseConfig(content: string): string {
  return content.replace(
    /^(\s*root\s*=\s*["'])\.tmp\/treehouse\/(["']\s*)$/m,
    '$1.worktrees/$2',
  );
}

function trustedExistingRegularFile(targetDir: string, relativePath: string): string | null {
  try {
    const trustedTargetDir = trustedTargetDirectory(targetDir);
    const path = trustedContainedPath(trustedTargetDir, relativePath, 'regular-file');
    return lstatIfPresent(path)?.isFile() ? path : null;
  } catch {
    return null;
  }
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

function escapeMarkdownTableCell(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/\r\n|\r|\n/g, '<br>');
}

export function seedRoutingTable(skills: SkillEntry[], template: string): string {
  const knownNames = new Set<string>();
  const templateMatches = template.match(/`\/([a-z0-9:_-]+)`/g) ?? [];
  for (const m of templateMatches) knownNames.add(m.replace(/`\//g, '').replace(/`/g, ''));

  const repoSpecific = skills.filter((s) => !knownNames.has(s.name));
  if (!repoSpecific.length) return template;

  const header = `\n\n## Repo-specific skills (auto-seeded by setup-harness)\n\n| Task type | Primary skill | Notes |\n| --- | --- | --- |`;
  const rows = repoSpecific
    .map((skill) => {
      const taskType = escapeMarkdownTableCell(skill.description || skill.name);
      const primarySkill = escapeMarkdownTableCell(`/${skill.name}`);
      const notes = escapeMarkdownTableCell('(repo-specific)');
      return `| ${taskType} | \`${primarySkill}\` | ${notes} |`;
    })
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
    isValidSkillRouting(readFileSync(routingPath, 'utf8'));
  const guardPath = trustedExistingRegularFile(targetDir, GUARD_RELATIVE_PATH);
  const guardMatchesSource = guardPath !== null &&
    readFileSync(guardPath).equals(readFileSync(SOURCE_GUARD_PATH));
  const guardResult = guardMatchesSource
    ? Bun.spawnSync([process.execPath, guardPath, '--help'], { stdout: 'pipe', stderr: 'pipe' })
    : null;
  const guardOk = guardResult?.exitCode === 0
    && guardResult.stdout.toString().includes('guard-protected-work');

  return [
    ...AGENT_FILES.map((file) => ({
      check: `${file} in agents dir`,
      passed: existsSync(join(agentsDir, file)),
    })),
    {
      check: 'guard-protected-work.ts exists and executes',
      passed: guardOk,
    },
    {
      check: 'skill-routing.md has the required heading and route table',
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
    const targetDirArg = rest[0];
    // Validate every destination, including the global agents directory, before
    // any mkdir/copy/write runs - fail closed with zero side effects.
    validateInstallPaths(targetDirArg);

    // Re-validated immediately before each write below too, so a concurrent
    // local writer can't swap a validated directory for a symlink between
    // this initial check and the actual fs call.
    const revalidated = (relativePath: string, expectedKind: ContainedPathKind) =>
      trustedContainedPath(trustedTargetDirectory(targetDirArg), relativePath, expectedKind);
    const trustedAgentsDir = () => trustedContainedPath(trustedHomeDirectory(), '.claude/agents', 'directory');
    const trustedGrillSkillPath = () => trustedContainedPath(
      trustedHomeDirectory(),
      VENDORED_GRILL_RELATIVE_PATH,
      'regular-file',
    );

    const targetDir = trustedTargetDirectory(targetDirArg);
    const sourceAgentsDir = join(import.meta.dir, '../.claude/agents');

    mkdirSync(trustedAgentsDir(), { recursive: true });
    for (const f of AGENT_FILES) {
      const destPath = trustedContainedPath(trustedAgentsDir(), f, 'regular-file');
      copyFileSync(join(sourceAgentsDir, f), destPath);
      console.log(`Copied ${f} → ${destPath}`);
    }

    mkdirTrustedHomePath('.claude');
    mkdirTrustedHomePath('.claude/skills');
    mkdirTrustedHomePath('.claude/skills/batch-grill-me');
    const grillSkillPath = trustedGrillSkillPath();
    copyFileSync(SOURCE_GRILL_PATH, trustedGrillSkillPath());
    console.log(`Installed bundled batch-grill-me → ${grillSkillPath}`);

    const guardPath = revalidated(GUARD_RELATIVE_PATH, 'regular-file');
    mkdirSync(dirname(guardPath), { recursive: true });
    copyFileSync(SOURCE_GUARD_PATH, guardPath);
    console.log(`Copied ${GUARD_RELATIVE_PATH} → ${guardPath}`);

    const templatePath = join(import.meta.dir, '../skills/setup-harness/routing-template.md');
    const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : '';
    const skills = scanSkills(targetDir);
    const routing = seedRoutingTable(skills, template);
    const routingPath = revalidated('.harness/skill-routing.md', 'regular-file');
    mkdirSync(dirname(routingPath), { recursive: true });
    writeFileSync(routingPath, routing);
    console.log(`Wrote .harness/skill-routing.md (${skills.length} skills scanned)`);

    // Working-dir home for goal runs (BRIEF/PLAN/issues/PROGRESS/CYCLE_LOG/HANDOFF live under here).
    mkdirSync(revalidated('.harness/goals', 'directory'), { recursive: true });

    // Seed a per-project backlog so tasks-axi scopes to THIS repo, not the monorepo root.
    mkdirSync(revalidated('.claude', 'directory'), { recursive: true });
    const tasksTomlPath = revalidated('.tasks.toml', 'regular-file');
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
    const treehouseTomlPath = revalidated('treehouse.toml', 'regular-file');
    let treehouseRepairBlocked = false;
    const legacyTreehouseConfig = existsSync(treehouseTomlPath) &&
      isLegacyTreehouseConfig(readFileSync(treehouseTomlPath, 'utf8'));
    if (legacyTreehouseConfig) {
      if (treehouseProvesNoActiveLeases(targetDir)) {
        writeFileSync(
          treehouseTomlPath,
          repairLegacyTreehouseConfig(readFileSync(treehouseTomlPath, 'utf8')),
        );
        console.log('Repaired treehouse.toml legacy pool after no-active-lease status');
      } else {
        treehouseRepairBlocked = true;
        console.log('treehouse.toml repair blocked by active or unknown leases');
      }
    }
    if (!existsSync(treehouseTomlPath)) {
      writeFileSync(treehouseTomlPath, TREEHOUSE_CONFIG);
      console.log('Wrote treehouse.toml (per-project worktree pool)');
    } else if (!legacyTreehouseConfig) {
      console.log('treehouse.toml already present — left as-is');
    }

    // Keep the project-local worktree pool out of git.
    const gitignorePath = revalidated('.gitignore', 'regular-file');
    const ignoreLines = ['.worktrees/'];
    const existingIgnore = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : '';
    const missing = ignoreLines.filter((l) => !existingIgnore.split(/\r?\n/).includes(l));
    if (missing.length) {
      const sep = existingIgnore && !existingIgnore.endsWith('\n') ? '\n' : '';
      writeFileSync(gitignorePath, existingIgnore + sep + missing.join('\n') + '\n');
      console.log(`Added ${missing.join(', ')} to .gitignore`);
    }

    const claudeMdPath = revalidated('CLAUDE.md', 'regular-file');
    if (existsSync(claudeMdPath)) {
      const sha = (() => {
        const result = Bun.spawnSync(
          ['git', '--no-optional-locks', '-C', import.meta.dir, 'rev-parse', '--short', 'HEAD'],
          { stdout: 'pipe', stderr: 'pipe' },
        );
        return result.exitCode === 0 ? result.stdout.toString().trim() : 'unknown';
      })();
      const block = `## Harness\nInstalled: ${new Date().toISOString().slice(0, 10)}. Source: LeadGrowGTM/loop-engineer@${sha}.\nRouting: \`.harness/skill-routing.md\`. Goals: \`.harness/goals/<slug>/\`. Backlog: \`.tasks.toml\` → \`.claude/backlog.md\` (project-scoped). Worktrees: \`treehouse.toml\` (project-scoped). Readiness: run loop-engineer's non-launching readiness check before work; use explicit isolation preparation when a worktree is required. Agents: global (\`~/.claude/agents/\`).`;
      writeFileSync(claudeMdPath, patchClaudeMd(readFileSync(claudeMdPath, 'utf8'), block));
      console.log('Updated CLAUDE.md ## Harness block');
    }

    const smoke = smokeTest(targetDir, trustedAgentsDir());
    console.log('\nSmoke test:');
    for (const r of smoke) console.log(`  ${r.passed ? '✓' : '✗'} ${r.check}`);
    if (!smoke.every((r) => r.passed)) process.exit(1);

    const dependencies = doctorLifecycleDependencies(targetDir);
    console.log('\nLifecycle dependencies:');
    for (const dependency of dependencies.dependencies) {
      const suffix = dependency.state === 'workspace-onboarding-required'
        ? 'workspace onboarding required'
        : dependency.state === 'installable-drift'
          ? 'installable bundled skill drift'
          : 'ready';
      console.log(`  ${dependency.name}: ${suffix}`);
    }
    if (treehouseRepairBlocked || !dependencies.ready) process.exit(1);
  } else {
    console.error('Commands: scan <dir> | smoke <target-dir> <agents-dir> | install <target-dir>');
    process.exit(1);
  }
}
