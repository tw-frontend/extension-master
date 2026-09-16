export function normalizeApiKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (key.length < 8 || key.length > 512) {
    throw new Error('API key must be between 8 and 512 characters.');
  }
  if (/\s/.test(key)) throw new Error('API key cannot contain whitespace.');
  return key;
}
