function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

module.exports = noStore;
