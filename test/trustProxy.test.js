const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { trustProxyHops, configureTrustProxy } = require('../utils/trustProxy');

describe('trustProxy', () => {
  const previous = {};

  beforeEach(() => {
    ['NODE_ENV', 'TRUST_PROXY'].forEach((key) => {
      previous[key] = process.env[key];
    });
    delete process.env.TRUST_PROXY;
  });

  afterEach(() => {
    ['NODE_ENV', 'TRUST_PROXY'].forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  });

  it('lokalno ne vjeruje proxyju', () => {
    process.env.NODE_ENV = 'development';
    assert.equal(trustProxyHops(), 0);
  });

  it('u produkciji vjeruje jednom hopu (Railway)', () => {
    process.env.NODE_ENV = 'production';
    assert.equal(trustProxyHops(), 1);
  });

  it('TRUST_PROXY prepisuje default', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '2';
    assert.equal(trustProxyHops(), 2);
  });

  it('TRUST_PROXY=0 gasi proxy i u produkciji', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '0';
    assert.equal(trustProxyHops(), 0);
  });

  it('postavlja app.set kad ima hopova', () => {
    process.env.NODE_ENV = 'production';
    const settings = {};
    const app = {
      set(key, value) {
        settings[key] = value;
      }
    };
    configureTrustProxy(app);
    assert.equal(settings['trust proxy'], 1);
  });
});
