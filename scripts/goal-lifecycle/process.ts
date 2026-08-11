export interface RunProcessOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  outputLimitBytes?: number;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_OUTPUT_LIMIT_BYTES = 1_048_576;

interface OutputBudget {
  remaining: number;
  exceeded: boolean;
}

async function readBounded(
  stream: ReadableStream<Uint8Array>,
  budget: OutputBudget,
  stop: () => void,
): Promise<Uint8Array[]> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return chunks;
      const captured = value.byteLength <= budget.remaining ? value : value.slice(0, budget.remaining);
      if (captured.byteLength > 0) chunks.push(captured);
      budget.remaining -= captured.byteLength;
      if (value.byteLength > captured.byteLength) {
        budget.exceeded = true;
        stop();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function decode(chunks: Uint8Array[]): string {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/** Executes one command using Bun's argv API; it deliberately has no shell-string overload. */
export async function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions = {},
): Promise<ProcessResult> {
  if (command.length === 0) throw new Error("command is required");
  if (args.some((arg) => typeof arg !== "string")) throw new Error("args must be strings");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const outputLimitBytes = options.outputLimitBytes ?? DEFAULT_OUTPUT_LIMIT_BYTES;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive");
  if (!Number.isInteger(outputLimitBytes) || outputLimitBytes < 0) throw new Error("outputLimitBytes must be a non-negative integer");

  const child = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: options.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  let timedOut = false;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    child.kill();
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
  const budget: OutputBudget = { remaining: outputLimitBytes, exceeded: false };

  try {
    const [stdoutChunks, stderrChunks, exitCode] = await Promise.all([
      readBounded(child.stdout, budget, stop),
      readBounded(child.stderr, budget, stop),
      child.exited,
    ]);
    return {
      exitCode,
      stdout: decode(stdoutChunks),
      stderr: decode(stderrChunks),
      timedOut,
      outputLimitExceeded: budget.exceeded,
    };
  } finally {
    clearTimeout(timer);
  }
}
