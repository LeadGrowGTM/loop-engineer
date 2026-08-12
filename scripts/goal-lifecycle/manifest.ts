import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

export type RunState = "STARTED" | "GRILL_COMPLETE" | "VALIDATED" | "FINISHED";

export interface RunManifestV1 {
  schemaVersion: 1;
  taskId: string;
  title: string;
  state: RunState;
  repositoryRoot: string;
  gitCommonDirectory: string;
  worktreePath: string;
  poolRoot: string;
  leaseHolder: string;
  branch: string;
  sourceHead: string;
  runDirectory: string;
  grillReceiptPath: string;
}

export interface GrillRoundV1 {
  questions: string[];
  recommendations: string[];
  settledDecisions: string[];
}

export interface GrillReceiptV1 {
  schemaVersion: 1;
  taskId: string;
  skill: {
    name: string;
    version: string;
    sourceHash: string;
  };
  rounds: GrillRoundV1[];
  recommendations: string[];
  settledDecisions: string[];
  finalFrontierCount: number;
  status: "complete";
  redaction: {
    redacted: boolean;
    fields: string[];
  };
}

export class ManifestError extends Error {
  constructor(readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "ManifestError";
  }
}

let atomicWriteCounter = 0;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readVersionedObject(path: string, kind: "RUN_MANIFEST" | "GRILL_RECEIPT"): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "could not read JSON";
    throw new ManifestError(`${kind}_INVALID`, detail);
  }
  if (!isObject(parsed)) throw new ManifestError(`${kind}_INVALID`, "Expected a JSON object.");
  if (parsed.schemaVersion !== 1) {
    throw new ManifestError(`${kind}_UNSUPPORTED`, `Unsupported schema version: ${String(parsed.schemaVersion)}.`);
  }
  return parsed;
}

function requireString(record: Record<string, unknown>, field: string, kind: "RUN_MANIFEST" | "GRILL_RECEIPT"): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new ManifestError(`${kind}_INVALID`, `${field} must be a non-empty string.`);
  }
  return value;
}

function isRunState(value: unknown): value is RunState {
  return value === "STARTED" || value === "GRILL_COMPLETE" || value === "VALIDATED" || value === "FINISHED";
}

export function readJsonObject(path: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "could not read JSON";
    throw new ManifestError("JSON_INVALID", detail);
  }
  if (!isObject(parsed)) throw new ManifestError("JSON_INVALID", "Expected a JSON object.");
  return parsed;
}

export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  atomicWriteCounter += 1;
  const temporaryPath = `${path}.tmp-${process.pid}-${atomicWriteCounter}`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  try {
    writeFileSync(temporaryPath, serialized, { flag: "wx" });
    renameSync(temporaryPath, path);
  } catch (error) {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    throw error;
  }
}

export function readRunManifest(path: string): RunManifestV1 {
  const record = readVersionedObject(path, "RUN_MANIFEST");
  const fields = [
    "taskId",
    "title",
    "repositoryRoot",
    "gitCommonDirectory",
    "worktreePath",
    "poolRoot",
    "leaseHolder",
    "branch",
    "sourceHead",
    "runDirectory",
    "grillReceiptPath",
  ] as const;
  for (const field of fields) requireString(record, field, "RUN_MANIFEST");
  if (!isRunState(record.state)) throw new ManifestError("RUN_MANIFEST_INVALID", "state is invalid.");

  return record as unknown as RunManifestV1;
}

export function writeRunManifest(path: string, manifest: RunManifestV1): void {
  if (manifest.schemaVersion !== 1) {
    throw new ManifestError("RUN_MANIFEST_UNSUPPORTED", `Unsupported schema version: ${String(manifest.schemaVersion)}.`);
  }
  writeJsonAtomic(path, manifest);
}

export function readGrillReceipt(path: string): GrillReceiptV1 {
  const record = readVersionedObject(path, "GRILL_RECEIPT");
  requireString(record, "taskId", "GRILL_RECEIPT");
  return record as unknown as GrillReceiptV1;
}

export function writeGrillReceipt(path: string, receipt: GrillReceiptV1): void {
  if (receipt.schemaVersion !== 1) {
    throw new ManifestError("GRILL_RECEIPT_UNSUPPORTED", `Unsupported schema version: ${String(receipt.schemaVersion)}.`);
  }
  writeJsonAtomic(path, receipt);
}
