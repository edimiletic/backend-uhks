const { ALL_COMPETITIONS, STORED_COMPETITIONS, canonicalCompetition } = require('../config/roles');

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const REQUIRED = ['homeTeam', 'awayTeam', 'date', 'time', 'venue', 'competition'];

const filled = (value) => String(value ?? '').trim() !== '';

const isAllowedCompetition = (name, allowLegacy) => {
  const trimmed = String(name).trim();
  if (ALL_COMPETITIONS.includes(canonicalCompetition(trimmed))) {
    return true;
  }
  return allowLegacy && STORED_COMPETITIONS.includes(trimmed);
};

const gamePayloadError = (body = {}, {
  requireAll = true,
  allowPastDate = false,
  allowLegacyCompetition = false
} = {}) => {
  if (requireAll) {
    const missing = REQUIRED.some((field) => !filled(body[field]));
    if (missing) {
      return 'Missing required fields: homeTeam, awayTeam, date, time, venue, competition';
    }
  }

  if (filled(body.homeTeam) && filled(body.awayTeam)
    && String(body.homeTeam).toLowerCase().trim() === String(body.awayTeam).toLowerCase().trim()) {
    return 'Home team and away team cannot be the same';
  }

  if (filled(body.date)) {
    const gameDate = new Date(body.date);
    if (Number.isNaN(gameDate.getTime())) {
      return 'Invalid date format';
    }
    if (!allowPastDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const day = new Date(gameDate);
      day.setHours(0, 0, 0, 0);
      if (day < today) {
        return 'Game date cannot be in the past';
      }
    }
  }

  if (filled(body.time) && !TIME_RE.test(String(body.time).trim())) {
    return 'Invalid time format. Use HH:MM format';
  }

  if (filled(body.competition) && !isAllowedCompetition(body.competition, allowLegacyCompetition)) {
    return 'Invalid competition';
  }

  return null;
};

module.exports = { gamePayloadError };
