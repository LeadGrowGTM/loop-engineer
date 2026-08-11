#!/usr/bin/env bun

import {
  LifecycleCommandError,
  exitCodeFor,
  isLifecycleOperation,
  lifecycleFailure,
  type LifecycleContext,
  type LifecycleResult,
} from "./goal-lifecycle/contracts";

function unsupportedOperation(operation: string): LifecycleResult {
  return lifecycleFailure(
    operation,
    "NOT_IMPLEMENTED",
    `The ${operation} operation is not available yet.`,
    ["Use a lifecycle operation after its required safety checks are available."],
  );
}

/**
 * The sole caller-facing lifecycle seam. Later tasks replace the placeholders
 * with operation modules while preserving this one-result contract.
 */
export async function runGoalLifecycle(
  argv: string[],
  _context: LifecycleContext = {},
): Promise<LifecycleResult> {
  const operation = argv[0] ?? "";
  try {
    if (!isLifecycleOperation(operation)) {
      return lifecycleFailure(
        operation,
        "INVALID_ARGUMENT",
        operation.length === 0 ? "A lifecycle operation is required." : `Unknown lifecycle operation: ${operation}.`,
        ["Use one of: start, record-grill, validate, finish, or audit."],
      );
    }
    return unsupportedOperation(operation);
  } catch (error) {
    if (error instanceof LifecycleCommandError) {
      return lifecycleFailure(operation, error.code, error.message, error.remediation, error.data);
    }
    return lifecycleFailure(
      operation,
      "INTERNAL_ERROR",
      "The lifecycle command could not complete safely.",
      ["Review the command inputs and retry after resolving the reported environment issue."],
    );
  }
}

if (import.meta.main) {
  const result = await runGoalLifecycle(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitCodeFor(result);
}
