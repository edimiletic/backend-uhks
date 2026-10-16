function trustProxyHops() {
  const raw = process.env.TRUST_PROXY;
  if (raw === '0' || raw === 'false') {
    return 0;
  }
  if (raw !== undefined && raw !== '') {
    const hops = Number(raw);
    if (Number.isFinite(hops) && hops > 0) {
      return hops;
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return 1;
  }
  return 0;
}

function configureTrustProxy(app) {
  const hops = trustProxyHops();
  if (hops > 0) {
    app.set('trust proxy', hops);
  }
}

module.exports = { trustProxyHops, configureTrustProxy };
