import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { createSeed } from '../src/lib/seed';
import { addAnnouncement, addTopic, getBootstrap, getData } from '../src/lib/store';
import { normalizeTopicName, validateTopic } from '../src/lib/validation';
import { signDemoIdentity } from '../src/lib/auth';
import { POST as createTopicRequest } from '../src/app/api/topics/route';
import type { AppData, Session } from '../src/lib/types';

process.env.DATA_DRIVER = 'local';
process.env.DEMO_MODE = 'true';
const directory = mkdtempSync(path.join(os.tmpdir(), 'summit-topics-'));
process.env.LOCAL_DATA_DIR = directory;
after(async () => { await rm(directory, { recursive: true, force: true }); });
const manager: Session = { employeeId: 'EMP-0004', role: 'manager', demo: true };
const alex: Session = { employeeId: 'EMP-0003', role: 'employee', demo: true };

function request(input: unknown, identity = manager.employeeId) {
  return new Request('http://localhost/api/topics', { method: 'POST', headers: { cookie: `summit_demo=${signDemoIdentity(identity)}`, origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify(input) });
}

test('legacy topic migration preserves all employees, announcements and receipt history', async () => {
  const seed = createSeed(new Date('2026-10-31T12:00:00Z'));
  const legacy = structuredClone(seed) as Partial<AppData>;
  delete legacy.topics;
  legacy.stores?.forEach(store => { delete store.region; });
  legacy.announcements?.forEach(announcement => { delete announcement.topicId; });
  await writeFile(path.join(directory, 'summit.json'), JSON.stringify(legacy));
  const migrated = await getData();
  assert.equal(migrated.topics.length, 5);
  assert.equal(migrated.topics.filter(topic => topic.kind === 'scheduling').length, 1);
  assert.equal(migrated.topics.find(topic => topic.id === 'topic-scheduling')?.name, '60-hour scheduling policy');
  assert.deepEqual(migrated.employees, seed.employees);
  assert.deepEqual(migrated.stores, seed.stores, 'Region metadata is backfilled without changing store records.');
  assert.equal(migrated.employees.find(employee => employee.id === 'EMP-0004')?.name, 'Sami Ahmady');
  assert.deepEqual(migrated.receipts, seed.receipts);
  assert.deepEqual(migrated.announcements.map(announcement => { const { topicId, ...old } = announcement; return old; }), legacy.announcements);
  assert.equal(migrated.announcements.find(announcement => announcement.id === 'ann-scheduling')?.topicId, 'topic-scheduling');
  assert.equal(migrated.announcements.find(announcement => announcement.id === 'ann-safety')?.topicId, 'topic-safety');
  const persisted = JSON.parse(await readFile(path.join(directory, 'summit.json'), 'utf8'));
  assert.equal(persisted.topics.length, 5);
  assert.deepEqual((await getData()).topics, migrated.topics, 'Repeated reads do not replace topic metadata.');
});

test('a manager creates a shared Unicode topic and sends a targeted update linked to it', async () => {
  const before = await getData();
  const created = await createTopicRequest(request({ name: '  Café opening checklist  ', details: 'Open the café counter at 8 AM. Check the coffee machine and replenish takeaway cups before opening.', kind: 'scheduling', authorId: 'EMP-0001' }));
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('cache-control'), 'no-store');
  const topic = await created.json();
  assert.equal(topic.name, 'Café opening checklist');
  assert.equal(topic.authorId, 'EMP-0004');
  assert.equal(topic.kind, 'general', 'Clients cannot grant scheduling-specific behavior to a new topic.');
  assert.ok(topic.id.startsWith('topic-'));
  assert.equal((await getData()).topics.find(existing => existing.id === topic.id)?.details, topic.details);
  assert.ok((await getBootstrap(manager)).topics.some(existing => existing.id === topic.id));
  assert.equal((await getBootstrap(alex)).topics.some(existing => existing.id === topic.id), false, 'Unsent topics do not appear in an associate workspace.');
  const announcement = await addAnnouncement({ topicId: topic.id, category: 'Policy', title: 'Café opens at eight', body: 'Please use the new opening checklist for the café counter on your next opening shift.', priority: 'routine', requiresAcknowledgment: false, recipientIds: ['EMP-0003'], dueAt: null }, manager);
  assert.equal(announcement.topicId, topic.id);
  assert.equal(announcement.category, topic.name, 'The selected topic determines the displayed category.');
  const employeeView = await getBootstrap(alex);
  assert.ok(employeeView.topics.some(existing => existing.id === topic.id && existing.kind === 'general'));
  assert.ok(employeeView.announcements.some(existing => existing.id === announcement.id && existing.topicId === topic.id));
  const outsider = await getBootstrap({ employeeId: 'EMP-0042', role: 'employee', demo: true });
  assert.equal(outsider.topics.some(existing => existing.id === topic.id), false);
  assert.equal((await getData()).employees.length, before.employees.length);
  assert.deepEqual((await getData()).receipts, before.receipts);
});

