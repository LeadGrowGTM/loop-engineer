import { existsSync, readFileSync } from 'node:fs';
import {
  LifecycleCommandError,
  lifecycleFailure,
  lifecycleSuccess,
  type LifecycleResult,
} from './contracts';
import {
  ManifestError,
  readRunManifest,
  writeGrillReceipt,
  writeRunManifest,
  type GrillReceiptV1,
  type GrillRoundV1,
} from './manifest';
import { PINNED_BATCH_GRILL_SHA256 } from './start';

const OPERATION = 'record-grill';
const SECRET_KEY = /(?:password|secret|token|api[_-]?key|update[_-]?key|authorization)/i;
const SECRET_CONTENT = /(?:password|secret|token|api[_-]?key|update[_-]?key|authorization)\s*(?::\s*(?:bearer\s+)?|=)\S+/i;
const REDACTED = '[REDACTED]';

function invalid(message: string): LifecycleCommandError {
  return new LifecycleCommandError(
    'GRILL_RECEIPT_INVALID',
    message,
    ['Resume batch-grill-me and record the completed zero frontier.'],
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireOnlyKeys(record: Record<string, unknown>, keys: readonly string[], path: string): void {
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) {
      throw invalid(SECRET_KEY.test(key)
        ? `The grill receipt contains an unredacted secret-like key at ${path}.${key}.`
        : `The grill receipt contains an unsupported field at ${path}.${key}.`);
    }
  }
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalid(`The grill receipt field ${path} must be a non-empty string.`);
  }
  return value;
}

function requireStrings(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) throw invalid(`The grill receipt field ${path} must be an array of strings.`);
  return value.map((entry, index) => requireString(entry, `${path}[${index}]`));
}

function parseRound(value: unknown, index: number): GrillRoundV1 {
  const path = `rounds[${index}]`;
  if (!isObject(value)) throw invalid(`The grill receipt field ${path} must be an object.`);
  requireOnlyKeys(value, ['questions', 'recommendations', 'settledDecisions'], path);
  return {
    questions: requireStrings(value.questions, `${path}.questions`),
    recommendations: requireStrings(value.recommendations, `${path}.recommendations`),
    settledDecisions: requireStrings(value.settledDecisions, `${path}.settledDecisions`),
  };
}

function redactString(value: string, path: string, fields: string[]): string {
  if (!SECRET_CONTENT.test(value)) return value;
  fields.push(path);
  return REDACTED;
}

function redactReceipt(receipt: GrillReceiptV1): GrillReceiptV1 {
  const fields: string[] = [];
  const redactStrings = (values: string[], path: string) => values.map((value, index) => redactString(value, `${path}[${index}]`, fields));
  const rounds = receipt.rounds.map((round, index) => ({
    questions: redactStrings(round.questions, `rounds[${index}].questions`),
    recommendations: redactStrings(round.recommendations, `rounds[${index}].recommendations`),
    settledDecisions: redactStrings(round.settledDecisions, `rounds[${index}].settledDecisions`),
  }));
  return {
    ...receipt,
    rounds,
    recommendations: redactStrings(receipt.recommendations, 'recommendations'),
    settledDecisions: redactStrings(receipt.settledDecisions, 'settledDecisions'),
    redaction: { redacted: fields.length > 0, fields },
  };
}

