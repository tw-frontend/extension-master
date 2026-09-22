const validList = rows => Array.isArray(rows) && rows.every(row =>
  row && typeof row.id === 'string');

export function normalizeSpeedRanks(models, latencyRows, throughputRows) {
  const allowed = new Set(models.map(model => model.id));
  const byModel = {};
  for (const rows of [latencyRows, throughputRows]) {
    if (!validList(rows) || rows.length < 2) continue;
    const key = rows === latencyRows ? 'latency' : 'throughput';
    rows.forEach((row, index) => {
      if (!allowed.has(row.id)) return;
      (byModel[row.id] ??= {})[key] = 1 - index / (rows.length - 1);
    });
  }
  for (const [id, scores] of Object.entries(byModel)) {
    const values = Object.values(scores);
    byModel[id] = values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return { byModel };
}

export function speedFor(model, ranks) {
  const score = ranks?.byModel?.[model?.id];
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1
    ? score : null;
}
