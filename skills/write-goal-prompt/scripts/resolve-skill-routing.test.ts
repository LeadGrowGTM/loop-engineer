import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderRoutingGuard } from "./resolve-skill-routing";

const scriptPath = join(import.meta.dir, "resolve-skill-routing.ts");
const gitExecutable = Bun.which("git");
if (!gitExecutable) throw new Error("Git executable not found");
const gitBash = resolve(dirname(gitExecutable), "..", "bin", "bash.exe");
const BASH = existsSync(gitBash) ? gitBash : Bun.which("bash");
if (!BASH) throw new Error("Bash executable not found");
const validRouting = [
  "# Skill Routing",
  "",
  "| Task type | Primary skill | Notes |",
  "| --- | --- | --- |",
  "| New feature | `/tdd` | Test first |",
  "| Bug fix | `/diagnosing-bugs` | Find the cause |",
  "| Architecture | `/codebase-design` | Design first |",
  "| Content | `/writing-shape` | Shape copy |",
  "| No match | `direct` | State the quality bar |",
  "",
  "Use only confirmed skills.",
].join("\n");

type RoutingOutput = {
  status: "resolved" | "error";
  selectedSource: "project-local" | "canonical" | "direct" | null;
  normalizedPath: string | null;
  fallback: "none" | "project-local-absent" | "both-sources-absent" | "blocked";
  sha256: string | null;
  evidence: Array<{
    source: "project-local" | "canonical";
    normalizedPath: string;
    state: "absent" | "valid" | "malformed" | "unreadable";
    sha256: string | null;
  }>;
  errors: Array<{
    source: "project-local" | "canonical" | "input";
    code: string;
    message: string;
  }>;
};

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  output: RoutingOutput | null;
};

function normalizePath(path: string): string {
  const absolutePath = resolve(path);
  return process.platform === "win32"
    ? absolutePath.replaceAll("\\", "/")
    : absolutePath;
}

function makeFixture(name = "fixture"): {
  root: string;
  projectRoot: string;
  localPath: string;
  canonicalPath: string;
} {
  const root = mkdtempSync(join(tmpdir(), "skill-routing-resolver-"));
  const projectRoot = join(root, name, "project");
  const localPath = join(projectRoot, ".harness", "skill-routing.md");
  const canonicalPath = join(root, name, "canonical", "skill-routing.md");
  mkdirSync(projectRoot, { recursive: true });
  return { root, projectRoot, localPath, canonicalPath };
}

function writeRouting(path: string, content = validRouting): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function runResolver(projectRoot: string, canonicalPath?: string): CliResult {
  const command = [process.execPath, scriptPath, "--project-root", projectRoot];
  if (canonicalPath !== undefined) command.push("--canonical-path", canonicalPath);
  const result = Bun.spawnSync(
    command,
    { stdout: "pipe", stderr: "pipe" },
  );
  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString().trim();
  let output: RoutingOutput | null = null;
  if (stdout) {
    try {
      output = JSON.parse(stdout) as RoutingOutput;
    } catch {
      output = null;
    }
  }
  return { exitCode: result.exitCode, stdout, stderr, output };
}

