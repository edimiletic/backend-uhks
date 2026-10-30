const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { requestLogger, errorHandler } = require('../utils/requestLog');
const { parseAllowedOrigins, rejectDisallowedOrigin } = require('../utils/corsAllowlist');

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
  instance.use(requestLogger);
  instance.use(rejectDisallowedOrigin(['http://localhost:4200']));
  instance.get('/health', (_req, res) => res.json({ ok: true }));
  instance.get('/ok', (_req, res) => res.json({ ok: true }));
  instance.post('/ok', (_req, res) => res.json({ ok: true }));
  instance.get('/boom', () => {
    throw new Error('secret stack');
  });
  instance.use(errorHandler);
  return instance;
}

describe('requestLog', () => {
  it('logira JSON, 5xx ide na error bez interne poruke, health šuti', async () => {
    const logs = [];
    const errors = [];
    const log = console.log;
    const err = console.error;
    console.log = (line) => logs.push(line);
    console.error = (line) => errors.push(line);

    const { server, url } = await listen(app());
    try {
      const ok = await fetch(`${url}/ok`, { headers: { Connection: 'close' } });
      assert.equal(ok.status, 200);
      assert.match(ok.headers.get('x-request-id') || '', /./);
      const info = JSON.parse(logs.at(-1));
      assert.equal(info.level, 'info');
      assert.equal(info.status, 200);
      assert.equal(info.path, '/ok');

      const boom = await fetch(`${url}/boom`, { headers: { Connection: 'close' } });
      assert.equal(boom.status, 500);
      const body = await boom.json();
      assert.equal(body.error, 'Server error');
      assert.ok(body.requestId);
      assert.ok(errors.some((line) => JSON.parse(line).status === 500));

      const before = logs.length + errors.length;
      const health = await fetch(`${url}/health`, { headers: { Connection: 'close' } });
      assert.equal(health.status, 200);
      assert.equal(logs.length + errors.length, before);
    } finally {
      console.log = log;
      console.error = err;
      await close(server);
    }
  });

  it('odbija mutating Referer kad ima kolačić', async () => {
    const log = console.log;
    console.log = () => {};
    const { server, url } = await listen(app());
    try {
      const response = await fetch(`${url}/ok`, {
        method: 'POST',
        headers: {
          Cookie: 'uhks_session=x',
          Referer: 'https://evil.example/page',
          Connection: 'close'
        }
      });
      assert.equal(response.status, 403);
    } finally {
      console.log = log;
      await close(server);
    }
  });

  it('odbija mutating bez Origin i Referer kad ima kolačić', async () => {
    const log = console.log;
    console.log = () => {};
    const { server, url } = await listen(app());
    try {
      const response = await fetch(`${url}/ok`, {
        method: 'POST',
        headers: {
          Cookie: 'uhks_session=x',
          Connection: 'close'
        }
      });
      assert.equal(response.status, 403);
    } finally {
      console.log = log;
      await close(server);
    }
  });

  it('odbija tuđi Origin s JSON 403', async () => {
    const log = console.log;
    console.log = () => {};
    const { server, url } = await listen(app());
    try {
      const response = await fetch(`${url}/ok`, {
        headers: { Origin: 'https://evil.example', Connection: 'close' }
      });
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'Not allowed by CORS' });
    } finally {
      console.log = log;
      await close(server);
    }
  });

  it('čita CORS_ORIGIN zarezom', () => {
    assert.deepEqual(
      parseAllowedOrigins({ CORS_ORIGIN: 'https://app.example, https://admin.example' }),
      ['https://app.example', 'https://admin.example']
    );
  });
});
