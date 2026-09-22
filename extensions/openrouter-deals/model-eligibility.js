const MAKERS = new Set(['openai', 'anthropic', 'z-ai', 'xiaomi', 'qwen', 'google', 'deepseek']);

export function isEligibleModel(model) {
  if (typeof model?.id !== 'string' || !model.pricing || model.alias_target || model.id.startsWith('~')) return false;
  const [maker, slug, extra] = model.id.split('/');
  return !extra && Boolean(slug) && MAKERS.has(maker);
}

function familyAndVersion(id) {
  const [maker, rawSlug] = id.split('/');
  const slug = rawSlug.replace(/:[^/]+$/, '');
  let match;
  if (maker === 'anthropic') {
    match = /^claude-(opus|sonnet|haiku|fable)-(\d+(?:\.\d+)?)(?:\b|[-:])/.exec(slug);
    if (match) return [`claude-${match[1]}`, match[2]];
  }
  if (maker === 'openai') {
    match = /^gpt-(\d+(?:\.\d+)?|4o)(?:-(.*))?$/.exec(slug);
    if (match) {
      const variant = /^(mini|nano|codex|luna|terra|sol|astra)(?:\b|-)/.exec(`${match[2] ?? ''}-`)?.[1] ?? 'base';
      return [`gpt-${variant}`, match[1] === '4o' ? '4' : match[1]];
    }
  }
  if (maker === 'google') {
    match = /^(gemini|gemma)-(\d+(?:\.\d+)?)(?:-(.*))?$/.exec(slug);
    if (match) {
      const variant = match[1] === 'gemma' ? 'base' :
        /^(flash-lite|flash|pro)(?:\b|-)/.exec(`${match[3] ?? ''}-`)?.[1] ?? 'base';
      return [`${match[1]}-${variant}`, match[2]];
    }
  }
  if (maker === 'z-ai') {
    match = /^glm-(\d+(?:\.\d+)?)(v|-(.*))?$/.exec(slug);
    if (match) return [`glm-${match[2] === 'v' ? 'vision' :
      /^(flashx|flash|air)(?:\b|-)/.exec(`${match[3] ?? ''}-`)?.[1] ?? 'base'}`, match[1]];
  }
  if (maker === 'xiaomi') {
    match = /^mimo-v(\d+(?:\.\d+)?)(?:-(.*))?$/.exec(slug);
    if (match) return [`mimo-${/^(pro|flash)(?:\b|-)/.exec(`${match[2] ?? ''}-`)?.[1] ?? 'base'}`, match[1]];
  }
  if (maker === 'qwen') {
    match = /^qwen-?(\d+(?:\.\d+)?)(?:-(.*))?$/.exec(slug);
    if (match) return [`qwen-${/^(flash|plus|max|coder|vl)(?:\b|-)/.exec(`${match[2] ?? ''}-`)?.[1] ?? 'base'}`, match[1]];
  }
  if (maker === 'deepseek') {
    match = /^deepseek-(chat-|r1-|)?v?(\d+(?:\.\d+)?)(?:-(.*))?$/.exec(slug);
    if (match) return [`deepseek-${match[1] ?? ''}${/^(flash|pro)(?:\b|-)/.exec(`${match[3] ?? ''}-`)?.[1] ?? 'base'}`, match[2]];
  }
  return [slug.replace(/:.*$/, ''), null];
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (b[index] ?? 0) - (a[index] ?? 0);
  }
  return 0;
}

export function eligibleCatalog(catalog) {
  const models = (Array.isArray(catalog) ? catalog : []).slice(0, 200)
    .map((model, index) => ({ ...model, popularityRank: model.popularityRank ?? index + 1 }))
    .filter(isEligibleModel);
  const versions = new Map();
  for (const model of models) {
    const [family, version] = familyAndVersion(model.id);
    if (version == null) continue;
    const key = `${model.id.split('/')[0]}/${family}`;
    if (!versions.has(key)) versions.set(key, new Set());
    versions.get(key).add(version);
  }
  const recent = new Map([...versions].map(([key, values]) =>
    [key, new Set([...values].sort(compareVersions).slice(0, 2))]));
  return models.filter(model => {
    const [family, version] = familyAndVersion(model.id);
    return version == null || recent.get(`${model.id.split('/')[0]}/${family}`)?.has(version);
  });
}
