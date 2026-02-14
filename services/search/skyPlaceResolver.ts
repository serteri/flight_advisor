import { getCachedPlaceIds, setCachedPlaceIds } from './placeIdCache';

export async function resolveSkyPlaceIds(origin: string, destination: string, date: string, apiKey: string, apiHost: string) {
  const searchUrl = `https://${apiHost}/web/flights/search-one-way`;

  const orig = origin.toUpperCase();
  const dest = destination.toUpperCase();

  // Check cache first
  try {
    const cached = getCachedPlaceIds(orig, dest);
    if (cached) {
      console.log(`🔒 Sky resolver cache hit for ${orig}->${dest}: ${cached.from} -> ${cached.to}`);
      return { from: cached.from, to: cached.to };
    }
  } catch (e) {
    // ignore cache errors
  }

  // In production prefer plain IATA without probing to avoid network timeouts
  if (process.env.NODE_ENV === 'production') {
    console.log(`🔒 Sky resolver production mode: preferring plain IATA for ${orig}->${dest}`);
    // still store to cache for subsequent runs
    try { setCachedPlaceIds(orig, dest, orig, dest); } catch {}
    return { from: orig, to: dest };
  }

  // Quick resolver: try only 2 formats (plain IATA then -sky)
  const formats = [
    { from: orig, to: dest },
    { from: `${orig}-sky`, to: `${dest}-sky` }
  ];

  for (const fmt of formats) {
    try {
      const from = fmt.from;
      const to = fmt.to;

      const params = new URLSearchParams({
        placeIdFrom: from,
        placeIdTo: to,
        departDate: date,
        market: 'AU',
        locale: 'en-US',
        currency: 'AUD',
        adults: '1',
        cabinClass: 'ECONOMY'
      });

      const url = `${searchUrl}?${params.toString()}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const json = await res.json();

      if (json && json.errors && (json.errors.placeIdFrom || json.errors.placeIdTo)) {
        continue;
      }

      if (json && (json.data?.itineraries || json.itineraries || json.itineraries?.results)) {
        console.log(`🔎 Sky resolver selected placeIds: ${from} -> ${to}`);
        try { setCachedPlaceIds(orig, dest, from, to); } catch {}
        return { from, to };
      }

      if (!json || (typeof json === 'object' && Object.keys(json).length > 0 && !json.errors)) {
        console.log(`🔎 Sky resolver accepted placeIds (no errors): ${from} -> ${to}`);
        try { setCachedPlaceIds(orig, dest, from, to); } catch {}
        return { from, to };
      }

    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.warn(`🔎 Sky resolver timeout for ${fmt.from} -> ${fmt.to}, trying next`);
      }
      continue;
    }
  }

  // Fallback: plain IATA
  try { setCachedPlaceIds(orig, dest, orig, dest); } catch {}
  return { from: orig, to: dest };
}
