const helmet = require('helmet');

const HSTS_MAX_AGE = 15552000;

function helmetOptions() {
  return {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: process.env.NODE_ENV === 'production'
      ? { maxAge: HSTS_MAX_AGE, includeSubDomains: true }
      : false
  };
}

function configureSecurityHeaders(app) {
  app.use(helmet(helmetOptions()));
}

module.exports = { HSTS_MAX_AGE, helmetOptions, configureSecurityHeaders };
