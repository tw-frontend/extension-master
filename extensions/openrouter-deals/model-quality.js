const finiteScore = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? number : null;
};

const rounded = value => Math.round(value * 10) / 10;

export function normalizeBenchmarks(payload, now = new Date()) {
  if (!payload || !Array.isArray(payload.data)) {
    throw new Error('Invalid benchmark response');
  }
  const byModel = {};
  for (const row of payload.data) {
    if (!row || row.source !== 'artificial-analysis' ||
        typeof row.model_permaslug !== 'string' || !row.model_permaslug.trim()) continue;
    const scores = {};
    const coding = finiteScore(row.coding_index);
    const intelligence = finiteScore(row.intelligence_index);
    const agentic = finiteScore(row.agentic_index);
    if (coding != null) scores.coding = coding;
    if (intelligence != null) scores.intelligence = intelligence;
    if (agentic != null) scores.agentic = agentic;
    if (Object.keys(scores).length) byModel[row.model_permaslug] = scores;
  }
  return {
    byModel,
    asOf: typeof payload.meta?.as_of === 'string' ? payload.meta.as_of : null,
    citation: typeof payload.meta?.citation === 'string' ? payload.meta.citation : null,
    fetchedAt: +now,
  };
}

export function benchmarkFor(model, benchmarks) {
  if (!benchmarks?.byModel || !model) return null;
  return benchmarks.byModel[model.id] ??
    (model.canonical_slug ? benchmarks.byModel[model.canonical_slug] : null) ?? null;
}

const PURPOSES = {
  coding: { primary: 'coding', weights: { coding: .6, agentic: .25, intelligence: .15 } },
  planning: { primary: 'intelligence', weights: { intelligence: .55, agentic: .35, coding: .1 } },
  agentic: { primary: 'agentic', weights: { agentic: .6, coding: .25, intelligence: .15 } },
};

export function scorePurpose(scores, purpose) {
  const config = PURPOSES[purpose];
  if (!config || finiteScore(scores?.[config.primary]) == null) return null;
  let weighted = 0, weight = 0;
  for (const [key, factor] of Object.entries(config.weights)) {
    const score = finiteScore(scores?.[key]);
    if (score == null) continue;
    weighted += score * factor;
    weight += factor;
  }
  return weight ? rounded(weighted / weight) : null;
}

export function overallScore(scores) {
  const values = ['coding', 'intelligence', 'agentic']
    .map(key => finiteScore(scores?.[key])).filter(value => value != null);
  return values.length ? rounded(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}
