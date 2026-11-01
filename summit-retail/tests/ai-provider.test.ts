import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateGroundedJson, resolveAiConfig } from '../src/lib/ai-provider';
import { answerPolicyQuestion } from '../src/lib/policy';
import { answerTopicQuestion } from '../src/lib/topic-assistant';
import type { Topic } from '../src/lib/types';

const AI_ENV_KEYS = ['AI_PROVIDER', 'OPENAI_API_KEY', 'OpenAI_API', 'OPENAI_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL'] as const;
type AiEnv = Partial<Record<(typeof AI_ENV_KEYS)[number], string>>;

function withAiEnv(values: AiEnv, check: () => void): void {
  const previous = Object.fromEntries(AI_ENV_KEYS.map(key => [key, process.env[key]]));
  try {
    for (const key of AI_ENV_KEYS) delete process.env[key];
    Object.assign(process.env, values);
    check();
  } finally {
    for (const key of AI_ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function openAiResponse(value: unknown): Response {
  return Response.json({
    status: 'completed',
    output: [
      { type: 'reasoning', summary: [] },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] },
    ],
  });
}

test('AI configuration accepts the local OpenAI alias and prefers the standard key', () => {
  withAiEnv({ OpenAI_API: 'test-alias-key' }, () => {
    const config = resolveAiConfig();
    assert.equal(config.provider, 'openai');
    assert.equal(config.apiKey, 'test-alias-key');
    assert.equal(config.model, 'gpt-4.1-mini');
  });
  withAiEnv({ OpenAI_API: 'test-alias-key', OPENAI_API_KEY: 'test-standard-key', OPENAI_MODEL: 'gpt-4.1' }, () => {
    const config = resolveAiConfig();
    assert.equal(config.provider, 'openai');
    assert.equal(config.apiKey, 'test-standard-key');
    assert.equal(config.model, 'gpt-4.1');
  });
});

test('AI provider selection respects explicit configuration and preserves Gemini callers', () => {
  withAiEnv({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-openai-env-key', GEMINI_API_KEY: 'test-gemini-env-key' }, () => {
    assert.equal(resolveAiConfig().provider, 'openai');
    const gemini = resolveAiConfig({ provider: 'gemini' });
    assert.equal(gemini.provider, 'gemini');
    assert.equal(gemini.apiKey, 'test-gemini-env-key');
    assert.equal(gemini.model, 'gemini-3.8-flash');
    assert.equal(resolveAiConfig({ apiKey: 'test-existing-gemini-key' }).provider, 'gemini');
    const disabled = resolveAiConfig({ apiKey: '' });
    assert.equal(disabled.provider, 'gemini');
    assert.equal(disabled.apiKey, '');
    const explicit = resolveAiConfig({ provider: 'openai', apiKey: 'test-explicit-key', model: 'gpt-4.1' });
    assert.equal(explicit.provider, 'openai');
    assert.equal(explicit.apiKey, 'test-explicit-key');
    assert.equal(explicit.model, 'gpt-4.1');
  });
  withAiEnv({ AI_PROVIDER: 'gemini', OPENAI_API_KEY: 'test-openai-key', GEMINI_API_KEY: 'test-gemini-key' }, () => {
    assert.equal(resolveAiConfig().provider, 'gemini');
    assert.equal(resolveAiConfig().apiKey, 'test-gemini-key');
    assert.equal(resolveAiConfig({ provider: 'openai' }).provider, 'openai');
  });
  withAiEnv({}, () => {
    assert.equal(resolveAiConfig().provider, 'gemini');
    assert.ok(!resolveAiConfig().apiKey);
  });
});

test('OpenAI uses server-side authorization, structured output and no response storage', async () => {
  const expected = { answer: 'Stores close at 6 p.m. on Friday.', sourceIds: ['topic-hours-1'], unsupported: false };
  const context = { question: 'When do stores close?', passages: [{ id: 'topic-hours-1', text: 'On Friday, stores close at 6 p.m.' }] };
  let calls = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.equal(String(input), 'https://api.openai.com/v1/responses');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Authorization'), 'Bearer test-server-only-key');
    assert.equal(headers.get('Content-Type'), 'application/json');
    const serialized = String(init?.body);
    assert.doesNotMatch(serialized, /test-server-only-key|employeeId|managerId|recipientIds/);
    const body = JSON.parse(serialized);
    assert.equal(body.model, 'gpt-4.1-mini');
    assert.equal(body.store, false);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.properties.answer.type, 'string');
    assert.equal(body.text.format.schema.properties.sourceIds.type, 'array');
    assert.match(serialized, /When do stores close\?/);
    assert.match(serialized, /topic-hours-1/);
    assert.match(serialized, /On Friday, stores close at 6 p\.m\./);
    assert.ok(init?.signal instanceof AbortSignal);
    return openAiResponse(expected);
  }) as typeof fetch;
  const result = await generateGroundedJson('Use only the supplied passages.', context, { provider: 'openai', apiKey: 'test-server-only-key', fetcher });
  assert.equal(calls, 1);
  assert.equal(result.provider, 'openai');
  assert.deepEqual(result.value, expected);
});

