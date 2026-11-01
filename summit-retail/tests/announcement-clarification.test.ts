import assert from 'node:assert/strict';
import test from 'node:test';
import { answerTopicQuestion } from '../src/lib/topic-assistant';
import { createDefaultTopics } from '../src/lib/seed';
import type { ConversationMessage } from '../src/lib/conversation';

const customer = createDefaultTopics().find(topic => topic.id === 'topic-customer')!;
const announcement = { id: 'ann-clarify-hours', title: 'Weekly Work Hours Policy', body: 'The weekly scheduling limit is 60 hours per employee. Employees approaching this limit must coordinate with their manager to adjust their schedules and avoid exceeding the limit.' };
const answer = 'Stay at or below 60 hours a week. If you are close to the limit, ask your manager to adjust your schedule.';
const sourceId = 'announcement-' + announcement.id + '-1';
function response() { return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ answer, sourceIds: [sourceId], unsupported: false }) }] }] }); }

test('natural clarification and style requests summarize the open announcement with simple-answer instructions', async () => {
  for (const question of ['can you explain this in simple and short', 'Please simplify this for me', 'Can you break that down for me?', 'Make it shorter and simpler', 'in plain English', 'Please rephrase the current update', 'Could you clarify the practical implications?']) {
    let calls = 0;
    const fetcher = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(String(init?.body));
      assert.match(body.instructions, /three short, clear sentences under 75 words/);
      const input = JSON.parse(body.input.at(-1).content[0].text);
      assert.equal(input.question, question);
      assert.ok(input.passages.length > 0);
      assert.ok(input.passages.every((passage: { id: string }) => passage.id.startsWith('announcement-' + announcement.id + '-')));
      assert.doesNotMatch(JSON.stringify(input.passages), /refund|company-scheduling|40 hours|Operations Manager/);
      return response();
    }) as typeof fetch;
    const result = await answerTopicQuestion(customer, question, { provider: 'openai', apiKey: 'synthetic-test-key', announcement, fetcher });
    assert.equal(calls, 1, question);
    assert.equal(result.mode, 'openai', question);
    assert.equal(result.answer, answer);
    assert.deepEqual(result.sources.map(source => source.id), [sourceId]);
  }
});

test('clarification after an unsupported exchange uses the current update instead of the old subject', async () => {
  const history: ConversationMessage[] = [{ role: 'user', content: 'What is my vacation balance?' }, { role: 'assistant', content: 'That information is not provided in this topic.' }];
  const result = await answerTopicQuestion(customer, 'can you explain this in simple and short', { provider: 'openai', apiKey: 'synthetic-test-key', announcement, history, fetcher: (async () => response()) as typeof fetch });
  assert.equal(result.mode, 'openai');
  assert.equal(result.answer, answer);
  assert.deepEqual(result.sources.map(source => source.id), [sourceId]);
});

test('unrelated subject questions remain unsupported despite requesting a short or simple answer', async () => {
  for (const question of ['Explain my vacation balance in simple words', 'What is the weather in plain English?', 'Give a short answer: what is the return window?']) {
    let calls = 0;
    const result = await answerTopicQuestion(customer, question, { provider: 'openai', apiKey: 'synthetic-test-key', announcement, fetcher: (async () => { calls += 1; return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ answer: 'The current announcement does not provide that information.', sourceIds: [], unsupported: true }) }] }] }); }) as typeof fetch });
    assert.equal(result.mode, 'unsupported', question);
    assert.equal(calls, 1, 'The configured model interprets the question, then reports unsupported honestly.');
    const fallback = await answerTopicQuestion(customer, question, { apiKey: '', announcement });
    assert.equal(fallback.mode, 'unsupported');
    assert.deepEqual(result.sources, []);
  }
});

 test('simple short source fallback omits letter greetings and stays concise', async () => {
  const result = await answerTopicQuestion(customer, 'can you explain this in simple and short', { apiKey: '', announcement: { ...announcement, body: 'Dear Team,\n\n' + announcement.body + '\n\nThank you for your cooperation.' } });
  assert.equal(result.mode, 'retrieval');
  assert.match(result.answer, /60 hours/);
  assert.doesNotMatch(result.answer, /Dear Team|Thank you/);
  assert.ok(result.answer.length < 300);
});
