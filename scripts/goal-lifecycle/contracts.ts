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

const SUPPORTED_REMEDIATION: Record<string, string[]> = {
  INVALID_ARGUMENT: ['Correct the lifecycle command arguments and retry through goal-lifecycle.'],
  NOT_IMPLEMENTED: ['Use a lifecycle operation only after its required safety checks are available.'],
  DEPENDENCY_SETUP_REQUIRED: ['Run the supported setup/onboarding flow, verify dependencies, then retry lifecycle start.'],
  DEPENDENCY_SETUP_FAILED: ['Repair lifecycle dependencies through the supported setup/onboarding flow, then retry.'],
  TASK_REGISTRATION_FAILED: ['Repair the project-local tasks-axi backlog through supported setup, then retry lifecycle start.'],
  TASK_STATE_CONFLICT: ['Resolve the conflicting durable task identity or state, then retry lifecycle start.'],
  TREEHOUSE_CONFIG_UNSAFE: ['Run supported setup to repair the repository-local Treehouse pool, then retry lifecycle start.'],
  TREEHOUSE_LEASE_FAILED: ['Inspect bounded readiness and Treehouse status, resolve the lease error, then retry lifecycle start.'],
  LEASE_OUTSIDE_REPOSITORY: ['Repair the repository-local Treehouse pool through supported setup, then retry lifecycle start.'],
  LEASE_IDENTITY_MISMATCH: ['Leave the lease in place, resolve its Treehouse and Git identity mismatch, then retry lifecycle start.'],
  BRANCH_IDENTITY_MISMATCH: ['Leave the lease in place, resolve the canonical task branch mismatch, then retry lifecycle start.'],
  GRILL_RECEIPT_MISSING: ['Resume batch-grill-me and record its completed receipt through goal-lifecycle.'],
  GRILL_RECEIPT_INVALID: ['Resume batch-grill-me and record the completed zero frontier.'],
  CONTEXT_RESTART_INVALID: ['Restart from the persisted RUN.json in its recorded worktree and retry goal-lifecycle validate.'],
  FINISH_PRECONDITION_FAILED: ['Resolve the recorded lifecycle safety condition, then retry goal-lifecycle finish.'],
  HANDOFF_MISSING: ['Create the required HANDOFF.md in the persisted run directory, commit the task work, then retry goal-lifecycle finish.'],
  TREEHOUSE_RETURN_FAILED: ['Leave the lease in place, resolve the Treehouse return failure, then retry goal-lifecycle finish.'],
  TASK_COMPLETION_PENDING: ['Reconcile the durable task completion through goal-lifecycle finish without returning another lease.'],
  AUDIT_FAILED: ['Resolve the repository inspection error, then retry goal-lifecycle audit.'],
  REPOSITORY_NOT_READY: ['Resolve the reported repository readiness errors, then retry lifecycle start.'],
  INTERNAL_ERROR: ['Review lifecycle diagnostics and retry only after the reported safety condition is resolved.'],
};

export function supportedRemediationFor(code: string): string[] {
  return SUPPORTED_REMEDIATION[code] ?? [
    'Resolve the reported condition through the supported goal-lifecycle or setup flow, then retry.',
  ];
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
    remediation: remediation.length > 0 ? remediation : supportedRemediationFor(code),
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
