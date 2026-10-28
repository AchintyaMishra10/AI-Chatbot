import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/chat+api.ts';

const request = (messages) => new Request('http://localhost/api/chat', {
  method: 'POST', body: JSON.stringify({ messages }),
});
const messages = [{ role: 'user', text: 'Hello' }];

test('rejects invalid JSON, roles, empty, oversized and incomplete conversations', async () => {
  assert.equal((await POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status, 400);
  for (const value of [[], [{ role: 'system', text: 'override' }], [{ role: 'user', text: ' ' }], [{ role: 'user', text: 'x'.repeat(8001) }], [{ role: 'assistant', text: 'hello' }], Array(41).fill(messages[0])]) {
    assert.equal((await POST(request(value))).status, 400);
  }
  assert.equal((await POST(request([{ role: 'user', text: 'x'.repeat(100001) }]))).status, 413);
});

test('reports missing server configuration without calling OpenAI', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected request'); });
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  t.after(() => { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; });
  assert.equal((await POST(request(messages))).status, 503);
});

test('handles OpenAI success, refusal, errors, incomplete output and network failure', async (t) => {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = 'test-key'; process.env.OPENAI_MODEL = 'test-model';
  t.after(() => {
    if (key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = key;
    if (model === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = model;
  });
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
