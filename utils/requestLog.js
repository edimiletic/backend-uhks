const { randomUUID } = require('crypto');

const isHealth = (req) => req.method === 'GET' && (req.path === '/health' || req.originalUrl === '/health');

const requestLogLine = ({ requestId, method, path, status, ms }) =>
  JSON.stringify({
    level: status >= 500 ? 'error' : 'info',
    requestId,
    method,
    path,
    status,
    ms
  });

const requestLogger = (req, res, next) => {
  req.requestId = String(req.headers['x-request-id'] || randomUUID());
  res.setHeader('X-Request-Id', req.requestId);
  const started = Date.now();

  res.on('finish', () => {
    if (isHealth(req)) {
      return;
    }
    const line = requestLogLine({
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      ms: Date.now() - started
    });
    if (res.statusCode >= 500) {
      console.error(line);
    } else {
      console.log(line);
    }
  });

  next();
};

const errorHandler = (err, req, res, _next) => {
  const status = Number(err.statusCode || err.status) || 500;
  if (res.headersSent) {
    return;
  }
  const message = status >= 500 ? 'Server error' : (err.message || 'Request failed');
  res.status(status).json({ error: message, requestId: req.requestId });
};

module.exports = { requestLogger, errorHandler, requestLogLine };
