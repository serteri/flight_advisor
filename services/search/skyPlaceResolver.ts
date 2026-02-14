export async function resolveSkyPlaceIds(origin: string, destination: string, date: string, apiKey: string, apiHost: string) {
  const searchUrl = `https://${apiHost}/web/flights/search-one-way`;

  const formats = [(s: string) => `${s.toUpperCase()}-sky`, (s: string) => s.toUpperCase()];

  for (const fmtFrom of formats) {
    for (const fmtTo of formats) {
      const from = fmtFrom(origin);
      const to = fmtTo(destination);

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

      try {
        const url = `${searchUrl}?${params.toString()}`;
        // quick probe request
        const res = await fetch(url, { method: 'GET', headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost } });
        if (!res.ok) continue;
        const json = await res.json();

        // If API explicitly complains about placeIdFrom/placeIdTo, consider it invalid
        if (json && json.errors && (json.errors.placeIdFrom || json.errors.placeIdTo)) {
          continue;
        }

        // If we see itineraries or buckets, this format works
        if (json && (json.data?.itineraries || json.itineraries || json.itineraries?.results)) {
          console.log(`🔎 Sky resolver selected placeIds: ${from} -> ${to}`);
          return { from, to };
        }

        // Also accept responses without explicit errors
        if (!json || (typeof json === 'object' && Object.keys(json).length > 0 && !json.errors)) {
          console.log(`🔎 Sky resolver accepted placeIds (no errors): ${from} -> ${to}`);
          return { from, to };
        }

      } catch (e) {
        // ignore and try next
        continue;
      }
    }
  }

  // Fallback: return normalized -sky format
  return { from: `${origin.toUpperCase()}-sky`, to: `${destination.toUpperCase()}-sky` };
}