function parseCandidate(path: string): GrillReceiptV1 {
  if (!existsSync(path)) {
    throw new LifecycleCommandError(
      'GRILL_RECEIPT_MISSING',
      'The candidate grill receipt is missing.',
      ['Resume batch-grill-me and record its completed receipt through goal-lifecycle.'],
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw invalid('The candidate grill receipt must be valid JSON.');
  }
  if (!isObject(value)) throw invalid('The candidate grill receipt must be a JSON object.');
  requireOnlyKeys(value, [
    'schemaVersion', 'taskId', 'skill', 'rounds', 'recommendations', 'settledDecisions',
    'finalFrontierCount', 'status', 'redaction',
  ], 'receipt');
  if (value.schemaVersion !== 1) throw invalid('The candidate grill receipt schema version is unsupported.');
  const taskId = requireString(value.taskId, 'taskId');
  if (!isObject(value.skill)) throw invalid('The grill receipt skill must be an object.');
  requireOnlyKeys(value.skill, ['name', 'version', 'sourceHash'], 'skill');
  const name = requireString(value.skill.name, 'skill.name');
  const version = requireString(value.skill.version, 'skill.version');
  const sourceHash = requireString(value.skill.sourceHash, 'skill.sourceHash');
  if (name !== 'batch-grill-me' || sourceHash !== PINNED_BATCH_GRILL_SHA256) {
    throw invalid('The grill receipt does not identify the pinned batch-grill-me skill.');
  }
  if (!Array.isArray(value.rounds)) throw invalid('The grill receipt field rounds must be an array.');
  if (value.status !== 'complete' || value.finalFrontierCount !== 0) {
    throw invalid('The grill frontier is not complete.');
  }
  if (!isObject(value.redaction) || typeof value.redaction.redacted !== 'boolean') {
    throw invalid('The grill receipt redaction metadata is invalid.');
  }
  requireOnlyKeys(value.redaction, ['redacted', 'fields'], 'redaction');
  requireStrings(value.redaction.fields, 'redaction.fields');
  return redactReceipt({
    schemaVersion: 1,
    taskId,
    skill: { name, version, sourceHash },
    rounds: value.rounds.map(parseRound),
    recommendations: requireStrings(value.recommendations, 'recommendations'),
    settledDecisions: requireStrings(value.settledDecisions, 'settledDecisions'),
    finalFrontierCount: 0,
    status: 'complete',
    redaction: { redacted: false, fields: [] },
  });
}

export function recordGrill(runPath: string, candidateReceiptPath: string): LifecycleResult {
  try {
    const run = readRunManifest(runPath);
    if (run.state !== 'STARTED' && run.state !== 'GRILL_COMPLETE') {
      throw invalid(`Run ${run.taskId} cannot record a grill receipt from state ${run.state}.`);
    }
    const receipt = parseCandidate(candidateReceiptPath);
    if (receipt.taskId !== run.taskId) throw invalid('The grill receipt taskId does not match RUN.json.');

    if (run.state === 'GRILL_COMPLETE') {
      let canonical: unknown;
      try {
        canonical = JSON.parse(readFileSync(run.grillReceiptPath, 'utf8'));
      } catch {
        throw invalid('The completed grill receipt does not match the canonical GRILL.json.');
      }
      if (!isObject(canonical) || JSON.stringify(canonical) !== JSON.stringify(receipt)) {
        throw invalid('The completed grill receipt does not match the canonical GRILL.json.');
      }
      return lifecycleSuccess(OPERATION, `Grill receipt for ${run.taskId} is already recorded.`, {
        taskId: run.taskId,
        grillReceiptPath: run.grillReceiptPath,
        state: run.state,
      });
    }

    writeGrillReceipt(run.grillReceiptPath, receipt);
    writeRunManifest(runPath, { ...run, state: 'GRILL_COMPLETE' });
    return lifecycleSuccess(OPERATION, `Recorded completed grill receipt for ${run.taskId}.`, {
      taskId: run.taskId,
      grillReceiptPath: run.grillReceiptPath,
      state: 'GRILL_COMPLETE',
    });
  } catch (error) {
    if (error instanceof LifecycleCommandError) {
      return lifecycleFailure(OPERATION, error.code, error.message, error.remediation, error.data);
    }
    if (error instanceof ManifestError) {
      return lifecycleFailure(OPERATION, 'GRILL_RECEIPT_INVALID', 'The lifecycle run or grill receipt is invalid.', [
        'Resume batch-grill-me and record the completed zero frontier.',
      ]);
    }
    return lifecycleFailure(OPERATION, 'GRILL_RECEIPT_INVALID', 'The grill receipt could not be recorded safely.', [
      'Resume batch-grill-me and record the completed zero frontier.',
    ]);
  }
}
