import { decode } from './vendor/toon-2.3.0.mjs';

export interface TaskRecord {
  id: string;
  title: string;
  state: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Decode official TOON, then validate the flat task-detail fields used by lifecycle start. */
export function decodeTaskDetail(output: string): TaskRecord {
  const document: unknown = decode(output);
  if (!isObjectRecord(document) || Object.keys(document).length !== 1 || !isObjectRecord(document.task)) {
    throw new TypeError('tasks-axi TOON must contain exactly one task object.');
  }
  if (Object.values(document.task).some((value) => typeof value === 'object' && value !== null)) {
    throw new TypeError('TOON task must contain only flat scalar fields.');
  }

  const { id, title, state } = document.task;
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('TOON task id must be a non-empty string.');
  if (typeof title !== 'string' || title.length === 0) throw new TypeError('TOON task title must be a non-empty string.');
  if (typeof state !== 'string' || state.length === 0) throw new TypeError('TOON task state must be a non-empty string.');
  return { id, title, state };
}
