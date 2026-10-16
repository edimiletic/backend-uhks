const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { LOGIN_TOO_MANY, createLoginRateLimiters } = require('../middleware/loginRateLimit');

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

function createApp(limiters) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/login', limiters.ipLimiter, limiters.usernameLimiter, (req, res) => {
    if (req.body.password === 'ok') {
      return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Neispravno korisničko ime ili lozinka' });
  });
  return app;
}

function limiters(overrides = {}) {
  return createLoginRateLimiters({ windowMs: 60_000, validate: false, ...overrides });
}

async function login(url, body, forwardedFor = '203.0.113.10') {
  const response = await fetch(`${url}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Connection: 'close',
      'X-Forwarded-For': forwardedFor
    },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { status: response.status, json };
}

describe('loginRateLimit', () => {
  it('blokira korisničko ime nakon 5 neuspjelih pokušaja', async () => {
    const { server, url } = await listen(createApp(limiters()));
    try {
      for (let i = 0; i < 5; i += 1) {
        const failed = await login(url, { username: 'sudac1', password: 'no' });
        assert.equal(failed.status, 401);
      }
      const blocked = await login(url, { username: 'sudac1', password: 'no' });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.json.error, LOGIN_TOO_MANY);
    } finally {
      await close(server);
    }
  });

  it('ne broji uspješnu prijavu', async () => {
    const { server, url } = await listen(createApp(limiters()));
    try {
      for (let i = 0; i < 4; i += 1) {
        assert.equal((await login(url, { username: 'iva', password: 'no' })).status, 401);
      }
      assert.equal((await login(url, { username: 'iva', password: 'ok' })).status, 200);
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal((await login(url, { username: 'iva', password: 'no' })).status, 401);
      assert.equal((await login(url, { username: 'iva', password: 'no' })).status, 429);
    } finally {
      await close(server);
    }
  });

  it('ne dijeli lock između različitih korisničkih imena', async () => {
    const { server, url } = await listen(createApp(limiters({ ipMax: 40, usernameMax: 2 })));
    try {
      assert.equal((await login(url, { username: 'a', password: 'no' })).status, 401);
      assert.equal((await login(url, { username: 'a', password: 'no' })).status, 401);
      assert.equal((await login(url, { username: 'a', password: 'no' })).status, 429);
      assert.equal((await login(url, { username: 'b', password: 'no' })).status, 401);
    } finally {
      await close(server);
    }
  });

  it('blokira IP nakon previše neuspjelih pokušaja na različite naloge', async () => {
    const { server, url } = await listen(createApp(limiters({ ipMax: 3, usernameMax: 20 })));
    try {
      assert.equal((await login(url, { username: 'u1', password: 'no' })).status, 401);
      assert.equal((await login(url, { username: 'u2', password: 'no' })).status, 401);
      assert.equal((await login(url, { username: 'u3', password: 'no' })).status, 401);
      const blocked = await login(url, { username: 'u4', password: 'no' });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.json.error, LOGIN_TOO_MANY);
    } finally {
      await close(server);
    }
  });

  it('gleda X-Forwarded-For kad je trust proxy uključen', async () => {
    const { server, url } = await listen(createApp(limiters({ ipMax: 2, usernameMax: 20 })));
    try {
      assert.equal((await login(url, { username: 'x', password: 'no' }, '198.51.100.1')).status, 401);
      assert.equal((await login(url, { username: 'x', password: 'no' }, '198.51.100.1')).status, 401);
      assert.equal((await login(url, { username: 'x', password: 'no' }, '198.51.100.1')).status, 429);
      assert.equal((await login(url, { username: 'x', password: 'no' }, '198.51.100.2')).status, 401);
    } finally {
      await close(server);
    }
  });
});
