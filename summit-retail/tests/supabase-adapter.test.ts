import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSeed } from '../src/lib/seed';
import { addAnnouncement, addTopic, getData, recordReceipt } from '../src/lib/store';
import { dataMode } from '../src/lib/supabase';
import { requireSession, withAuthCookies } from '../src/lib/auth';

test('Supabase adapter retrieves every recipient beyond the default 1,000-row limit', async () => {
  const originalFetch = globalThis.fetch;
  const oldEnvironment = { driver: process.env.DATA_DRIVER, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.DATA_DRIVER = 'supabase';
  process.env.SUPABASE_URL = 'https://synthetic-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key-not-a-real-credential';
  const seed = createSeed();
  const tables: Record<string, unknown[]> = {
    stores: seed.stores,
    employees: seed.employees.map(e => ({ id: e.id, name: e.name, role: e.role, department: e.department, store_id: e.storeId, manager_id: e.managerId, access_role: e.accessRole })),
    topics: seed.topics.map(topic => ({ id: topic.id, name: topic.name, details: topic.details, kind: topic.kind, author_id: topic.authorId, created_at: topic.createdAt })),
    announcements: seed.announcements.map(a => ({ id: a.id, title: a.title, body: a.body, category: a.category, topic_id: a.topicId, priority: a.priority, requires_acknowledgment: a.requiresAcknowledgment, author_id: a.authorId, created_at: a.createdAt, due_at: a.dueAt })),
    announcement_recipients: seed.announcements.flatMap(a => a.recipientIds.map(id => ({ announcement_id: a.id, employee_id: id }))),
    receipts: seed.receipts.map(r => ({ announcement_id: r.announcementId, employee_id: r.employeeId, read_at: r.readAt, acknowledged_at: r.acknowledgedAt })),
  };
  const requestedOffsets: number[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const table = url.pathname.split('/').at(-1)!;
    assert.ok(table in tables, 'Only expected table reads are requested.');
    const offset = Number(url.searchParams.get('offset') || 0);
    const limit = Number(url.searchParams.get('limit') || 500);
    if (table === 'announcement_recipients') requestedOffsets.push(offset);
    return Response.json(tables[table].slice(offset, offset + limit));
  };
  try {
    const data = await getData();
    assert.equal(data.mode, 'supabase');
    assert.equal(data.employees.length, 200);
    assert.equal(data.topics.length, 5);
    assert.equal(data.announcements.find(announcement => announcement.id === 'ann-scheduling')?.topicId, 'topic-scheduling');
    assert.equal(data.announcements.reduce((total, a) => total + a.recipientIds.length, 0), 1040);
    assert.deepEqual(requestedOffsets, [0, 500, 1000]);
    assert.equal(data.receipts.length, seed.receipts.length);
    globalThis.fetch = async () => Response.json({ message: 'Read before acknowledging', code: 'P0001' }, { status: 400 });
    await assert.rejects(() => recordReceipt('ann-safety', 'acknowledge', { employeeId: 'EMP-0003', role: 'employee', demo: false }), /before acknowledging/);
    globalThis.fetch = async () => Response.json({ message: 'Confirmation is not required for you on this announcement', code: 'P0001' }, { status: 400 });
    await assert.rejects(() => recordReceipt('ann-safety', 'acknowledge', { employeeId: 'EMP-0004', role: 'manager', demo: false }), error => error instanceof Error && 'status' in error && error.status === 400 && /not required for you/.test(error.message));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of [['DATA_DRIVER', oldEnvironment.driver], ['SUPABASE_URL', oldEnvironment.url], ['SUPABASE_SERVICE_ROLE_KEY', oldEnvironment.key]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('partial Supabase configuration fails visibly rather than falling back to disk', () => {
  const original = { driver: process.env.DATA_DRIVER, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.DATA_DRIVER;
  process.env.SUPABASE_URL = 'https://synthetic-test.supabase.co';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try { assert.throws(() => dataMode(), /not fully configured/); }
  finally {
    for (const [name, value] of [['DATA_DRIVER', original.driver], ['SUPABASE_URL', original.url], ['SUPABASE_SERVICE_ROLE_KEY', original.key]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('Supabase topic writes preserve manager authorship and send announcements through the transactional topic link', async () => {
  const old = { fetcher: globalThis.fetch, driver: process.env.DATA_DRIVER, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  Object.assign(process.env, { DATA_DRIVER: 'supabase', SUPABASE_URL: 'https://synthetic-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-key-not-a-real-credential' });
  const seed = createSeed();
  const tables: Record<string, unknown[]> = {
    stores: seed.stores,
    employees: seed.employees.map(employee => ({ id: employee.id, name: employee.name, role: employee.role, department: employee.department, store_id: employee.storeId, manager_id: employee.managerId, access_role: employee.accessRole })),
    topics: seed.topics.map(topic => ({ id: topic.id, name: topic.name, details: topic.details, kind: topic.kind, author_id: topic.authorId, created_at: topic.createdAt })),
    announcements: [], announcement_recipients: [], receipts: [],
  };
  let duplicateInsert = false;
  let insertedTopic: Record<string, unknown> | undefined;
  let submittedAnnouncement: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const table = url.pathname.split('/').at(-1)!;
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    if (table === 'topics' && method === 'POST') {
      if (duplicateInsert) return Response.json({ message: 'duplicate key value violates unique constraint', code: '23505' }, { status: 409 });
      insertedTopic = JSON.parse(String(init?.body));
      tables.topics.push(insertedTopic!);
      return new Response(null, { status: 201 });
    }
    if (table === 'summit_create_announcement') {
      const parameters = JSON.parse(String(init?.body));
      assert.equal(parameters.p_author_id, 'EMP-0004');
      submittedAnnouncement = parameters.p_announcement;
      return new Response(null, { status: 204 });
    }
    assert.ok(table in tables);
    return Response.json(tables[table]);
  };
  try {
    const manager = { employeeId: 'EMP-0004', role: 'manager' as const, demo: false };
    const topic = await addTopic({ name: 'Product care', details: 'Explain how to clean and care for the new product range.' }, manager);
    assert.equal(insertedTopic?.author_id, 'EMP-0004');
    assert.equal(insertedTopic?.kind, 'general');
    const announcement = await addAnnouncement({ topicId: topic.id, category: 'Policy', title: 'Product care update', body: 'Please use the product care guide when answering customer questions.', priority: 'routine', requiresAcknowledgment: false, recipientIds: ['EMP-0003'], dueAt: null }, manager);
    assert.equal(announcement.topicId, topic.id);
    assert.equal(announcement.category, 'Product care');
    assert.equal(submittedAnnouncement?.topicId, topic.id);
    assert.equal(submittedAnnouncement?.category, 'Product care');
    duplicateInsert = true;
    await assert.rejects(() => addTopic({ name: 'Concurrent existing topic', details: 'A database uniqueness conflict must become a useful duplicate response.' }, manager), (error: unknown) => error instanceof Error && 'status' in error && error.status === 409);
  } finally {
    globalThis.fetch = old.fetcher;
    for (const [name, value] of [['DATA_DRIVER', old.driver], ['SUPABASE_URL', old.url], ['SUPABASE_SERVICE_ROLE_KEY', old.key]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('concurrent authenticated requests share one token refresh and return refreshed HttpOnly cookies', async () => {
  const old = { fetcher: globalThis.fetch, driver: process.env.DATA_DRIVER, demo: process.env.DEMO_MODE, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.DATA_DRIVER = 'supabase';
  process.env.DEMO_MODE = 'false';
  process.env.SUPABASE_URL = 'https://synthetic-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-key-not-a-real-credential';
  const user = { id: '00000000-0000-4000-8000-000000000003', aud: 'authenticated', created_at: '2026-10-31T00:00:00Z', app_metadata: {}, user_metadata: {} };
  let rotations = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname.endsWith('/token')) {
      rotations += 1;
      return Response.json({ access_token: 'new-access-token', refresh_token: 'new-refresh-token', token_type: 'bearer', expires_in: 3600, user });
    }
    if (url.pathname.endsWith('/user')) {
      const headers = new Headers(init?.headers);
      if (headers.get('authorization')?.includes('expired-access')) return Response.json({ msg: 'Access token expired', code: 'bad_jwt' }, { status: 401 });
      return Response.json(user);
    }
    if (url.pathname.endsWith('/employee_auth')) return Response.json({ employee_id: 'EMP-0003', employees: { access_role: 'employee' } });
    return Response.json({ message: 'Unexpected request' }, { status: 500 });
  };
  const requests = [0, 1].map(() => new Request('https://summit.example/api/bootstrap', { headers: { cookie: 'summit_access=expired-access; summit_refresh=old-refresh-token' } }));
  try {
    const sessions = await Promise.all(requests.map(request => requireSession(request)));
    assert.ok(sessions.every(session => session.employeeId === 'EMP-0003' && session.role === 'employee' && !session.demo));
    assert.equal(rotations, 1);
    for (const request of requests) {
      const cookies = withAuthCookies(request, Response.json({ ok: true })).headers.getSetCookie();
      assert.equal(cookies.length, 2);
      assert.ok(cookies.every(value => value.includes('HttpOnly') && value.includes('Secure') && value.includes('SameSite=Lax')));
    }
  } finally {
    globalThis.fetch = old.fetcher;
    globalThis.summitRefreshes?.clear();
    for (const [name, value] of [['DATA_DRIVER', old.driver], ['DEMO_MODE', old.demo], ['SUPABASE_URL', old.url], ['SUPABASE_SERVICE_ROLE_KEY', old.key]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
