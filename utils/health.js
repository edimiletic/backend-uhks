const mongoose = require('mongoose');

const healthStatus = (connection = mongoose.connection) => ({
  ok: connection.readyState === 1
});

const sendHealth = (_req, res) => {
  const body = healthStatus();
  res.status(body.ok ? 200 : 503).json(body);
};

module.exports = { healthStatus, sendHealth };
