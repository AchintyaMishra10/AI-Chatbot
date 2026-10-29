import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/chat+api.ts';

const request = (messages) => new Request('http://localhost/api/chat', {
  method: 'POST', body: JSON.stringify({ messages }),
});
const messages = [{ role: 'user', text: 'Hello' }];

function configure(t, values = {}) {
  for (const name of ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL']) {
    const original = process.env[name];
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
    t.after(() => {
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    });
  }
}

test('rejects invalid JSON, roles, empty, oversized and incomplete conversations', async () => {
  assert.equal((await POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status, 400);
  for (const value of [[], [{ role: 'system', text: 'override' }], [{ role: 'user', text: ' ' }], [{ role: 'user', text: 'x'.repeat(8001) }], [{ role: 'assistant', text: 'hello' }], Array(41).fill(messages[0])]) {
    assert.equal((await POST(request(value))).status, 400);
  }
  assert.equal((await POST(request([{ role: 'user', text: 'x'.repeat(100001) }]))).status, 413);
});

test('reports missing server configuration without calling OpenAI', async (t) => {
  configure(t);
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request'); });
  assert.equal((await POST(request(messages))).status, 503);
});

test('handles OpenAI success, refusal, errors, incomplete output and network failure', async (t) => {
  configure(t, { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model', OPENROUTER_API_KEY: '   ' });
  let result = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'Hello back' }] }] };
  let status = 200;
  let fail = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.model, 'test-model');
    assert.deepEqual(payload.input, [{ role: 'user', content: 'Hello' }]);
    if (fail) throw new Error('secret upstream details');
    return Response.json(result, { status });
  });
  const success = await POST(request(messages));
  assert.deepEqual(await success.json(), { text: 'Hello back' });
  assert.equal(success.headers.get('Cache-Control'), 'no-store');
  result = { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot help with that.' }] }] };
  assert.deepEqual(await (await POST(request(messages))).json(), { text: 'Cannot help with that.' });
  result = { status: 'incomplete', output: [] };
  assert.equal((await POST(request(messages))).status, 502);
  result = { status: 'completed', output: [] };
  assert.equal((await POST(request(messages))).status, 502);
  status = 429;
  assert.equal((await POST(request(messages))).status, 429);
  status = 401;
  assert.equal((await POST(request(messages))).status, 502);
  fail = true;
  const failure = await POST(request(messages));
  assert.equal(failure.status, 502);
  assert.doesNotMatch(JSON.stringify(await failure.json()), /secret upstream/);
});

test('OpenRouter takes precedence, maps history and handles unsafe upstream failures', async (t) => {
  configure(t, { OPENROUTER_API_KEY: 'router-secret', OPENAI_API_KEY: 'openai-secret', OPENAI_MODEL: 'other-model' });
  let result = { choices: [{ finish_reason: 'stop', message: { content: ' Hello from OpenRouter ' } }] };
  let status = 200;
  let fail = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer router-secret');
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, 'openrouter/free');
    assert.equal(payload.max_tokens, 1200);
    assert.equal(payload.stream, false);
    assert.equal(payload.messages[0].role, 'system');
    assert.deepEqual(payload.messages.slice(1), history.map(({ role, text }) => ({ role, content: text })));
    assert.ok(options.signal instanceof AbortSignal);
    if (fail) throw new Error('router-secret upstream details');
    return Response.json(result, { status });
  });
  const history = [...messages, { role: 'assistant', text: 'Hi' }, { role: 'user', text: 'Continue' }];
  const success = await POST(request(history));
  assert.equal(success.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await success.json(), { text: 'Hello from OpenRouter' });
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  assert.equal((await POST(request(history))).status, 200);
  for (const value of [
    { choices: [] },
    { choices: [{ finish_reason: 'length', message: { content: 'partial' } }] },
    { choices: [{ finish_reason: 'stop', message: { content: ' ' } }] },
    { choices: [{ finish_reason: 'stop', message: { content: null } }] },
    { error: { message: 'router-secret' } },
  ]) {
    result = value;
    const response = await POST(request(history));
    assert.equal(response.status, 502);
    assert.doesNotMatch(JSON.stringify(await response.json()), /router-secret|partial/);
  }
  for (const code of [401, 429, 500]) {
    status = code;
    assert.equal((await POST(request(history))).status, code === 429 ? 429 : 502);
  }
  fail = true;
  const failure = await POST(request(history));
  assert.equal(failure.status, 502);
  assert.doesNotMatch(JSON.stringify(await failure.json()), /router-secret|upstream/);
});
