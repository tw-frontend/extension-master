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
  if (requested.faster && !rows.some(row => finite(row.speedScore) || positive(row.latency) || positive(row.throughput))) {
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
    return finite(row.speedScore) || positive(row.latency) || positive(row.throughput);
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
      breakdown.faster = finite(row.speedScore)
        ? Number(row.speedScore)
        : speed.reduce((sum, score) => sum + score, 0) / speed.length;
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

const BALANCE_WEIGHTS = { smarter: 0.5, faster: 0.3, cheaper: 0.2 };
const quantile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position), high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};

export function rankBalanced(rows) {
  const { priorities, unavailablePreferences } = availablePriorities(rows,
    { cheaper: true, smarter: true, faster: true });
  const ranked = rankByPreferences(rows, priorities);
  if (!ranked.length) return { ranked, best: null, unavailablePreferences };

  // Look for strong, usable models first, then rule out the priciest quartile.
  const qualityFloor = priorities.smarter ? quantile(ranked.map(row => row.quality), 0.5) : -Infinity;
  const strong = ranked.filter(row => row.quality == null || row.quality >= qualityFloor);
  const speedFloor = priorities.faster
    ? quantile(ranked.map(row => row.preferenceBreakdown.faster), 0.25) : -Infinity;
  const usable = strong.filter(row => !priorities.faster || row.preferenceBreakdown.faster >= speedFloor);
  const priceCeiling = quantile(usable.map(row => row.cost), 0.75);
  const weightSum = Object.entries(BALANCE_WEIGHTS).reduce((sum, [key, weight]) =>
    sum + (priorities[key] ? weight : 0), 0);
  const balanced = ranked.map(row => ({
    ...row,
    preferenceScore: Object.entries(BALANCE_WEIGHTS).reduce((sum, [key, weight]) =>
      sum + (priorities[key] ? row.preferenceBreakdown[key] * weight : 0), 0) / weightSum,
  })).sort((a, b) => b.preferenceScore - a.preferenceScore ||
    a.cost - b.cost || a.popularityRank - b.popularityRank || a.id.localeCompare(b.id));
  const affordableIds = new Set(usable.filter(row => row.cost <= priceCeiling).map(row => row.id));
  return { ranked: balanced, best: balanced.find(row => affordableIds.has(row.id)) ?? balanced[0],
    unavailablePreferences };
}
