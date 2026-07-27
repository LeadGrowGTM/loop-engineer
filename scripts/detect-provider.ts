// Provider detection layer: thin, side-effect-isolated probe
// All I/O (env reads, codex binary detection) is injected through the env parameter
// No bare Bun.which, no bare process.env calls outside of the injected parameter

export const PROVIDER_SIGNAL_ENV_KEY = "ANTHROPIC_PROVIDERS";
// Placeholder signal name — unconfirmed. claudex runs the harness on a GPT upstream via a
// codex subprocess (see docs/DEPENDENCIES.md §"Running under claudex"), but that section
// documents only the model-ID mapping table, not an env var. No env var for claudex session
// detection has been confirmed against the real proxy yet. Until confirmed, this key should
// be treated as a guess: verify it against the actual claudex proxy before relying on it in
// production, and update this comment once a real signal is confirmed.

export interface Detected {
  provider: "native" | "claudex" | "codex";
}

export interface DetectionEnv {
  [PROVIDER_SIGNAL_ENV_KEY]?: string;
  codexAvailable?: boolean;
  // Additional env vars can be injected here for testing
  [key: string]: any;
}

/**
 * Detect the active provider (native Claude, claudex proxy, or codex CLI).
 *
 * Detection precedence:
 * 1. If the (unconfirmed placeholder) ANTHROPIC_PROVIDERS env var is present, claudex takes
 *    precedence (means a live proxied session is in progress) — this signal has not been
 *    verified against the real claudex proxy; see PROVIDER_SIGNAL_ENV_KEY above
 * 2. Else if codex binary is available (injected via env.codexAvailable), return codex
 *    (no Anthropic access; running under real GPT-native CLI)
 * 3. Else return native (Claude Code default, no proxy)
 *
 * @param env - injected detection environment (for tests: pass fake values; for production: pass real env)
 * @returns {provider} - one of 'native', 'claudex', or 'codex'
 */
export function detectProvider(env: DetectionEnv): Detected {
  // Check for claudex session signal (takes precedence)
  if (env[PROVIDER_SIGNAL_ENV_KEY]) {
    return { provider: "claudex" };
  }

  // Check for codex binary availability
  if (env.codexAvailable) {
    return { provider: "codex" };
  }

  // Default: native Claude Code
  return { provider: "native" };
}

// Production helper: returns the real environment for the resolver
export function getRealDetectionEnv(): DetectionEnv {
  const env: DetectionEnv = {
    [PROVIDER_SIGNAL_ENV_KEY]: process.env[PROVIDER_SIGNAL_ENV_KEY],
  };

  // Check if codex binary is available
  if (Bun.which("codex") !== null) {
    env.codexAvailable = true;
  }

  return env;
}

// CLI wrapper (for manual testing): bun scripts/detect-provider.ts
if (import.meta.main) {
  const env = getRealDetectionEnv();
  const result = detectProvider(env);
  console.log(JSON.stringify(result, null, 2));
}
