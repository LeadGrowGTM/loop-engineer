export const LIFECYCLE_SCHEMA_VERSION = 1 as const;

export const LIFECYCLE_OPERATIONS = [
  "start",
  "record-grill",
  "validate",
  "finish",
  "audit",
] as const;

export type LifecycleOperation = (typeof LIFECYCLE_OPERATIONS)[number];

export interface LifecycleResult {
  schemaVersion: typeof LIFECYCLE_SCHEMA_VERSION;
  operation: string;
  ok: boolean;
  code: string;
  message: string;
  remediation: string[];
  data: Record<string, unknown>;
}

/** Dependencies that later lifecycle operations may inject at the command seam. */
export interface LifecycleContext {
  readonly cwd?: string;
}

export class LifecycleCommandError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly remediation: string[] = [],
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "LifecycleCommandError";
  }
}

export function lifecycleFailure(
  operation: string,
  code: string,
  message: string,
  remediation: string[] = [],
  data: Record<string, unknown> = {},
): LifecycleResult {
  return {
    schemaVersion: LIFECYCLE_SCHEMA_VERSION,
    operation,
    ok: false,
    code,
    message,
    remediation,
    data,
  };
}

export function lifecycleSuccess(
  operation: LifecycleOperation,
  message: string,
  data: Record<string, unknown> = {},
): LifecycleResult {
  return {
    schemaVersion: LIFECYCLE_SCHEMA_VERSION,
    operation,
    ok: true,
    code: "OK",
    message,
    remediation: [],
    data,
  };
}

export function isLifecycleOperation(value: string): value is LifecycleOperation {
  return (LIFECYCLE_OPERATIONS as readonly string[]).includes(value);
}

export function exitCodeFor(result: LifecycleResult): number {
  if (result.ok) return 0;
  return result.code === "INVALID_ARGUMENT" ? 2 : 1;
}
