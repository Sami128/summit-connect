import assert from 'node:assert/strict';
import test from 'node:test';
import { generateGroundedJson, type AiProvider } from '../lib/ai-provider';

test('hosted AI rejects provider redirects without forwarding credentials to Location', async () => {
  for (const provider of ['openai', 'gemini'] as const satisfies readonly AiProvider[]) {
    for (const status of [301, 302]) {
      let calls = 0;
      const key = 'synthetic-server-only-key';
      const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        const url = String(input);
        assert.equal(new URL(url).hostname, provider === 'openai' ? 'api.openai.com' : 'generativelanguage.googleapis.com');
        assert.doesNotMatch(url, /synthetic-server-only-key|untrusted\.invalid/);
        assert.equal(init?.redirect, 'manual');
        assert.equal(init?.cache, 'no-store');
        const headers = new Headers(init?.headers);
        assert.equal(headers.get(provider === 'openai' ? 'Authorization' : 'x-goog-api-key'), provider === 'openai' ? `Bearer ${key}` : key);
        return new Response('private-upstream-body', { status, headers: { Location: 'https://untrusted.invalid/collect-credentials' } });
      }) as typeof fetch;
      await assert.rejects(generateGroundedJson('Use the current passages.', { question: 'When does the store close?' }, { provider, apiKey: key, fetcher }), error => {
        assert.equal(String(error), 'Error: AI assistance is unavailable.');
        assert.doesNotMatch(String(error), /synthetic-server-only-key|private-upstream-body|untrusted/);
        return true;
      });
      assert.equal(calls, 1, 'a redirect must never cause a second provider request');
    }
  }
});

test('hosted OpenAI completed responses still parse using Workers-compatible fetch options', async () => {
  const expected = { answer: 'The store closes at 6 p.m.', sourceIds: ['topic-hours-1'], unsupported: false };
  let calls = 0;
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls += 1;
    assert.equal(init?.redirect, 'manual');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal instanceof AbortSignal);
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.store, false);
    assert.equal(payload.text.format.type, 'json_schema');
    assert.equal(payload.text.format.strict, true);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(expected) }] }] });
  }) as typeof fetch;
  const result = await generateGroundedJson('Use only the current passages.', { question: 'When does the store close?', passages: [{ id: 'topic-hours-1', text: expected.answer }] }, { provider: 'openai', apiKey: 'synthetic-server-only-key', fetcher });
  assert.equal(calls, 1);
  assert.equal(result.provider, 'openai');
  assert.deepEqual(result.value, expected);
});
