#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  isValidSkillRouting,
  SKILL_ROUTING_REQUIRED_STRUCTURE,
} from "../../../scripts/setup-harness";

export type RoutingSource = "project-local" | "canonical" | "direct";
export type RoutingFileSource = Exclude<RoutingSource, "direct">;
export type RoutingState = "absent" | "valid" | "malformed" | "unreadable";

export type RoutingEvidence = {
  source: RoutingFileSource;
  normalizedPath: string;
  state: RoutingState;
  sha256: string | null;
};

export type RoutingError = {
  source: RoutingFileSource | "input";
  code: string;
  message: string;
};

export type RoutingResolution = {
  status: "resolved" | "error";
  selectedSource: RoutingSource | null;
  normalizedPath: string | null;
  fallback: "none" | "project-local-absent" | "both-sources-absent" | "blocked";
  sha256: string | null;
  evidence: RoutingEvidence[];
  errors: RoutingError[];
};

export const DEFAULT_CANONICAL_PATH = resolve(
  import.meta.dir,
  "..",
  "references",
  "skill-routing.md",
);
export const ROUTING_RESOLVER_PATH = resolve(
  import.meta.dir,
  "resolve-skill-routing.ts",
);

function normalizePath(path: string): string {
  const absolutePath = resolve(path);
  return process.platform === "win32"
    ? absolutePath.replaceAll("\\", "/")
    : absolutePath;
}

export function quotePosixShellArgument(value: string): string {
  if (value.includes("\0")) throw new Error("shell arguments cannot contain NUL bytes");
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

export function renderRoutingGuard(
  projectRoot: string,
  resolverPath = ROUTING_RESOLVER_PATH,
  canonicalPath = DEFAULT_CANONICAL_PATH,
): string {
  const resolverCommand = [
    "bun",
    quotePosixShellArgument(resolve(resolverPath)),
    "--project-root",
    quotePosixShellArgument(resolve(projectRoot)),
    "--canonical-path",
    quotePosixShellArgument(resolve(canonicalPath)),
  ].join(" ");

  return [
    "ROUTING_EXIT=0",
    `ROUTING_EVIDENCE=$(${resolverCommand}) || ROUTING_EXIT=$?`,
    `printf '%s\\n' "$ROUTING_EVIDENCE"`,
    `if [ "$ROUTING_EXIT" -ne 0 ]; then`,
    `  exit "$ROUTING_EXIT"`,
    "fi",
  ].join("\n");
}

function isAbsentError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = String(error.code);
  return code === "ENOENT" || code === "ENOTDIR";
}

function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function inspectRouting(source: RoutingFileSource, path: string): RoutingEvidence {
  const absolutePath = resolve(path);
  const normalizedPath = normalizePath(absolutePath);

  try {
    lstatSync(absolutePath);
  } catch (error) {
    return {
      source,
      normalizedPath,
      state: isAbsentError(error) ? "absent" : "unreadable",
      sha256: null,
    };
  }

  let content: string;
  try {
    content = readFileSync(absolutePath, "utf8");
  } catch {
    return { source, normalizedPath, state: "unreadable", sha256: null };
  }

  const sha256 = hashContent(content);
  return {
    source,
    normalizedPath,
    state: isValidSkillRouting(content) ? "valid" : "malformed",
    sha256,
  };
}

function blocked(
  problem: RoutingEvidence,
  evidence: RoutingEvidence[] = [problem],
): RoutingResolution {
  const label = problem.source;
  const unreadable = problem.state === "unreadable";
  return {
    status: "error",
    selectedSource: null,
    normalizedPath: null,
    fallback: "blocked",
    sha256: null,
    evidence,
    errors: [
      {
        source: problem.source,
        code: unreadable ? "ROUTING_UNREADABLE" : "ROUTING_MALFORMED",
        message: unreadable
          ? `${label} routing file is present but unreadable`
          : `${label} routing file must contain ${SKILL_ROUTING_REQUIRED_STRUCTURE}`,
      },
    ],
  };
}

export function resolveSkillRouting(
  projectRoot: string,
  canonicalPath = DEFAULT_CANONICAL_PATH,
): RoutingResolution {
  const localPath = join(resolve(projectRoot), ".harness", "skill-routing.md");
  const local = inspectRouting("project-local", localPath);

  if (local.state === "valid") {
    return {
      status: "resolved",
      selectedSource: "project-local",
      normalizedPath: local.normalizedPath,
      fallback: "none",
      sha256: local.sha256,
      evidence: [local],
      errors: [],
    };
  }
  if (local.state !== "absent") return blocked(local);

  const canonical = inspectRouting("canonical", canonicalPath);
  if (canonical.state === "valid") {
    return {
      status: "resolved",
      selectedSource: "canonical",
      normalizedPath: canonical.normalizedPath,
      fallback: "project-local-absent",
      sha256: canonical.sha256,
      evidence: [local, canonical],
      errors: [],
    };
  }
  if (canonical.state !== "absent") {
    return blocked(canonical, [local, canonical]);
  }

  return {
    status: "resolved",
    selectedSource: "direct",
    normalizedPath: null,
    fallback: "both-sources-absent",
    sha256: null,
    evidence: [local, canonical],
    errors: [],
  };
}

function inputError(message: string): RoutingResolution {
  return {
    status: "error",
    selectedSource: null,
    normalizedPath: null,
    fallback: "blocked",
    sha256: null,
    evidence: [],
    errors: [{ source: "input", code: "INVALID_ARGUMENTS", message }],
  };
}

function parseArguments(argv: string[]):
  | { projectRoot: string; canonicalPath: string; emitShellGuard: boolean }
  | RoutingResolution {
  let projectRoot: string | null = null;
  let canonicalPath = DEFAULT_CANONICAL_PATH;
  let canonicalPathSet = false;
  let emitShellGuard = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--emit-shell-guard") {
      if (emitShellGuard) {
        return inputError("--emit-shell-guard may be provided only once");
      }
      emitShellGuard = true;
      continue;
    }
    if (argument !== "--project-root" && argument !== "--canonical-path") {
      return inputError(`unknown argument: ${argument}`);
    }

    const value = argv[index + 1];
    if (value === undefined) return inputError(`missing value for ${argument}`);
    index += 1;

    if (argument === "--project-root") {
      if (projectRoot !== null) return inputError("--project-root may be provided only once");
      projectRoot = value;
    } else {
      if (canonicalPathSet) return inputError("--canonical-path may be provided only once");
      canonicalPath = value;
      canonicalPathSet = true;
    }
  }

  if (projectRoot === null || projectRoot.length === 0) {
    return inputError("--project-root is required");
  }
  return { projectRoot, canonicalPath, emitShellGuard };
}

export function runCli(argv = process.argv.slice(2)): number {
  const parsed = parseArguments(argv);
  if ("status" in parsed) {
    console.log(JSON.stringify(parsed, null, 2));
    return 1;
  }
  if (parsed.emitShellGuard) {
    console.log(renderRoutingGuard(parsed.projectRoot, ROUTING_RESOLVER_PATH, parsed.canonicalPath));
    return 0;
  }

  const output = resolveSkillRouting(parsed.projectRoot, parsed.canonicalPath);
  console.log(JSON.stringify(output, null, 2));
  return output.status === "resolved" ? 0 : 1;
}

if (import.meta.main) {
  process.exitCode = runCli();
}
