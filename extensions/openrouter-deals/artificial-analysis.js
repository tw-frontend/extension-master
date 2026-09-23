const metric = value => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const cleanText = (value, limit = 160) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;

export function normalizeArtificialAnalysis(payload, now = new Date()) {
  if (!payload || payload.schema !== 1 || payload.source !== 'Artificial Analysis' ||
      !payload.models || typeof payload.models !== 'object' || Array.isArray(payload.models)) {
    throw new Error('Invalid Artificial Analysis snapshot');
  }
  const byModel = {};
  for (const [id, row] of Object.entries(payload.models)) {
    if (!/^[a-z0-9_.~-]+\/[a-z0-9_.:~-]+$/i.test(id) || !row || typeof row !== 'object') continue;
    const intelligence = metric(row.intelligence);
    const speed = metric(row.speed);
    const costPerTask = metric(row.costPerTask);
    if (intelligence == null || speed == null || costPerTask == null) continue;
    byModel[id] = {
      ...(cleanText(row.name) ? { name: cleanText(row.name) } : {}),
      intelligence,
      speed,
      costPerTask,
    };
  }
  return {
    byModel,
    asOf: cleanText(payload.generatedAt, 40),
    intelligenceIndexVersion: metric(payload.intelligenceIndexVersion),
    sourceUrl: payload.sourceUrl === 'https://artificialanalysis.ai/' ? payload.sourceUrl : null,
    attribution: cleanText(payload.attribution),
    fetchedAt: +now,
  };
}

export function analysisFor(model, snapshot) {
  if (!model) return null;
  return snapshot?.byModel?.[model.id] ??
    (model.canonical_slug ? snapshot?.byModel?.[model.canonical_slug] : null) ?? null;
}

export function artificialAnalysisFresh(snapshot, now = new Date()) {
  if (!snapshot || !Object.keys(snapshot.byModel ?? {}).length) return false;
  const asOf = Date.parse(snapshot.asOf);
  return Number.isFinite(asOf) && +now >= asOf - 5 * 60 * 1000 && +now - asOf < 72 * 60 * 60 * 1000;
}
