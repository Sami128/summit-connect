import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import test from 'node:test';
import { createD1Store, type SummitD1Database, type SummitD1Statement } from '../lib/d1-store';
import { ApiError } from '../lib/errors';
import { createSeed } from '../lib/seed';
import type { AppData } from '../lib/types';

const seed = () => createSeed(new Date('2026-10-31T12:00:00Z'));

/** Runs real SQLite SQL; only the async D1 transport surface is adapted. */
function database(createTable = true) {
  const sqlite = new DatabaseSync(':memory:');
  if (createTable) sqlite.exec('CREATE TABLE summit_state (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, schema_version INTEGER NOT NULL DEFAULT 1)');
  const writes: string[] = [];
  const db: SummitD1Database = {
    prepare(sql) {
      let values: SQLInputValue[] = [];
      const statement: SummitD1Statement = {
        bind(...next) { values = next as SQLInputValue[]; return statement; },
        async first<T>() { return (sqlite.prepare(sql).get(...values) ?? null) as T | null; },
        async run() {
          const result = sqlite.prepare(sql).run(...values);
          writes.push(sql);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
  };
  return { db, sqlite, writes };
}

function isUnavailable(error: unknown): boolean { return error instanceof ApiError && error.status === 503; }

test('competing D1 initialization uses the persisted winner and later reads do not write', async () => {
  const { db, sqlite, writes } = database();
  try {
    const one = createD1Store(db, () => { const data = seed(); data.topics[0].name = 'First initializer'; return data; });
    const two = createD1Store(db, () => { const data = seed(); data.topics[0].name = 'Second initializer'; return data; });
    const [left, right] = await Promise.all([one.read(), two.read()]);
    assert.equal(left.topics[0].name, right.topics[0].name);
    assert.equal(left.mode, 'd1');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM summit_state').get()!.total, 1);
    const writeCount = writes.length;
    await Promise.all([one.read(), two.read()]);
    assert.equal(writes.length, writeCount, 'polls must not rewrite the document');
  } finally { sqlite.close(); }
});

test('independent D1 clients preserve concurrent mutations and cross-client reads', async () => {
  const { db, sqlite } = database();
  try {
    const clients = Array.from({ length: 6 }, () => createD1Store(db, seed));
    await clients[0].read();
    const ids = await Promise.all(clients.map((client, index) => client.mutate(async data => {
      // Yield after reading to make clients contend on the same revisions.
      await Promise.resolve();
      const id = `concurrent-${index}`;
      data.topics.push({ id, name: id, details: 'Fictional concurrency verification.', kind: 'general', authorId: 'EMP-0004', createdAt: '2026-10-31T12:00:00Z' });
      return id;
    })));
    const persisted = await createD1Store(db, seed).read();
    assert.deepEqual(persisted.topics.filter(topic => topic.id.startsWith('concurrent-')).map(topic => topic.id).sort(), ids.sort());
    assert.equal(sqlite.prepare('SELECT revision FROM summit_state').get()!.revision, 6);
  } finally { sqlite.close(); }
});

test('D1 mutation validation keeps its original status and commits nothing', async () => {
  const { db, sqlite, writes } = database();
  try {
    const store = createD1Store(db, seed);
    const before = await store.read();
    const count = writes.length;
    await assert.rejects(store.mutate(data => {
      data.topics.length = 0;
      throw new ApiError(403, 'Only managers can add topics.');
    }), error => error instanceof ApiError && error.status === 403);
    assert.deepEqual(await store.read(), before);
    assert.equal(writes.length, count);
  } finally { sqlite.close(); }
});

test('missing D1 schema and malformed saved data fail closed without reseeding', async () => {
  const missing = database(false);
  let seeds = 0;
  try {
    await assert.rejects(createD1Store(missing.db, () => { seeds += 1; return seed(); }).read(), isUnavailable);
    assert.equal(seeds, 0);
  } finally { missing.sqlite.close(); }
  const invalid = database();
  try {
    invalid.sqlite.prepare('INSERT INTO summit_state (id, payload, revision, schema_version) VALUES (?, ?, 0, 1)').run('summit', '{"employees":[]}');
    await assert.rejects(createD1Store(invalid.db, () => { seeds += 1; return seed(); }).read(), isUnavailable);
    assert.equal(seeds, 0);
    assert.equal(invalid.writes.length, 0);
  } finally { invalid.sqlite.close(); }
});

test('D1 CAS contention stops after eight attempts without reporting success', async () => {
  const { db, sqlite } = database();
  try {
    await createD1Store(db, seed).read();
    let callbacks = 0;
    const contended: SummitD1Database = {
      prepare(sql) {
        const statement = db.prepare(sql);
        if (!sql.startsWith('UPDATE ')) return statement;
        return {
          bind(...values) { statement.bind(...values); return this; },
          first: statement.first.bind(statement),
          async run() { return { success: true, meta: { changes: 0 } }; },
        };
      },
    };
    await assert.rejects(createD1Store(contended, seed).mutate(data => {
      callbacks += 1;
      data.topics[0].name = 'Never persisted';
    }), isUnavailable);
    assert.equal(callbacks, 8);
    assert.notEqual((await createD1Store(db, seed).read()).topics[0].name, 'Never persisted');
  } finally { sqlite.close(); }
});

test('D1 normalization upgrades once and preserves unrelated saved records', async () => {
  const { db, sqlite, writes } = database();
  try {
    const original = await createD1Store(db, seed).read();
    const normalize = (data: AppData): AppData => ({ ...data, topics: data.topics.map((topic, index) => index === 0 ? { ...topic, details: 'Upgraded illustrative policy details.' } : topic), mode: 'd1' });
    const upgraded = await createD1Store(db, seed, normalize).read();
    assert.deepEqual(upgraded.announcements, original.announcements);
    assert.deepEqual(upgraded.receipts, original.receipts);
    assert.equal(upgraded.topics[0].details, 'Upgraded illustrative policy details.');
    const count = writes.length;
    await createD1Store(db, seed, normalize).read();
    assert.equal(writes.length, count);
    assert.equal(sqlite.prepare('SELECT revision FROM summit_state').get()!.revision, 1);
  } finally { sqlite.close(); }
});
