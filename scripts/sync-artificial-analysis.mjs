#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const API = 'https://artificialanalysis.ai/api/v2/language/models';
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/artificial-analysis.json');
const ALLOWED_CREATORS = new Set(['openai', 'anthropic', 'z-ai', 'zai', 'xiaomi', 'alibaba', 'qwen', 'google', 'deepseek']);
const finite = value => value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

function creatorAllowed(row) {
  const slug = String(row?.model_creator?.slug ?? '').toLowerCase();
  const name = String(row?.model_creator?.name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ALLOWED_CREATORS.has(slug) || ALLOWED_CREATORS.has(name);
}

export function buildSnapshot(pages, now = new Date()) {
  if (!pages.length || pages.some(page => page?.tier !== 'commercial')) {
    throw new Error('Artificial Analysis Commercial API access is required for public redistribution');
  }
  const models = {};
  for (const page of pages) {
    for (const row of page.data ?? []) {
      const id = typeof row.openrouter_api_id === 'string' ? row.openrouter_api_id.trim() : '';
      if (!/^[a-z0-9_.~-]+\/[a-z0-9_.:~-]+$/i.test(id) || !creatorAllowed(row)) continue;
      const intelligence = finite(row.evaluations?.artificial_analysis_intelligence_index);
      const speed = finite(row.performance?.median_output_tokens_per_second);
      const costPerTask = finite(row.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost);
      if (intelligence == null || speed == null || costPerTask == null) continue;
      const candidate = {
        name: String(row.name ?? id).slice(0, 160),
        creator: String(row.model_creator?.name ?? '').slice(0, 80),
        artificialAnalysisSlug: String(row.slug ?? '').slice(0, 160),
        intelligence,
        speed,
        costPerTask,
      };
      const current = models[id];
      if (!current || candidate.intelligence > current.intelligence) models[id] = candidate;
    }
  }
  return {
    schema: 1,
    source: 'Artificial Analysis',
    sourceUrl: 'https://artificialanalysis.ai/',
    attribution: 'Data source: Artificial Analysis',
    generatedAt: now.toISOString(),
    intelligenceIndexVersion: finite(pages[0].intelligence_index_version),
    models: Object.fromEntries(Object.entries(models).sort(([left], [right]) => left.localeCompare(right))),
  };
}

export async function fetchPages(apiKey, fetcher = fetch) {
  if (!apiKey) throw new Error('ARTIFICIAL_ANALYSIS_API_KEY is required');
  const pages = [];
  for (let page = 1; page <= 50; page++) {
    const response = await fetcher(`${API}?page=${page}`, {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Artificial Analysis returned HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body?.data)) throw new Error('Artificial Analysis returned a malformed response');
    pages.push(body);
    if (!body.pagination?.has_more) return pages;
  }
  throw new Error('Artificial Analysis pagination exceeded 50 pages');
}

async function main() {
  const pages = await fetchPages(process.env.ARTIFICIAL_ANALYSIS_API_KEY);
  const snapshot = buildSnapshot(pages);
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${Object.keys(snapshot.models).length} exact OpenRouter model mappings to ${OUTPUT}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
