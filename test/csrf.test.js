const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { csrfProtection, CSRF_COOKIE } = require('../utils/csrf');
const { COOKIE_NAME } = require('../utils/sessionCookie');

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(csrfProtection);
  instance.post('/api/login', (_req, res) => res.json({ ok: true }));
  instance.post('/ok', (_req, res) => res.json({ ok: true }));
  return instance;
}

describe('csrf', () => {
  it('login bez sesije ne traži token, mutating sa sesijom da', async () => {
    const { server, url } = await listen(app());
    try {
      const login = await fetch(`${url}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: '{}'
      });
      assert.equal(login.status, 200);

      const missing = await fetch(`${url}/ok`, {
        method: 'POST',
        headers: {
          Cookie: `${COOKIE_NAME}=session`,
          Connection: 'close'
        }
      });
      assert.equal(missing.status, 403);
      assert.deepEqual(await missing.json(), { error: 'Nevažeći CSRF token.' });

      const ok = await fetch(`${url}/ok`, {
        method: 'POST',
        headers: {
          Cookie: `${COOKIE_NAME}=session; ${CSRF_COOKIE}=abc`,
          'X-CSRF-Token': 'abc',
          Connection: 'close'
        }
      });
      assert.equal(ok.status, 200);
    } finally {
      await close(server);
    }
  });
});
