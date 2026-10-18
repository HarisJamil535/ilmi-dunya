const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

test('network recovery retries safe reads once, never repeats writes, and ignores cancellation', async () => {
  global.window = new EventTarget();
  window.location = { pathname: '/' };
  global.localStorage = { getItem: () => null };
  Object.defineProperty(global, 'navigator', { value: { onLine: true }, configurable: true });
  let notices = 0;
  window.addEventListener('app-network-error', () => notices++);
  const source = fs.readFileSync(require.resolve('../src/api/axios.js'), 'utf8')
    .replace('import axios from "axios";', `import axios from ${JSON.stringify(pathToFileURL(require.resolve('axios')).href)};`)
    .replace('import { notifyStudentAuthChanged } from "../auth/authEvents";', 'const notifyStudentAuthChanged = () => {};')
    .replace('import.meta.env.VITE_API_URL', 'undefined');
  const { default: api } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const fail = config => { throw Object.assign(new Error('Network Error'), { config, code: 'ERR_NETWORK' }); };
  let calls = 0;
  api.defaults.adapter = async config => {
    calls++;
    assert.equal(config.timeout, 45000);
    if (calls === 1) fail(config);
    return { data: {}, status: 200, config };
  };
  await api.get('/study-options');
  assert.equal(calls, 2);
  assert.equal(notices, 0);
  calls = 0;
  api.defaults.adapter = async config => { calls++; return fail(config); };
  await assert.rejects(api.post('/attempts/test/submit', {}));
  assert.equal(calls, 1);
  assert.equal(notices, 1);
  calls = 0;
  await assert.rejects(api.get('/attempts/test'));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(api.get('/study-options'));
  assert.equal(calls, 2);
  const before = notices;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.get('/study-options', { signal: controller.signal }));
  assert.equal(notices, before);
  navigator.onLine = false;
  calls = 0;
  await assert.rejects(api.get('/study-options'));
  assert.equal(calls, 1);
});
