#!/usr/bin/env bun

import {
  LifecycleCommandError,
  exitCodeFor,
  isLifecycleOperation,
  lifecycleFailure,
  type LifecycleContext,
  type LifecycleResult,
} from "./goal-lifecycle/contracts";

import { startLifecycle, type StartLifecycleInput } from './goal-lifecycle/start';

function parseStartArguments(argv: string[]): StartLifecycleInput {
  const values = new Map<string, string>();
  const allowed = new Set(['--repo', '--task-id', '--title']);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || value === undefined || value.length === 0 || values.has(flag)) {
      throw new LifecycleCommandError(
        'INVALID_ARGUMENT',
        'start requires exactly one --repo, --task-id, and --title value.',
        ['Use: goal-lifecycle start --repo <path> --task-id <slug> --title <text>.'],
      );
    }
    values.set(flag, value);
  }
  if (values.size !== allowed.size) {
    throw new LifecycleCommandError(
      'INVALID_ARGUMENT',
      'start requires --repo, --task-id, and --title.',
      ['Use: goal-lifecycle start --repo <path> --task-id <slug> --title <text>.'],
    );
  }
  const taskId = values.get('--task-id')!;
  const title = values.get('--title')!;
  if (
    taskId.length > 64 ||
    taskId.includes('..') ||
    !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(taskId)
  ) {
    throw new LifecycleCommandError('INVALID_ARGUMENT', 'task-id must be a canonical lowercase slug of at most 64 characters.');
  }
  if (title.trim() !== title || /[\r\n]/.test(title)) {
    throw new LifecycleCommandError('INVALID_ARGUMENT', 'title must be one non-empty trimmed line.');
  }
  return { repo: values.get('--repo')!, taskId, title };
}

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
    if (operation === 'start') {
      return startLifecycle(parseStartArguments(argv.slice(1)), _context);
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
