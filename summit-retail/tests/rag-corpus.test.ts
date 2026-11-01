import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { createDefaultTopics, createSeed, LEGACY_GENERAL_TOPIC_DETAILS, SCHEDULING_POLICY_DETAILS, upgradeLegacyTopicDetails } from '../src/lib/seed';
import { getData } from '../src/lib/store';
import { answerTopicQuestion } from '../src/lib/topic-assistant';
import type { Topic } from '../src/lib/types';

test('illustrative RAG playbooks answer practical questions for each general topic using only that topic', async () => {
  const topics = createDefaultTopics(new Date('2026-10-31T12:00:00Z'));
  assert.equal(topics.length, 5);
  assert.equal(topics.find(topic => topic.kind === 'scheduling')?.details, SCHEDULING_POLICY_DETAILS);
  const cases = [
    ['topic-safety', 'What should I do about damaged equipment?', /Do not use damaged equipment|damaged equipment/],
    ['topic-operations', 'Who receives reports about delivery shortages?', /report shortages or damage to the receiving lead/],
    ['topic-people', 'Who should I contact about benefits enrollment?', /Ask HR about benefits enrollment/],
    ['topic-customer', 'Who handles refund requests?', /customer service lead or shift supervisor/],
  ] as const;
  for (const [id, question, expected] of cases) {
    const topic = topics.find(topic => topic.id === id)!;
    const result = await answerTopicQuestion(topic, question, { apiKey: '' });
    assert.equal(result.mode, 'retrieval', question);
    assert.match(result.answer, expected);
    assert.ok(result.sources.length > 0);
    assert.ok(result.sources.every(source => source.title === topic.name && topic.details.includes(source.passage)));
    assert.doesNotMatch(JSON.stringify(result), /60-hour|company-scheduling|company-compliance|coaching|written warning/);
  }
});

test('playbooks do not invent personal eligibility, return windows or unrelated topic rules', async () => {
  const topics = createDefaultTopics();
  const people = topics.find(topic => topic.id === 'topic-people')!;
  const unknown = await answerTopicQuestion(people, 'How many paid vacation days do I get?', { apiKey: '' });
  assert.equal(unknown.mode, 'unsupported');
  assert.deepEqual(unknown.sources, []);
  const customer = topics.find(topic => topic.id === 'topic-customer')!;
  const returns = await answerTopicQuestion(customer, 'What is the return window?', { apiKey: '' });
  assert.match(returns.answer, /does not specify a return window/);
  assert.doesNotMatch(returns.answer, /\b(?:14|30|60|90)\s+days/);
  const scheduling = await answerTopicQuestion(customer, 'Can I work over 60 hours?', { apiKey: '' });
  assert.equal(scheduling.mode, 'unsupported');
});

test('legacy detail upgrades require an exact built-in id, general kind and untouched original text', () => {
  const defaults = createDefaultTopics(new Date('2026-10-31T12:00:00Z'));
  const safety = defaults.find(topic => topic.id === 'topic-safety')!;
  const legacy: Topic = { ...safety, name: 'Our safety guidance', authorId: 'EMP-0004', createdAt: '2026-01-01T12:00:00Z', details: LEGACY_GENERAL_TOPIC_DETAILS[safety.id] };
  assert.deepEqual(upgradeLegacyTopicDetails(legacy, defaults), { ...legacy, details: safety.details });
  for (const preserved of [
    { ...legacy, details: legacy.details + ' Store-specific additions.' },
    { ...legacy, details: legacy.details + ' ' },
    { ...legacy, id: 'custom-safety-topic' },
    { ...legacy, kind: 'scheduling' as const },
    defaults.find(topic => topic.kind === 'scheduling')!,
  ]) assert.equal(upgradeLegacyTopicDetails(preserved, defaults), preserved);
  assert.equal(legacy.details, LEGACY_GENERAL_TOPIC_DETAILS[safety.id], 'An upgrade does not mutate its input.');
});

process.env.DATA_DRIVER = 'local';
process.env.DEMO_MODE = 'true';
const directory = mkdtempSync(path.join(os.tmpdir(), 'summit-rag-upgrade-'));
process.env.LOCAL_DATA_DIR = directory;
after(async () => { await rm(directory, { recursive: true, force: true }); });

test('persisted corpus migration upgrades untouched examples while preserving custom edits and communication history', async () => {
  const seed = createSeed(new Date('2026-10-31T12:00:00Z'));
  const original = structuredClone(seed);
  for (const topic of original.topics) if (LEGACY_GENERAL_TOPIC_DETAILS[topic.id]) topic.details = LEGACY_GENERAL_TOPIC_DETAILS[topic.id];
  original.topics.find(topic => topic.id === 'topic-safety')!.name = 'Safety at our stores';
  const edited = original.topics.find(topic => topic.id === 'topic-operations')!;
  edited.details += ' Check with Priya before using the west receiving entrance.';
  const custom: Topic = { ...original.topics.find(topic => topic.id === 'topic-safety')!, id: 'custom-safety-guidance', name: 'Regional guidance' };
  original.topics.push(custom);
  await writeFile(path.join(directory, 'summit.json'), JSON.stringify(original));
  const migrated = await getData();
  for (const id of ['topic-safety', 'topic-people', 'topic-customer']) {
    const before = original.topics.find(topic => topic.id === id)!;
    const after = migrated.topics.find(topic => topic.id === id)!;
    const expected = seed.topics.find(topic => topic.id === id)!;
    assert.deepEqual(after, { ...before, details: expected.details });
  }
  assert.deepEqual(migrated.topics.find(topic => topic.id === edited.id), edited);
  assert.deepEqual(migrated.topics.find(topic => topic.id === custom.id), custom);
  assert.deepEqual(migrated.topics.find(topic => topic.kind === 'scheduling'), original.topics.find(topic => topic.kind === 'scheduling'));
  assert.deepEqual(migrated.employees, original.employees);
  assert.deepEqual(migrated.stores, original.stores);
  assert.deepEqual(migrated.announcements, original.announcements);
  assert.deepEqual(migrated.receipts, original.receipts);
  const persisted = JSON.parse(await readFile(path.join(directory, 'summit.json'), 'utf8'));
  assert.deepEqual(persisted.topics, migrated.topics);
  assert.deepEqual((await getData()).topics, migrated.topics, 'Repeated reads keep the same upgraded data.');
});
