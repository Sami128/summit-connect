import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_HISTORY_BYTES, validateConversationHistory } from '../lib/conversation';
import { answerTopicQuestion } from '../lib/topic-assistant';
import { createDefaultTopics } from '../lib/seed';

test('long questions and one-character prompts are accepted without input truncation', async () => {
  const topic = createDefaultTopics().find(item => item.kind === 'general')!;
  const answer = await answerTopicQuestion(topic, 'What should I do? ' + 'context '.repeat(1900), { apiKey: '' });
  assert.ok(answer.answer);
  assert.ok((await answerTopicQuestion(topic, '?', { apiKey: '' })).answer);
});

test('oversized completed history drops old exchanges and retains recent context', () => {
  const messages = Array.from({ length: 6 }, (_, index) => [
    { role: 'user', content: `Question ${index} ` + 'x'.repeat(15970) },
    { role: 'assistant', content: `Answer ${index} ` + 'y'.repeat(15970) },
  ]).flat();
  const kept = validateConversationHistory(messages);
  assert.ok(kept.length < messages.length);
  assert.equal(kept.length % 2, 0);
  assert.ok(kept.at(-1)!.content.startsWith('Answer 5'));
  assert.ok(new TextEncoder().encode(JSON.stringify(kept)).byteLength <= MAX_HISTORY_BYTES);
});

test('greetings and help requests welcome users before scheduling retrieval', async () => {
  const topic = createDefaultTopics().find(item => item.kind === 'scheduling')!;
  for (const question of ['hi', 'hello', 'hey', 'thanks', 'thankyou', 'help', 'help me', 'can you help me']) {
    const answer = await answerTopicQuestion(topic, question, { apiKey: '' });
    assert.match(answer.answer, /Ask a question/);
    assert.equal(answer.mode, 'retrieval');
    assert.deepEqual(answer.sources, []);
  }
});
