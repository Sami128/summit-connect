import { ApiError } from './errors';
import type { AppData } from './types';

/** Minimal injectable surface keeps persistence tests independent of Workers. */
export interface SummitD1Statement {
  bind(...values: unknown[]): SummitD1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}
export interface SummitD1Database { prepare(sql: string): SummitD1Statement; }

type StateRow = { payload: string; revision: number; schema_version: number };
const STATE_ID = 'summit';
const SCHEMA_VERSION = 1;
const MAX_ATTEMPTS = 8;
const UNAVAILABLE = 'Shared data is unavailable. Your change was not saved. Please try again.';

function unavailable(): ApiError { return new ApiError(503, UNAVAILABLE); }

function assertPayload(value: unknown): asserts value is AppData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw unavailable();
  const data = value as Partial<AppData>;
  for (const key of ['employees', 'stores', 'topics', 'announcements', 'receipts'] as const) {
    if (!Array.isArray(data[key])) throw unavailable();
  }
}

/**
 * D1 owns the revision check, so independent Worker instances cannot lose writes.
 * Mutation callbacks must only modify their supplied snapshot: retries rerun them.
 * The schema is created by a migration; request handling only reads/inserts/updates.
 */
export function createD1Store(
  db: SummitD1Database,
  seed: () => AppData,
  normalize: (data: AppData) => AppData = data => ({ ...data, mode: 'd1' }),
) {
  async function first(): Promise<StateRow | null> {
    try {
      return await db.prepare('SELECT payload, revision, schema_version FROM summit_state WHERE id = ?').bind(STATE_ID).first<StateRow>();
    } catch { throw unavailable(); }
  }

  function serialize(value: AppData): string {
    assertPayload(value);
    try {
      const normalized = normalize(structuredClone(value));
      assertPayload(normalized);
      return JSON.stringify({ ...normalized, mode: 'd1' });
    } catch { throw unavailable(); }
  }

  async function load(): Promise<StateRow> {
    let row = await first();
    if (!row) {
      const payload = serialize(seed());
      try {
        const result = await db.prepare('INSERT INTO summit_state (id, payload, revision, schema_version) VALUES (?, ?, 0, ?) ON CONFLICT(id) DO NOTHING')
          .bind(STATE_ID, payload, SCHEMA_VERSION).run();
        if (!result.success) throw unavailable();
      } catch { throw unavailable(); }
      // A competing initializer may have won. Always use the persisted winner.
      row = await first();
    }
    if (!row || typeof row.payload !== 'string' || !Number.isSafeInteger(row.revision) || row.revision < 0 || !Number.isSafeInteger(row.schema_version) || row.schema_version < 1 || row.schema_version > SCHEMA_VERSION) throw unavailable();
    return row;
  }

  function decode(row: StateRow): AppData {
    try {
      const value: unknown = JSON.parse(row.payload);
      assertPayload(value);
      const normalized = normalize(value);
      assertPayload(normalized);
      return { ...normalized, mode: 'd1' };
    } catch { throw unavailable(); }
  }

  async function compareAndSwap(row: StateRow, payload: string): Promise<boolean> {
    try {
      const result = await db.prepare('UPDATE summit_state SET payload = ?, revision = revision + 1, schema_version = ? WHERE id = ? AND revision = ? AND schema_version = ?')
        .bind(payload, SCHEMA_VERSION, STATE_ID, row.revision, row.schema_version).run();
      if (!result.success || !Number.isInteger(result.meta?.changes)) throw unavailable();
      return result.meta!.changes === 1;
    } catch { throw unavailable(); }
  }

  async function read(): Promise<AppData> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const row = await load();
      const data = decode(row);
      const payload = serialize(data);
      // Normal polling is read-only; only an actual upgrade changes the row.
      if (payload === row.payload && row.schema_version === SCHEMA_VERSION) return data;
      if (await compareAndSwap(row, payload)) return data;
    }
    throw new ApiError(503, 'Shared data is busy. Please try again.');
  }

  async function mutate<T>(mutation: (data: AppData) => T | Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const row = await load();
      const data = decode(row);
      // Do not catch validation/authorization errors: their original status matters.
      const result = await mutation(data);
      if (await compareAndSwap(row, serialize(data))) return result;
    }
    throw new ApiError(503, 'Shared data is busy. Your change was not saved. Please try again.');
  }

  return { read, mutate };
}
