import { test, expect } from "bun:test";
import {
  detectProvider,
  getRealDetectionEnv,
  CLAUDEX_SIGNAL_ENV_KEY,
  CODEX_SIGNAL_ENV_KEY,
  type DetectionEnv,
} from "./detect-provider";

test("returns 'native' when neither signal is present", () => {
  expect(detectProvider({}).provider).toBe("native");
});

test("returns 'claudex' when ANTHROPIC_BASE_URL is set (Claude Code routed through CLIProxyAPI)", () => {
  const env: DetectionEnv = {
    [CLAUDEX_SIGNAL_ENV_KEY]: "http://127.0.0.1:8317",
  };
  expect(detectProvider(env).provider).toBe("claudex");
});

test("returns 'codex' when CODEX_SANDBOX is set and no claudex signal", () => {
  const env: DetectionEnv = {
    [CODEX_SIGNAL_ENV_KEY]: "seatbelt",
  };
  expect(detectProvider(env).provider).toBe("codex");
});

test("claudex (ANTHROPIC_BASE_URL) takes precedence over codex (CODEX_SANDBOX)", () => {
  const env: DetectionEnv = {
    [CLAUDEX_SIGNAL_ENV_KEY]: "http://127.0.0.1:8317",
    [CODEX_SIGNAL_ENV_KEY]: "seatbelt",
  };
  expect(detectProvider(env).provider).toBe("claudex");
});

test("returns exactly { provider: 'native' } as the documented default", () => {
  expect(detectProvider({})).toEqual({ provider: "native" });
});

// Regression for the install-presence bug: a native session on a machine that merely has the
// codex CLI installed must resolve to 'native'. Detection keys on the CODEX_SANDBOX runtime
// signal (set only while Codex is executing a command), never on codex being on PATH.
test("native session on a machine with codex installed -> native (no CODEX_SANDBOX)", () => {
  const env: DetectionEnv = {}; // codex installed but not the active runtime => no signal
  expect(detectProvider(env).provider).toBe("native");
});

test("empty-string signals are falsy and fall through to native", () => {
  const env: DetectionEnv = {
    [CLAUDEX_SIGNAL_ENV_KEY]: "",
    [CODEX_SIGNAL_ENV_KEY]: "",
  };
  expect(detectProvider(env).provider).toBe("native");
});

test("signal keys are exported as non-empty documented constants", () => {
  expect(CLAUDEX_SIGNAL_ENV_KEY).toBe("ANTHROPIC_BASE_URL");
  expect(CODEX_SIGNAL_ENV_KEY).toBe("CODEX_SANDBOX");
});

test("getRealDetectionEnv reads only the two real signal vars (no binary probe)", () => {
  const saved = {
    base: process.env[CLAUDEX_SIGNAL_ENV_KEY],
    sandbox: process.env[CODEX_SIGNAL_ENV_KEY],
  };
  try {
    delete process.env[CLAUDEX_SIGNAL_ENV_KEY];
    delete process.env[CODEX_SIGNAL_ENV_KEY];
    // Neither signal set -> native, regardless of whether a codex binary exists on this machine.
    expect(detectProvider(getRealDetectionEnv()).provider).toBe("native");

    process.env[CODEX_SIGNAL_ENV_KEY] = "seatbelt";
    expect(detectProvider(getRealDetectionEnv()).provider).toBe("codex");

    process.env[CLAUDEX_SIGNAL_ENV_KEY] = "http://127.0.0.1:8317";
    expect(detectProvider(getRealDetectionEnv()).provider).toBe("claudex");
  } finally {
    if (saved.base === undefined) delete process.env[CLAUDEX_SIGNAL_ENV_KEY];
    else process.env[CLAUDEX_SIGNAL_ENV_KEY] = saved.base;
    if (saved.sandbox === undefined) delete process.env[CODEX_SIGNAL_ENV_KEY];
    else process.env[CODEX_SIGNAL_ENV_KEY] = saved.sandbox;
  }
});
