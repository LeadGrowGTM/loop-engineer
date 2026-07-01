#!/usr/bin/env bun
// Goal-prompt length gate — the enforced version of SKILL.md's HARD LENGTH GATE.
// Replicates /goal's own counting exactly: strips ONE trailing newline, then counts
// UTF-16 code units — i.e. JS String.length, which is what /goal (a JS/Electron app)
// checks against 4000. Exits non-zero if the candidate would be rejected or is over the
// safe target, so it can gate a commit/emit step instead of relying on the agent to eyeball.
//
// Why not the documented `python -c "len(open(f).read()...)"`? On Windows that opens in the
// locale codepage (cp1252), not UTF-8, so every non-ASCII char (e.g. an em-dash, 3 UTF-8
// bytes) is mis-decoded into ~3 chars and the count is inflated — it can falsely BLOCK a
// prompt that /goal would accept. This script decodes UTF-8 and counts UTF-16 units, so it
// matches the real limit. (If you must use the python one-liner, add encoding="utf-8".)
//
// Usage:
//   bun check-goal-length.ts [path] [--cap N] [--target N]
//   path     defaults to temp/_goal-candidate.txt (relative to cwd)
//   --cap    hard limit /goal rejects at (default 4000)
//   --target safe ceiling with margin (default 3990)
//
// Exit codes: 0 = pass (< target) · 1 = blocked (>= target or >= cap) · 2 = file unreadable.

const argv = process.argv.slice(2);
const flag = (name: string, def: number): number => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def;
};
const path = argv.find((a) => !a.startsWith("--")) ?? "temp/_goal-candidate.txt";
const CAP = flag("--cap", 4000);
const TARGET = flag("--target", 3990);

let raw: string;
try {
  raw = await Bun.file(path).text();
} catch {
  console.error(`FAIL: cannot read ${path}`);
  process.exit(2);
}

// /goal strips exactly one trailing newline before counting; .length is UTF-16 units.
const txt = raw.replace(/\n$/, "");
const len = txt.length;

if (len >= CAP) {
  console.error(
    `BLOCKED: ${len} chars >= hard cap ${CAP}. /goal will reject this. Compress and re-run.`,
  );
  process.exit(1);
}
if (len >= TARGET) {
  console.error(
    `BLOCKED: ${len} chars >= safe target ${TARGET} (need margin under the ${CAP} cap). Compress and re-run.`,
  );
  process.exit(1);
}
console.log(`OK: ${len} chars — under ${TARGET} target and ${CAP} cap. [Measured: ${len} chars]`);
process.exit(0);
