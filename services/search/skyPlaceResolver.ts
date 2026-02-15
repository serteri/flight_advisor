import { getCachedPlaceIds, setCachedPlaceIds } from './placeIdCache';
import { getMemoryCachedPlaceIds, setMemoryCachedPlaceIds } from './memoryPlaceCache';

export async function resolveSkyPlaceIds(origin: string, destination: string, date: string, apiKey: string, apiHost: string) {
  const searchUrl = `https://${apiHost}/web/flights/search-one-way`;

  const orig = origin.toUpperCase();
  const dest = destination.toUpperCase();

  // Check in-memory cache first (fast)
  try {
    const mem = getMemoryCachedPlaceIds(orig, dest);
    if (mem) {
      console.log(`🔒 Sky resolver memory cache hit for ${orig}->${dest}: ${mem.from} -> ${mem.to}`);
      return { from: mem.from, to: mem.to };
    }
  } catch (e) {
    // ignore memory cache errors
  }

  // Then check persistent file-backed cache
  try {
    const cached = getCachedPlaceIds(orig, dest);
    if (cached) {
      console.log(`🔒 Sky resolver file cache hit for ${orig}->${dest}: ${cached.from} -> ${cached.to}`);
      // populate memory cache for quicker subsequent hits
      try { setMemoryCachedPlaceIds(orig, dest, cached.from, cached.to); } catch { }
      return { from: cached.from, to: cached.to };
    }
  } catch (e) {
    // ignore cache errors
  }

  // In production prefer plain IATA without probing to avoid network timeouts
  if (process.env.NODE_ENV === 'production') {
    console.log(`🔒 Sky resolver production mode: preferring plain IATA for ${orig}->${dest}`);
    // populate both caches for subsequent runs
    try { setCachedPlaceIds(orig, dest, orig, dest); } catch { }
    try { setMemoryCachedPlaceIds(orig, dest, orig, dest); } catch { }
    return { from: orig, to: dest };
  }

  // Optimization: Skip probing broken /web endpoint. 
  // Trust IATA codes as they work with the API (verified via test script).
  // If we really need SkyID resolution for cities, we should use /flights/auto-complete in the future.

  // Try 2 formats quickly without network probe if possible, or just return IATA.
  // Since we verified LHR (IATA) works, we can just return the input.

  // return { from: orig, to: dest };

  // However, keeping the cache logic if it was populated by other means might be useful.
  // But strictly, the probe below is BROKEN (404). So we remove it.

  console.log(`🔒 Sky resolver: defaulting to IATA for ${orig}->${dest}`);
  try { setCachedPlaceIds(orig, dest, orig, dest); } catch { }
  try { setMemoryCachedPlaceIds(orig, dest, orig, dest); } catch { }
  return { from: orig, to: dest };

  // Fallback: plain IATA
  try { setCachedPlaceIds(orig, dest, orig, dest); } catch { }
  try { setMemoryCachedPlaceIds(orig, dest, orig, dest); } catch { }
  return { from: orig, to: dest };
}