describe("resolve-skill-routing CLI", () => {
  test("selects valid project-local routing without inspecting canonical routing", () => {
    const fixture = makeFixture();
    writeRouting(fixture.localPath);
    writeRouting(fixture.canonicalPath, "malformed canonical file");

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.output).toEqual({
      status: "resolved",
      selectedSource: "project-local",
      normalizedPath: normalizePath(fixture.localPath),
      fallback: "none",
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      evidence: [
        {
          source: "project-local",
          normalizedPath: normalizePath(fixture.localPath),
          state: "valid",
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
      errors: [],
    });
    expect(result.output?.evidence[0].sha256).toBe(result.output?.sha256);
  });

  test("uses canonical routing only when project-local routing is absent", () => {
    const fixture = makeFixture();
    writeRouting(fixture.canonicalPath);

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(0);
    expect(result.output).toEqual({
      status: "resolved",
      selectedSource: "canonical",
      normalizedPath: normalizePath(fixture.canonicalPath),
      fallback: "project-local-absent",
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      evidence: [
        {
          source: "project-local",
          normalizedPath: normalizePath(fixture.localPath),
          state: "absent",
          sha256: null,
        },
        {
          source: "canonical",
          normalizedPath: normalizePath(fixture.canonicalPath),
          state: "valid",
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
      errors: [],
    });
  });

  test("defaults canonical routing to the reference beside the resolver", () => {
    const fixture = makeFixture();
    const expectedCanonical = join(import.meta.dir, "..", "references", "skill-routing.md");

    const result = runResolver(fixture.projectRoot);

    expect(result.exitCode).toBe(0);
    expect(result.output?.selectedSource).toBe("canonical");
    expect(result.output?.normalizedPath).toBe(normalizePath(expectedCanonical));
    expect(result.output?.fallback).toBe("project-local-absent");
  });

  test("returns direct only when both routing files are absent", () => {
    const fixture = makeFixture();

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(0);
    expect(result.output).toEqual({
      status: "resolved",
      selectedSource: "direct",
      normalizedPath: null,
      fallback: "both-sources-absent",
      sha256: null,
      evidence: [
        {
          source: "project-local",
          normalizedPath: normalizePath(fixture.localPath),
          state: "absent",
          sha256: null,
        },
        {
          source: "canonical",
          normalizedPath: normalizePath(fixture.canonicalPath),
          state: "absent",
          sha256: null,
        },
      ],
      errors: [],
    });
  });

  test("fails closed when project-local routing is malformed", () => {
    const fixture = makeFixture();
    writeRouting(fixture.localPath, "too short");
    writeRouting(fixture.canonicalPath);

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(1);
    expect(result.output).toEqual({
      status: "error",
      selectedSource: null,
      normalizedPath: null,
      fallback: "blocked",
      sha256: null,
      evidence: [
        {
          source: "project-local",
          normalizedPath: normalizePath(fixture.localPath),
          state: "malformed",
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
      errors: [
        {
          source: "project-local",
          code: "ROUTING_MALFORMED",
          message: "project-local routing file must contain a Skill Routing heading and a Task type/Primary skill table with a separator and at least one route row",
        },
      ],
    });
  });

  test("rejects long unrelated routing content", () => {
    const fixture = makeFixture();
    writeRouting(fixture.localPath, Array(20).fill("garbage").join("\n"));

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(1);
    expect(result.output?.evidence[0]?.state).toBe("malformed");
  });

  test("rejects routing content made only of blank lines", () => {
    const fixture = makeFixture();
    writeRouting(fixture.localPath, "\n".repeat(20));

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(1);
    expect(result.output?.evidence[0]?.state).toBe("malformed");
  });

  test("rejects a malformed routing table", () => {
    const fixture = makeFixture();
    writeRouting(fixture.localPath, [
      "# Skill Routing",
      "| Task type | Primary skill |",
      "| not a separator | still not a separator |",
      "| Bug fix | `/diagnosing-bugs` |",
    ].join("\n"));

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(1);
    expect(result.output?.evidence[0]?.state).toBe("malformed");
  });

  test("fails closed when canonical routing is malformed", () => {
    const fixture = makeFixture();
    writeRouting(fixture.canonicalPath, "too short");

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(1);
    expect(result.output?.selectedSource).toBeNull();
    expect(result.output?.fallback).toBe("blocked");
    expect(result.output?.evidence.map(({ source, state }) => ({ source, state }))).toEqual([
      { source: "project-local", state: "absent" },
      { source: "canonical", state: "malformed" },
    ]);
    expect(result.output?.errors).toEqual([
      {
        source: "canonical",
        code: "ROUTING_MALFORMED",
        message: "canonical routing file must contain a Skill Routing heading and a Task type/Primary skill table with a separator and at least one route row",
      },
    ]);
  });

  test("fails closed when project-local routing is unreadable", () => {
    const fixture = makeFixture();
    mkdirSync(fixture.localPath, { recursive: true });
    writeRouting(fixture.canonicalPath);

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(1);
    expect(result.output?.evidence).toEqual([
      {
        source: "project-local",
        normalizedPath: normalizePath(fixture.localPath),
        state: "unreadable",
        sha256: null,
      },
    ]);
    expect(result.output?.errors).toEqual([
      {
        source: "project-local",
        code: "ROUTING_UNREADABLE",
        message: "project-local routing file is present but unreadable",
      },
    ]);
  });

  test("fails closed when canonical routing is unreadable", () => {
    const fixture = makeFixture();
    mkdirSync(fixture.canonicalPath, { recursive: true });

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(1);
    expect(result.output?.evidence.map(({ source, state }) => ({ source, state }))).toEqual([
      { source: "project-local", state: "absent" },
      { source: "canonical", state: "unreadable" },
    ]);
    expect(result.output?.errors).toEqual([
      {
        source: "canonical",
        code: "ROUTING_UNREADABLE",
        message: "canonical routing file is present but unreadable",
      },
    ]);
  });

  test("treats spaces and shell metacharacters as literal path characters", () => {
    const fixture = makeFixture("space & $(not-a-command); [literal] 'quote'");
    writeRouting(fixture.localPath);

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.output?.selectedSource).toBe("project-local");
    expect(result.output?.normalizedPath).toBe(normalizePath(fixture.localPath));
  });

  test("emits a path that still identifies the inspected file on this platform", () => {
    const fixtureName = process.platform === "win32" ? "platform path" : "repo\\name";
    const fixture = makeFixture(fixtureName);
    writeRouting(fixture.localPath);

    const result = runResolver(fixture.projectRoot, fixture.canonicalPath);
    const emittedPath = result.output?.normalizedPath;

    expect(result.exitCode).toBe(0);
    expect(emittedPath).toBe(normalizePath(fixture.localPath));
    expect(readFileSync(emittedPath!, "utf8")).toBe(validRouting);
  });

  test("emits an executable guard through the CLI", () => {
    const fixture = makeFixture("guard $(printf injected) `printf injected` 'quote'");
    writeRouting(fixture.localPath);

    const generated = Bun.spawnSync(
      [
        process.execPath,
        scriptPath,
        "--emit-shell-guard",
        "--project-root",
        fixture.projectRoot,
        "--canonical-path",
        fixture.canonicalPath,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const runtime = Bun.spawnSync(
      [BASH, "-c", generated.stdout.toString()],
      { stdout: "pipe", stderr: "pipe" },
    );

    expect(generated.exitCode).toBe(0);
    expect(generated.stderr.toString().trim()).toBe("");
    expect(runtime.exitCode).toBe(0);
    expect(JSON.parse(runtime.stdout.toString())).toMatchObject({
      status: "resolved",
      selectedSource: "project-local",
      normalizedPath: normalizePath(fixture.localPath),
    });
  });

  test("runs the generated guard with shell metacharacters passed literally", () => {
    const dangerousName = process.platform === "win32"
      ? "space $(printf injected) `printf injected` 'single quote'"
      : "space $(printf injected) `printf injected` 'single quote' \"double quote\"";
    const fixture = makeFixture(dangerousName);
    writeRouting(fixture.localPath);

    const wrapperPath = join(fixture.root, dangerousName, "resolver wrapper.ts");
    mkdirSync(dirname(wrapperPath), { recursive: true });
    writeFileSync(
      wrapperPath,
      `import { runCli } from ${JSON.stringify(pathToFileURL(scriptPath).href)};\nprocess.exitCode = runCli();\n`,
      "utf8",
    );

    const guard = renderRoutingGuard(
      fixture.projectRoot,
      wrapperPath,
      fixture.canonicalPath,
    );
    const result = Bun.spawnSync(
      [BASH, "-c", guard],
      { stdout: "pipe", stderr: "pipe" },
    );
    const stdout = result.stdout.toString().trim();

    expect(result.exitCode).toBe(0);
    expect(result.stderr.toString().trim()).toBe("");
    expect(JSON.parse(stdout)).toMatchObject({
      status: "resolved",
      selectedSource: "project-local",
      normalizedPath: normalizePath(fixture.localPath),
    });
  });

  test("emits byte-for-byte repeatable JSON for unchanged inputs", () => {
    const fixture = makeFixture();
    writeRouting(fixture.canonicalPath);

    const first = runResolver(fixture.projectRoot, fixture.canonicalPath);
    const second = runResolver(fixture.projectRoot, fixture.canonicalPath);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    expect(second.stderr).toBe(first.stderr);
  });
});
