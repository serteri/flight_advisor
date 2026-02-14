export async function resolveSkyPlaceIds(origin: string, destination: string, date: string, apiKey: string, apiHost: string) {
  const searchUrl = `https://${apiHost}/web/flights/search-one-way`;

  // Quick resolver: try only 2 fast formats to avoid slow probing
  const formats = [
    { from: origin.toUpperCase(), to: destination.toUpperCase() }, // Plain IATA (fastest)
    { from: `${origin.toUpperCase()}-sky`, to: `${destination.toUpperCase()}-sky` } // -sky format
  ];

  // Try each format quickly with a short timeout
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
      // Probe with 5-second timeout
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

    } catch (e: any) {
      // Timeout or network error
      if (e.name === 'AbortError') {
        console.warn(`🔎 Sky resolver timeout for ${fmt.from} -> ${fmt.to}, trying next`);
      }
      // ignore and try next
      continue;
    }
  }

  // Fallback: return plain IATA (usually works)
  return { from: origin.toUpperCase(), to: destination.toUpperCase() };
}
