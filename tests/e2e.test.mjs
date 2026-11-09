import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const PORT = 3055;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const APP_KEY = 'test-secret-key-xyz';
const SESSION_SECRET = 'e2e-test-session-secret-min-32-chars-long!';

let serverProcess;

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(`${url}/api/health`);
        if (res.status === 200) {
          return resolve(true);
        }
      } catch {
        // Retry
      }
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Server did not start in time'));
      }
      setTimeout(check, 400);
    };
    check();
  });
}

test('E2E Server Integration Test', async (t) => {
  // Start server
  serverProcess = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      APP_ACCESS_KEY: APP_KEY,
      SESSION_SECRET,
    },
    stdio: 'ignore',
  });

  t.after(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  await waitForServer(BASE_URL);

  await t.test('Health check endpoint returns status and model info', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.service, 'chat-technical-assistant');
    assert.strictEqual(data.configured.accessKeySet, true);
    assert.ok(data.model);
    assert.strictEqual(data.database.status, 'ok');
  });

  await t.test('Unauthenticated user is redirected to /login', async () => {
    const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location?.includes('/login'));
  });

  await t.test('Invalid access key returns 401 and redirectUrl to ugandhar.in', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: 'wrong-key' }),
    });

    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.redirectUrl, 'https://ugandhar.in');
  });

  await t.test('Valid access key authenticates and sets session cookie', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessKey: APP_KEY }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    assert.ok(setCookie.includes('chat_session='));
    assert.ok(setCookie.includes('HttpOnly'));

    // Extract cookie value for subsequent authenticated calls
    const sessionCookie = setCookie.split(';')[0];

    // Verify authenticated conversation listing
    const convRes = await fetch(`${BASE_URL}/api/conversations`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(convRes.status, 200);
    const convData = await convRes.json();
    assert.ok(Array.isArray(convData.conversations));

    // Verify creating conversation
    const createRes = await fetch(`${BASE_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        title: 'PostgreSQL Window Function Query',
        mode: 'answer_only',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    assert.strictEqual(createData.conversation.title, 'PostgreSQL Window Function Query');

    // Clean up created conversation
    const delRes = await fetch(`${BASE_URL}/api/conversations/${createData.conversation.id}`, {
      method: 'DELETE',
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(delRes.status, 200);
  });
});
