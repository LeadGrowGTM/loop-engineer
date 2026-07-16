import { test, expect, describe } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Publish-policy consistency guard.
 *
 * Why this exists: the morning-report publish policy is stated in prose across many files.
 * On 2026-07-16 one file was flipped from "--password is MANDATORY" to "publish public" while
 * three others still mandated a password. Nothing caught it except a human reviewer at a ship
 * gate, and the same class of drift then recurred in a fifth file (docs/DEPENDENCIES.md) that
 * no one had listed.
 *
 * So these tests SCAN rather than hardcode a file list. A sixth file that documents the publish
 * command is covered the moment it is written. That is the whole point - a guard that only knows
 * about today's files reproduces today's bug.
 */

const REPO = join(import.meta.dir, '..');
const SCAN_DIRS = ['skills', 'docs'];
const SCAN_ROOT_FILES = ['README.md', 'CLAUDE.md'];

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const abs = join(dir, e);
    if (statSync(abs).isDirectory()) {
      out.push(...walkMarkdown(abs));
    } else if (e.endsWith('.md')) {
      out.push(abs);
    }
  }
  return out;
}

function policyFiles(): string[] {
  const files = SCAN_DIRS.flatMap((d) => walkMarkdown(join(REPO, d)));
  for (const f of SCAN_ROOT_FILES) files.push(join(REPO, f));
  return files;
}

/** Files that actually document the publish command. */
function filesMentioningShare(): { path: string; text: string }[] {
  return policyFiles()
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
    .filter(({ text }) => text.includes('lavish-axi share'));
}

function rel(p: string): string {
  return p.slice(REPO.length + 1).replace(/\\/g, '/');
}

describe('publish policy: reports are public, never password-gated', () => {
  test('some file actually documents the publish command (guard is not vacuous)', () => {
    // If this fails, every assertion below would pass trivially and prove nothing.
    expect(filesMentioningShare().length).toBeGreaterThan(0);
  });

  test('no `lavish-axi share` invocation passes --password', () => {
    // Matches the command form only: `lavish-axi share <file> --password`.
    // Prose like "with NO `--password`" is intentionally not a match.
    const invocationWithPassword = /lavish-axi share\s+\S+\s+--password/;
    const offenders = filesMentioningShare()
      .filter(({ text }) => invocationWithPassword.test(text))
      .map(({ path }) => rel(path));

    expect(offenders).toEqual([]);
  });

  test('no file declares a password mandate', () => {
    const mandate = /(--password[^\n]{0,40}\bis\s+mandatory\b)|(\bpassword\s+is\s+mandatory\b)|(\bMANDATORY\b[^\n]{0,40}--password)/i;
    const offenders = filesMentioningShare()
      .filter(({ text }) => mandate.test(text))
      .map(({ path }) => rel(path));

    expect(offenders).toEqual([]);
  });
});

describe('publish policy: a public page does not mean a public key', () => {
  // Dropping the password must NOT quietly drop update_key secrecy. The key is
  // update/delete-capable and shown once; publishing the page publicly changes nothing
  // about it. This is the regression the no-password change is most likely to cause.

  test('every file documenting the publish command still routes update_key to the gitignored secret file', () => {
    const offenders = filesMentioningShare()
      .filter(({ text }) => text.includes('update_key'))
      .filter(({ text }) => !text.includes('HANDOFF.secret.local'))
      .map(({ path }) => rel(path));

    expect(offenders).toEqual([]);
  });

  test('.gitignore excludes HANDOFF.secret.local at any depth', () => {
    const gitignore = readFileSync(join(REPO, '.gitignore'), 'utf8');
    // Goal working dirs live at .harness/goals/<slug>/, not the repo root, so a
    // root-anchored `/HANDOFF.secret.local` would silently fail to match.
    expect(gitignore).toContain('**/HANDOFF.secret.local');
  });

  test('no update_key value is committed anywhere in the scanned tree', () => {
    // lavish-axi update_keys are long opaque tokens. Catch a pasted one.
    const looksLikeKey = /update_key:\s*[A-Za-z0-9_\-]{20,}/;
    const offenders = policyFiles()
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .filter(({ text }) => looksLikeKey.test(text))
      .map(({ path }) => rel(path));

    expect(offenders).toEqual([]);
  });
});
