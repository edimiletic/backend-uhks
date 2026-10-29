const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
};

const parsePagination = (query = {}, { defaultLimit = DEFAULT_LIMIT, maxLimit = MAX_LIMIT } = {}) => {
  const page = toPositiveInt(query.page, 1);
  const limit = Math.min(maxLimit, toPositiveInt(query.limit, defaultLimit));
  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, parsePagination };
