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
import { recordGrill } from './goal-lifecycle/grill';
import { validateLifecycle } from './goal-lifecycle/validate';
import { finishLifecycle, type FinishLifecycleInput } from './goal-lifecycle/finish';
import { auditLifecycle } from './goal-lifecycle/audit';

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

function parseRecordGrillArguments(argv: string[]): { runPath: string; candidateReceiptPath: string } {
  const values = new Map<string, string>();
  const allowed = new Set(['--run', '--receipt']);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || value === undefined || value.length === 0 || values.has(flag)) {
      throw new LifecycleCommandError(
        'INVALID_ARGUMENT',
        'record-grill requires exactly one --run and --receipt value.',
        ['Use: goal-lifecycle record-grill --run <RUN.json> --receipt <candidate-GRILL.json>.'],
      );
    }
    values.set(flag, value);
  }
  if (values.size !== allowed.size) {
    throw new LifecycleCommandError(
      'INVALID_ARGUMENT',
      'record-grill requires --run and --receipt.',
      ['Use: goal-lifecycle record-grill --run <RUN.json> --receipt <candidate-GRILL.json>.'],
    );
  }
  return { runPath: values.get('--run')!, candidateReceiptPath: values.get('--receipt')! };
}

function parseValidateArguments(argv: string[]): { runPath: string } {
  if (argv.length !== 2 || argv[0] !== '--run' || argv[1].length === 0) {
    throw new LifecycleCommandError(
      'INVALID_ARGUMENT',
      'validate requires exactly one --run value.',
      ['Use: goal-lifecycle validate --run <absolute-RUN.json>.'],
    );
  }
  return { runPath: argv[1] };
}

function parseFinishArguments(argv: string[]): FinishLifecycleInput {
  const values = new Map<string, string>();
  const allowed = new Set(['--run', '--outcome', '--pr']);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || !value || values.has(flag)) {
      throw new LifecycleCommandError('INVALID_ARGUMENT', 'finish requires one --run and optional --outcome and --pr values.', ['Use: goal-lifecycle finish --run <absolute-RUN.json> [--outcome success|blocked|failed] [--pr <url>].']);
    }
    values.set(flag, value);
  }
  const outcome = values.get('--outcome') ?? 'success';
  if (!values.get('--run') || (outcome !== 'success' && outcome !== 'blocked' && outcome !== 'failed')) {
    throw new LifecycleCommandError('INVALID_ARGUMENT', 'finish requires --run and a supported outcome.', ['Use: goal-lifecycle finish --run <absolute-RUN.json> [--outcome success|blocked|failed] [--pr <url>].']);
  }
  return { runPath: values.get('--run')!, outcome, ...(values.get('--pr') ? { pr: values.get('--pr') } : {}) };
}

function parseAuditArguments(argv: string[]): { repo: string } {
  if (argv.length !== 2 || argv[0] !== '--repo' || argv[1].length === 0) {
    throw new LifecycleCommandError('INVALID_ARGUMENT', 'audit requires exactly one --repo value.', ['Use: goal-lifecycle audit --repo <path>.']);
  }
  return { repo: argv[1] };
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
 * The sole caller-facing lifecycle seam. Each of the five operations delegates
 * to its own module while preserving this one-result contract.
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
    if (operation === 'record-grill') {
      const input = parseRecordGrillArguments(argv.slice(1));
      return recordGrill(input.runPath, input.candidateReceiptPath);
    }
    if (operation === 'validate') {
      return await validateLifecycle(parseValidateArguments(argv.slice(1)), _context);
    }
    if (operation === 'finish') {
      return await finishLifecycle(parseFinishArguments(argv.slice(1)), _context);
    }
    if (operation === 'audit') {
      return await auditLifecycle(parseAuditArguments(argv.slice(1)), _context);
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
