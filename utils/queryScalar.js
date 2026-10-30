const scalarString = (value, maxLen = 200) => {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }
  return String(value).trim().slice(0, maxLen);
};

const escapeRegex = (value) =>
  scalarString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsRegex = (value) => {
  const escaped = escapeRegex(value);
  if (!escaped) {
    return null;
  }
  return new RegExp(escaped, 'i');
};

module.exports = { scalarString, escapeRegex, containsRegex };
