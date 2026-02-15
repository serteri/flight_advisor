type Entry = { from: string; to: string; expiresAt: number };

const DEFAULT_TTL = 1000 * 60 * 5; // 5 minutes

const map = new Map<string, Entry>();

function keyOf(origin: string, destination: string) {
  return `${origin.toUpperCase()}->${destination.toUpperCase()}`;
}

export function getMemoryCachedPlaceIds(origin: string, destination: string) {
  const key = keyOf(origin, destination);
  const e = map.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return { from: e.from, to: e.to };
}

export function setMemoryCachedPlaceIds(origin: string, destination: string, from: string, to: string, ttl = DEFAULT_TTL) {
  const key = keyOf(origin, destination);
  map.set(key, { from, to, expiresAt: Date.now() + ttl });
}

export function clearMemoryPlaceCache() {
  map.clear();
}

export function inspectMemoryPlaceCache() {
  const out: Record<string, { from: string; to: string; ttlRemainingMs: number }> = {};
  for (const [k, v] of map.entries()) {
    out[k] = { from: v.from, to: v.to, ttlRemainingMs: Math.max(0, v.expiresAt - Date.now()) };
  }
  return out;
}
