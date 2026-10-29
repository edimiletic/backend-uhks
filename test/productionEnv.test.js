const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { productionEnvErrors, assertProductionEnv } = require('../utils/productionEnv');

const validProduction = {
  NODE_ENV: 'production',
  JWT_SECRET: 'a-long-random-production-secret',
  MONGO_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/uhks',
  CORS_ORIGIN: 'https://app.example.com',
  FRONTEND_URL: 'https://app.example.com'
};

describe('productionEnv', () => {
  it('lokalno ne dira ništa', () => {
    assert.deepEqual(productionEnvErrors({ NODE_ENV: 'development' }), []);
    assert.deepEqual(productionEnvErrors({}), []);
  });

  it('prolazi kad je Railway checklist ispunjen', () => {
    assert.deepEqual(productionEnvErrors(validProduction), []);
    assert.doesNotThrow(() => assertProductionEnv(validProduction));
  });

  it('odbija slabi JWT, localhost CORS i Mailtrap delay', () => {
    const errors = productionEnvErrors({
      NODE_ENV: 'production',
      JWT_SECRET: 'change-me',
      CORS_ORIGIN: 'http://localhost:4200',
      FRONTEND_URL: 'http://localhost:4200/',
      COOKIE_SECURE: 'false',
      COOKIE_SAMESITE: 'lax',
      SMTP_MIN_INTERVAL_MS: '1100',
      SMTP_HOST: 'sandbox.smtp.mailtrap.io'
    });

    assert.ok(errors.some((line) => line.includes('JWT_SECRET')));
    assert.ok(errors.some((line) => line.includes('MONGO_URI')));
    assert.ok(errors.some((line) => line.includes('CORS_ORIGIN')));
    assert.ok(errors.some((line) => line.includes('FRONTEND_URL')));
    assert.ok(errors.some((line) => line.includes('COOKIE_SECURE')));
    assert.ok(errors.some((line) => line.includes('COOKIE_SAMESITE')));
    assert.ok(errors.some((line) => line.includes('SMTP_MIN_INTERVAL_MS')));
    assert.ok(errors.some((line) => line.includes('MAIL_FROM')));
    assert.throws(() => assertProductionEnv({ NODE_ENV: 'production' }), /incomplete/);
  });
});