test('topic validation handles duplicates, malformed input and permission boundaries', async () => {
  assert.deepEqual(validateTopic({ name: '  Product launch  ', details: '  Brief the team on the new product before opening.  ' }), { name: 'Product launch', details: 'Brief the team on the new product before opening.' });
  for (const input of [{ name: '', details: 'Long enough details.' }, { name: 'ok', details: 'Long enough details.' }, { name: 'Topic', details: '' }, { name: 'Topic', details: 'short' }, { name: 'Topic', details: 'x'.repeat(12001) }, { name: 'Topic\nname', details: 'Long enough details.' }, { name: ['Topic'], details: 'Long enough details.' }]) {
    assert.equal((await createTopicRequest(request(input))).status, 400);
  }
  assert.equal((await createTopicRequest(request({ name: 'CAFÉ OPENING CHECKLIST', details: 'Another version of the same topic details.' }))).status, 409);
  assert.equal((await createTopicRequest(request({ name: 'Cafe\u0301 opening checklist', details: 'Another version of the same topic details.' }))).status, 409);
  assert.equal(normalizeTopicName('Café'), normalizeTopicName('CAFE\u0301'));
  assert.equal((await createTopicRequest(request({ name: 'Associate created', details: 'Employees should not be able to create this topic.' }, alex.employeeId))).status, 403);
  await assert.rejects(() => addTopic({ name: 'Wrong role', details: 'A direct service call still checks the manager role.' }, alex), /Only managers/);
  await assert.rejects(() => addAnnouncement({ topicId: 'missing-topic', title: 'Unknown topic update', body: 'This update references a topic that does not exist.', priority: 'routine', requiresAcknowledgment: false, recipientIds: ['EMP-0003'], dueAt: null }, manager), /existing topic/);
});

test('concurrent topic creation is atomic and legacy categories never make a general policy scheduling-specific', async () => {
  const result = await Promise.allSettled([addTopic({ name: 'Returns guidance', details: 'Ask a supervisor when a return does not have a receipt.' }, manager), addTopic({ name: 'RETURNS GUIDANCE', details: 'Ask a supervisor when a return does not have a receipt.' }, manager)]);
  assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal((await getData()).topics.filter(topic => normalizeTopicName(topic.name) === 'returns guidance').length, 1);
  const legacy = await addAnnouncement({ category: 'Policy', title: 'New uniform reminder', body: 'Please wear your name badge and the current store uniform.', priority: 'routine', requiresAcknowledgment: false, recipientIds: ['EMP-0003'], dueAt: null }, manager);
  assert.equal(legacy.topicId, 'topic-operations');
  const topic = (await getData()).topics.find(existing => existing.id === legacy.topicId);
  assert.equal(topic?.kind, 'general');
});
