export const DEFAULT_PRIORITIES = Object.freeze({
  cheaper: true,
  smarter: false,
  faster: false,
});

const KEYS = Object.keys(DEFAULT_PRIORITIES);
const finite = value => value != null && Number.isFinite(Number(value));
const positive = value => finite(value) && Number(value) > 0;
const cheaperValue = row => finite(row.analysis?.costPerTask) ? Number(row.analysis.costPerTask) : Number(row.cost);
const smarterValue = row => finite(row.analysis?.intelligence) ? Number(row.analysis.intelligence)
  : finite(row.quality) ? Number(row.quality) : null;

export function normalizePriorities(value) {
  const priorities = Object.fromEntries(KEYS.map(key => [key, value?.[key] === true]));
  return KEYS.some(key => priorities[key]) ? priorities : { ...DEFAULT_PRIORITIES };
}

export function availablePriorities(rows, value) {
  const requested = normalizePriorities(value);
  const unavailablePreferences = [];
  const priorities = { ...requested };
  if (requested.smarter && !rows.some(row => finite(row.analysis?.intelligence) || finite(row.quality))) {
    priorities.smarter = false;
    unavailablePreferences.push('smarter');
  }
  if (requested.faster && !rows.some(row => positive(row.analysis?.speed) || finite(row.speedScore) || positive(row.latency) || positive(row.throughput))) {
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
    if (key === 'cheaper') return finite(cheaperValue(row)) && cheaperValue(row) >= 0;
    if (key === 'smarter') return finite(smarterValue(row));
    return positive(row.analysis?.speed) || finite(row.speedScore) || positive(row.latency) || positive(row.throughput);
  }));
  if (!eligible.length) return [];

  const costs = eligible.map(cheaperValue);
  const qualities = eligible.map(smarterValue).filter(Number.isFinite);
  const analysisSpeeds = eligible.map(row => Number(row.analysis?.speed)).filter(value => value >= 0);
  const latencies = eligible.map(row => Number(row.latency)).filter(value => value > 0);
  const throughputs = eligible.map(row => Number(row.throughput)).filter(value => value > 0);

  return eligible.map(row => {
    const breakdown = {};
    if (priorities.cheaper) breakdown.cheaper = normalized(cheaperValue(row), costs, true);
    if (priorities.smarter) breakdown.smarter = normalized(smarterValue(row), qualities);
    if (priorities.faster) {
      const speed = [];
      if (positive(row.latency)) speed.push(normalized(row.latency, latencies, true));
      if (positive(row.throughput)) speed.push(normalized(row.throughput, throughputs));
      breakdown.faster = positive(row.analysis?.speed)
        ? normalized(row.analysis.speed, analysisSpeeds)
        : finite(row.speedScore)
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
    cheaperValue(a) - cheaperValue(b) || a.popularityRank - b.popularityRank || a.id.localeCompare(b.id));
}

const BALANCE_WEIGHTS = { smarter: 1, faster: 1, cheaper: 1 };

export function rankBalanced(rows) {
  const { priorities, unavailablePreferences } = availablePriorities(rows,
    { cheaper: true, smarter: true, faster: true });
  const ranked = rankByPreferences(rows, priorities);
  if (!ranked.length) return { ranked, best: null, unavailablePreferences };

  const weightSum = Object.entries(BALANCE_WEIGHTS).reduce((sum, [key, weight]) =>
    sum + (priorities[key] ? weight : 0), 0);
  const balanced = ranked.map(row => ({
    ...row,
    preferenceScore: Object.entries(BALANCE_WEIGHTS).reduce((sum, [key, weight]) =>
      sum + (priorities[key] ? row.preferenceBreakdown[key] * weight : 0), 0) / weightSum,
  })).sort((a, b) => b.preferenceScore - a.preferenceScore ||
    cheaperValue(a) - cheaperValue(b) || a.popularityRank - b.popularityRank || a.id.localeCompare(b.id));
  return { ranked: balanced, best: balanced[0],
    unavailablePreferences };
}
