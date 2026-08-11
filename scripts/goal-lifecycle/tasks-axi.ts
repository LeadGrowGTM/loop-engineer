export interface TaskRecord {
  id: string;
  title: string;
  state: string;
}

type ToonScalar = string | number | boolean | null;

function decodeScalar(source: string, lineNumber: number): ToonScalar {
  if (source.length === 0) throw new SyntaxError(`TOON line ${lineNumber} has an empty scalar.`);
  if (source.startsWith('"')) {
    try {
      const decoded: unknown = JSON.parse(source);
      if (typeof decoded !== 'string') throw new SyntaxError(`TOON line ${lineNumber} is not a string scalar.`);
      return decoded;
    } catch (error) {
      if (error instanceof SyntaxError && error.message.startsWith('TOON line')) throw error;
      throw new SyntaxError(`TOON line ${lineNumber} has an invalid quoted scalar.`);
    }
  }
  if (source === 'null') return null;
  if (source === 'true') return true;
  if (source === 'false') return false;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(source)) return Number(source);
  if (source.startsWith('[') || source.startsWith('{')) {
    throw new SyntaxError(`TOON line ${lineNumber} uses a non-scalar value in task detail.`);
  }
  return source;
}

/**
 * Decodes the complete flat `task` detail schema emitted by tasks-axi.
 * TOON quoted scalars use JSON escaping; unquoted primitives follow TOON's
 * null/boolean/number rules. Nested collections are forbidden at this typed seam.
 */
export function decodeTaskDetail(output: string): TaskRecord {
  const lines = output.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  if (lines.length < 2 || lines[0] !== 'task:') {
    throw new SyntaxError('tasks-axi TOON must contain exactly one task object.');
  }
  const fields = new Map<string, ToonScalar>();
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^  ([a-z][a-z0-9_]*): (.+)$/);
    if (!match) throw new SyntaxError(`TOON line ${index + 1} is not a flat task field.`);
    const [, key, source] = match;
    if (fields.has(key)) throw new SyntaxError(`TOON task field ${key} is duplicated.`);
    fields.set(key, decodeScalar(source, index + 1));
  }
  const id = fields.get('id');
  const title = fields.get('title');
  const state = fields.get('state');
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('TOON task id must be a non-empty string.');
  if (typeof title !== 'string' || title.length === 0) throw new TypeError('TOON task title must be a non-empty string.');
  if (typeof state !== 'string' || state.length === 0) throw new TypeError('TOON task state must be a non-empty string.');
  return { id, title, state };
}
