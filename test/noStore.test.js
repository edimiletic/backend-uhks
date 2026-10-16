const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const noStore = require('../middleware/noStore');

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
  instance.post('/login', noStore, (_req, res) => {
    res.status(429).json({ error: 'Previše neuspjelih prijava. Pokušaj ponovo za 15 minuta.' });
  });
  instance.post('/logout', noStore, (_req, res) => {
    res.json({ message: 'Logged out' });
  });
  instance.get('/me', noStore, (_req, res) => {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
  });
  instance.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  return instance;
}

async function get(url, path, method = 'GET') {
  return fetch(`${url}${path}`, {
    method,
    headers: { Connection: 'close' }
  });
}

describe('noStore', () => {
  it('login, /me i logout ne smiju ići u cache, i na 401/429', async () => {
    const { server, url } = await listen(app());
    try {
      const login = await get(url, '/login', 'POST');
      assert.equal(login.status, 429);
      assert.equal(login.headers.get('cache-control'), 'no-store');

      const me = await get(url, '/me');
      assert.equal(me.status, 401);
      assert.equal(me.headers.get('cache-control'), 'no-store');

      const logout = await get(url, '/logout', 'POST');
      assert.equal(logout.status, 200);
      assert.equal(logout.headers.get('cache-control'), 'no-store');
    } finally {
      await close(server);
    }
  });

  it('ne dira javni /health', async () => {
    const { server, url } = await listen(app());
    try {
      const health = await get(url, '/health');
      assert.equal(health.status, 200);
      assert.notEqual(health.headers.get('cache-control'), 'no-store');
    } finally {
      await close(server);
    }
  });
});
