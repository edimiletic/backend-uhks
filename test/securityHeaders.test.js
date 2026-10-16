const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const {
  HSTS_MAX_AGE,
  helmetOptions,
  configureSecurityHeaders
} = require('../utils/securityHeaders');

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

function healthApp() {
  const app = express();
  configureSecurityHeaders(app);
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('securityHeaders', () => {
  const previous = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  });

  it('lokalno ne šalje HSTS, CSP ni COEP', () => {
    process.env.NODE_ENV = 'development';
    assert.deepEqual(helmetOptions(), {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: false
    });
  });

  it('u produkciji pali HSTS na 180 dana', () => {
    process.env.NODE_ENV = 'production';
    assert.deepEqual(helmetOptions(), {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: { maxAge: HSTS_MAX_AGE, includeSubDomains: true }
    });
  });

  it('GET /health ima nosniff i nema X-Powered-By', async () => {
    const { server, url } = await listen(healthApp());
    try {
      const response = await fetch(`${url}/health`, {
        headers: { Connection: 'close' }
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.equal(response.headers.get('content-security-policy'), null);
      assert.equal(response.headers.get('cross-origin-embedder-policy'), null);
      assert.equal(response.headers.get('strict-transport-security'), null);
    } finally {
      await close(server);
    }
  });

  it('u produkciji /health šalje Strict-Transport-Security', async () => {
    process.env.NODE_ENV = 'production';
    const { server, url } = await listen(healthApp());
    try {
      const response = await fetch(`${url}/health`, {
        headers: { Connection: 'close' }
      });
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('strict-transport-security'),
        `max-age=${HSTS_MAX_AGE}; includeSubDomains`
      );
    } finally {
      await close(server);
    }
  });
});
