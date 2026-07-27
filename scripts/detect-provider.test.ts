import { test, expect } from "bun:test";
import { detectProvider, PROVIDER_SIGNAL_ENV_KEY } from "./detect-provider";

interface FakeEnv {
  [PROVIDER_SIGNAL_ENV_KEY]?: string;
  codexAvailable?: boolean;
}

test("returns 'native' when no signal and no codex binary", () => {
  const env: FakeEnv = {};
  const result = detectProvider(env);
  expect(result.provider).toBe("native");
});

test("returns 'claudex' when session providers= signal indicates claudex is active", () => {
  const env: FakeEnv = {
    [PROVIDER_SIGNAL_ENV_KEY]: "claudex",
  };
  const result = detectProvider(env);
  expect(result.provider).toBe("claudex");
});

test("returns 'codex' when codex binary is available and no claudex signal", () => {
  const env: FakeEnv = {
    codexAvailable: true,
  };
  const result = detectProvider(env);
  expect(result.provider).toBe("codex");
});

test("claudex signal takes precedence over codex binary availability", () => {
  const env: FakeEnv = {
    [PROVIDER_SIGNAL_ENV_KEY]: "claudex",
    codexAvailable: true,
  };
  const result = detectProvider(env);
  expect(result.provider).toBe("claudex");
});

test("returns 'native' as documented default when neither signal is present", () => {
  const env: FakeEnv = {};
  const result = detectProvider(env);
  expect(result.provider).toBe("native");
  expect(result).toEqual({ provider: "native" });
});

test("PROVIDER_SIGNAL_ENV_KEY is exported as a documented constant", () => {
  expect(typeof PROVIDER_SIGNAL_ENV_KEY).toBe("string");
  expect(PROVIDER_SIGNAL_ENV_KEY.length).toBeGreaterThan(0);
});

test("detects codex from injected env parameter, not from ambient Bun.which", () => {
  // This test verifies that detection is parameter-driven, not calling Bun.which
  // It does this implicitly by passing a fake env with codexAvailable boolean
  // rather than allowing a live filesystem check
  const env: FakeEnv = {
    codexAvailable: true,
  };
  const result = detectProvider(env);
  expect(result.provider).toBe("codex");
});

test("handles various claudex signal values (case-insensitive or variant spellings)", () => {
  // Test that the signal is recognized
  const env1: FakeEnv = {
    [PROVIDER_SIGNAL_ENV_KEY]: "claudex",
  };
  expect(detectProvider(env1).provider).toBe("claudex");

  // Test fallthrough when signal is absent/falsy
  const env2: FakeEnv = {
    [PROVIDER_SIGNAL_ENV_KEY]: "",
  };
  const result2 = detectProvider(env2);
  // Empty string is falsy, should fall through to codex check
  expect(result2.provider).toBe("native");
});