test('OpenAI failures reject safely without exposing credentials or upstream details', async () => {
  const privateDetail = 'private-upstream-text-do-not-display';
  const responses = [
    () => new Response(privateDetail, { status: 429 }),
    () => Response.json({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [{ type: 'message', content: [{ type: 'output_text', text: '{"answer":"partial' }] }] }),
    () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: privateDetail }] }] }),
    () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: privateDetail }] }] }),
    () => Response.json({ status: 'completed', output: [] }),
    () => new Response(privateDetail, { headers: { 'Content-Type': 'application/json' } }),
  ];
  for (const response of responses) {
    await assert.rejects(
      generateGroundedJson('Answer from sources.', { question: 'When do stores close?' }, { provider: 'openai', apiKey: 'test-private-key', fetcher: (async () => response()) as typeof fetch }),
      error => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(String(error), /test-private-key|private-upstream-text-do-not-display|Bearer/);
        return true;
      },
    );
  }
});

test('OpenAI network errors and timeouts remain sanitized and abort the request', async () => {
  await assert.rejects(generateGroundedJson('Answer from sources.', {}, {
    provider: 'openai', apiKey: 'test-private-key',
    fetcher: (async () => { throw new Error('private-network-detail test-private-key'); }) as typeof fetch,
  }), error => {
    assert.doesNotMatch(String(error), /private-network-detail|test-private-key/);
    return true;
  });
  let aborted = false;
  const fetcher = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('private-timeout-detail')); }, { once: true });
  })) as typeof fetch;
  await assert.rejects(generateGroundedJson('Answer from sources.', {}, { provider: 'openai', apiKey: 'test-private-key', fetcher, timeoutMs: 5 }), error => {
    assert.doesNotMatch(String(error), /private-timeout-detail|test-private-key/);
    return true;
  });
  assert.equal(aborted, true);
});

test('OpenAI policy answers retain source checks and unsupported questions skip generation', async () => {
  const answer = 'Based on Summit policy, schedules should stay at or below 60 hours. Eligible team members receive overtime after 40 hours in a workweek at at least 1.5 times their regular rate.';
  let calls = 0;
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls++;
    assert.match(String(init?.body), /retrievedPassages/);
    assert.doesNotMatch(String(init?.body), /employeeId|managerId|recipientIds/);
    return openAiResponse({ answer, sourceIds: ['company-scheduling', 'company-wages'], unsupported: false });
  }) as typeof fetch;
  const options = { provider: 'openai' as const, apiKey: 'test-openai-key', fetcher };
  const result = await answerPolicyQuestion('Does overtime start at 60 hours?', options);
  assert.equal(result.mode, 'openai');
  assert.equal(result.answer, answer);
  assert.ok(result.sources.every(source => source.kind === 'company'));
  const unsupported = await answerPolicyQuestion('What is the weather in Seattle?', options);
  assert.equal(unsupported.mode, 'unsupported');
  assert.equal(calls, 1);
  const invented = await answerPolicyQuestion('Does overtime start at 60 hours?', {
    ...options, fetcher: (async () => openAiResponse({ answer, sourceIds: ['invented-source'], unsupported: false })) as typeof fetch,
  });
  assert.equal(invented.mode, 'retrieval');
  assert.match(invented.answer, /after 40 hours/);
});

test('OpenAI topic assistance receives only selected topic details and safely falls back', async () => {
  const topic: Topic = {
    id: 'openai-hours', name: 'Friday closing hours', kind: 'general', authorId: 'PRIVATE-AUTHOR-ID', createdAt: '2026-10-31T12:00:00Z',
    details: 'On Friday, stores close at 6 p.m. Associates should return keys to the shift supervisor.',
  };
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = String(init?.body);
    assert.match(body, /Friday closing hours/);
    assert.doesNotMatch(body, /PRIVATE-AUTHOR-ID|employeeId|managerId|authorId|recipientIds|company-scheduling|company-compliance/);
    return openAiResponse({ answer: 'On Friday, stores close at 6 p.m.', sourceIds: ['topic-openai-hours-1'], unsupported: false });
  }) as typeof fetch;
  const result = await answerTopicQuestion(topic, 'When do stores close?', { provider: 'openai', apiKey: 'test-openai-key', fetcher });
  assert.equal(result.mode, 'openai');
  assert.ok(result.sources.every(source => source.title === topic.name));
  const failure = await answerTopicQuestion(topic, 'When do stores close?', {
    provider: 'openai', apiKey: 'test-private-key', fetcher: (async () => new Response('private-upstream-text', { status: 503 })) as typeof fetch,
  });
  assert.equal(failure.mode, 'retrieval');
  assert.match(failure.answer, /stores close at 6 p\.m\./);
  assert.doesNotMatch(JSON.stringify(failure), /test-private-key|private-upstream-text|60-hour|overtime/);
});
