export const DEFAULT_PRIORITIES = Object.freeze({
  cheaper: true,
  smarter: false,
  faster: false,
});

const KEYS = Object.keys(DEFAULT_PRIORITIES);
const finite = value => value != null && Number.isFinite(Number(value));
const positive = value => finite(value) && Number(value) > 0;

export function normalizePriorities(value) {
  const priorities = Object.fromEntries(KEYS.map(key => [key, value?.[key] === true]));
  return KEYS.some(key => priorities[key]) ? priorities : { ...DEFAULT_PRIORITIES };
}

export function availablePriorities(rows, value) {
  const requested = normalizePriorities(value);
  const unavailablePreferences = [];
  const priorities = { ...requested };
  if (requested.smarter && !rows.some(row => finite(row.quality))) {
    priorities.smarter = false;
    unavailablePreferences.push('smarter');
  }
  if (requested.faster && !rows.some(row => positive(row.latency) || positive(row.throughput))) {
    priorities.faster = false;
    unavailablePreferences.push('faster');
  }
  // Keep a single selected choice strict: there is no honest ranking without its evidence.
  if (!Object.values(priorities).some(Boolean)) return { priorities: requested, unavailablePreferences };
  return { priorities, unavailablePreferences };
}

function normalized(value, values, lowerIsBetter = false) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  const score = (Number(value) - min) / (max - min);
  return lowerIsBetter ? 1 - score : score;
}

export function rankByPreferences(rows, value) {
  const priorities = normalizePriorities(value);
  const selected = KEYS.filter(key => priorities[key]);
  const eligible = rows.filter(row => selected.every(key => {
    if (key === 'cheaper') return finite(row.cost) && Number(row.cost) >= 0;
    if (key === 'smarter') return finite(row.quality);
    return positive(row.latency) || positive(row.throughput);
  }));
  if (!eligible.length) return [];

  const costs = eligible.map(row => Number(row.cost));
  const qualities = eligible.map(row => Number(row.quality)).filter(Number.isFinite);
  const latencies = eligible.map(row => Number(row.latency)).filter(value => value > 0);
  const throughputs = eligible.map(row => Number(row.throughput)).filter(value => value > 0);

  return eligible.map(row => {
    const breakdown = {};
    if (priorities.cheaper) breakdown.cheaper = normalized(row.cost, costs, true);
    if (priorities.smarter) breakdown.smarter = normalized(row.quality, qualities);
    if (priorities.faster) {
      const speed = [];
      if (positive(row.latency)) speed.push(normalized(row.latency, latencies, true));
      if (positive(row.throughput)) speed.push(normalized(row.throughput, throughputs));
      breakdown.faster = speed.reduce((sum, score) => sum + score, 0) / speed.length;
    }
    return {
      ...row,
      matchedPreferences: selected,
      preferenceBreakdown: breakdown,
      preferenceScore: selected.reduce((sum, key) => sum + breakdown[key], 0) / selected.length,
    };
  }).sort((a, b) => b.preferenceScore - a.preferenceScore ||
    a.cost - b.cost || a.popularityRank - b.popularityRank || a.id.localeCompare(b.id));
}
