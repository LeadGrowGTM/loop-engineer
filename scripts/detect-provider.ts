// Provider detection layer: thin, side-effect-isolated probe.
// The pure detectProvider() takes an injected env; only getRealDetectionEnv() reads process.env.
//
// Signals (confirmed, not guessed):
//   claudex  -> ANTHROPIC_BASE_URL is set. "claudex" runs the harness as ordinary Claude Code
//               but points it at a local CLIProxyAPI instance by overriding ANTHROPIC_BASE_URL,
//               so Claude Code believes it is talking to Anthropic while traffic is routed to a
//               GPT upstream (GPT-5.6 Sol) that presents under Anthropic model IDs. Native Claude
//               Code never sets this var. Ref: CLIProxyAPI (github.com/router-for-me/CLIProxyAPI)
//               + claudex setup guides — the whole mechanism IS the ANTHROPIC_BASE_URL override.
//   codex    -> CODEX_SANDBOX is set. The OpenAI Codex CLI sets CODEX_SANDBOX in the environment
//               of the shell commands it executes (to signal sandbox state to child processes),
//               so a script Codex runs — like this detector — sees it. This replaces the previous
//               Bun.which("codex") check, which was a bug: it fired whenever codex was merely
//               INSTALLED, misclassifying a native session on a machine that has codex installed.
//               CODEX_SANDBOX is an internal/runtime marker (not in Codex's list of documented
//               READ vars), so treat it as best-available: if Codex changes it, update here.
//   native   -> neither signal present.
//
// Caveat: ANTHROPIC_BASE_URL set to some non-CLIProxyAPI Anthropic gateway would still read as
// "claudex". That is acceptable for the harness's purpose (any proxied/GPT-backed session should
// take the flagship verification bump); tighten to a host check here if that ever matters.

export const CLAUDEX_SIGNAL_ENV_KEY = "ANTHROPIC_BASE_URL";
export const CODEX_SIGNAL_ENV_KEY = "CODEX_SANDBOX";

export interface Detected {
  provider: "native" | "claudex" | "codex";
}

export interface DetectionEnv {
  [CLAUDEX_SIGNAL_ENV_KEY]?: string;
  [CODEX_SIGNAL_ENV_KEY]?: string;
  // Additional env vars can be injected here for testing.
  [key: string]: any;
}

/**
 * Detect the active provider (native Claude, claudex proxy, or codex CLI) from an injected env.
 *
 * Detection precedence (the two signals are mutually exclusive in practice — claudex is Claude
 * Code, codex is the OpenAI Codex CLI — so order only matters as a documented tiebreak):
 * 1. ANTHROPIC_BASE_URL set  -> claudex (Claude Code routed through CLIProxyAPI to a GPT upstream).
 * 2. CODEX_SANDBOX set       -> codex   (running under the OpenAI Codex CLI, GPT-native).
 * 3. neither                 -> native  (Claude Code talking to Anthropic directly; the default).
 *
 * @param env - injected detection environment (tests pass fake values; production passes real env).
 * @returns {provider} - one of 'native', 'claudex', or 'codex'.
 */
export function detectProvider(env: DetectionEnv): Detected {
  if (env[CLAUDEX_SIGNAL_ENV_KEY]) {
    return { provider: "claudex" };
  }

  if (env[CODEX_SIGNAL_ENV_KEY]) {
    return { provider: "codex" };
  }

  return { provider: "native" };
}

// Production helper: the only place that touches process.env. Reads the two real signal vars —
// no binary probe, so an installed-but-inactive codex does not misfire.
export function getRealDetectionEnv(): DetectionEnv {
  return {
    [CLAUDEX_SIGNAL_ENV_KEY]: process.env[CLAUDEX_SIGNAL_ENV_KEY],
    [CODEX_SIGNAL_ENV_KEY]: process.env[CODEX_SIGNAL_ENV_KEY],
  };
}

// CLI wrapper (for manual testing): bun scripts/detect-provider.ts
if (import.meta.main) {
  const env = getRealDetectionEnv();
  const result = detectProvider(env);
  console.log(JSON.stringify(result, null, 2));
}
