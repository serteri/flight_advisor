import { FlightResult, FlightSource } from "@/types/hybridFlight";
import { resolveSkyPlaceIds } from "../skyPlaceResolver";

// "Flight Intelligence Platform" Provider - RapidAPI (Real-Time Scraper)
// Configured to use ONLY flights-scraper-real-time.p.rapidapi.com
// This provider fetches prices to mirror OTA availability (Skyscanner parity)
// and enriches them with "Smart" data (score, rating).

export async function searchSkyScrapper(params: {
  origin: string,
  destination: string,
  date: string,
  currency?: string,
  cabinClass?: string,
  adults?: number
}): Promise<FlightResult[]> {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = process.env.RAPID_API_HOST_FLIGHT || 'flights-scraper-real-time.p.rapidapi.com';

  console.log(`🔑 Kiwi Provider Check: Key=${apiKey ? apiKey.substring(0, 4) + '...' : 'MISSING'}, Host=${apiHost}`);

  if (!apiKey) {
    console.error('❌ RAPID_API_KEY not set - Kiwi provider disabled');
    return [];
  }

  // Tarih Formatı (yyyy-mm-dd)
  const targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;

  // Resolve Place IDs (use existing resolver to get IATA or SkyID as needed)
  // For now assuming the endpoint accepts IATA or SkyID. 
  // We use the resolver which handles this.
  const resolved = await resolveSkyPlaceIds(params.origin, params.destination, targetDate, apiKey, apiHost);
  const originCode = resolved.from;
  const destCode = resolved.to;

  console.log(`📡 Intelligence Engine: Kiwi Real-Time üzerinden veriler toplanıyor (${originCode}->${destCode})...`);

  try {
    // SENİN ONAYLADIĞIN KESİN ENDPOINT:
    const url = `https://${apiHost}/flights/search-oneway`;
    const query = new URLSearchParams({
      originSkyId: originCode,
      destinationSkyId: destCode,
      departureDate: targetDate,
      cabinClass: (params.cabinClass || 'ECONOMY').toUpperCase(),
      adults: (params.adults || 1).toString(),
      currency: params.currency || 'USD'
    });

    const fullUrl = `${url}?${query.toString()}`;
    console.log(`📡 Kiwi API: ${originCode}->${destCode} on ${targetDate}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    const res = await fetch(fullUrl, {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost },
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));

    console.log(`📊 Kiwi API response: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ Kiwi API error (${res.status}):`, errorText.slice(0, 200));
      return [];
    }

    const json = await res.json();
    const items = json.data?.itineraries || json.data || [];

    console.log(`✅ Kiwi API returned ${items.length} itineraries`);

    return items.map((item: any) => {
      try {
        // Map Kiwi response to FlightResult
        const segment = item.sector?.sectorSegments?.[0]?.segment;
        const price = parseFloat(item.price?.amount || "0");
        const relativeUrl = item.bookingOptions?.edges?.[0]?.node?.bookingUrl;
        const deepLink = relativeUrl ? `https://www.kiwi.com${relativeUrl}` : null;

        // --- INTELLIGENCE LAYER (Zeka Katmanı) ---
        let score = 7.5; // Taban puan
        let tags: string[] = [];

        // Akıllı Etiketleme Mantığı
        if (price > 0 && price < 600) { tags.push("Best Price"); score += 1.5; }
        const durationSeconds = item.duration || 0;
        if (durationSeconds < 15 * 3600) { tags.push("Fastest"); score += 0.5; }

        // Use operatingCarrier instead of marketingCarrier (that one doesn't exist)
        const carrierName = segment?.operatingCarrier?.name || "Airline";
        if (carrierName.includes("Turkish")) { tags.push("Top Rated Airline"); score += 0.5; }

        return {
          id: `RAPID_${item.id || Math.random()}`,
          source: 'SKY_SCANNER_PRO' as FlightSource, // Keeping internal ID for consistency
          airline: carrierName,
          airlineLogo: segment?.operatingCarrier?.logoUrl,
          flightNumber: segment?.operatingCarrier?.code || segment?.code || "FLT",

          from: originCode,
          to: destCode,
          departTime: segment?.source?.localTime,
          arriveTime: item.sector?.sectorSegments?.at(-1)?.segment?.destination?.localTime,
          duration: Math.floor((durationSeconds || 0) / 60), // minutes
          stops: (item.sector?.sectorSegments?.length || 1) - 1,

          price: price,
          currency: params.currency || 'USD',
          cabinClass: (params.cabinClass || 'economy').toLowerCase(),

          score: parseFloat(score.toFixed(1)),
          tags: tags,
          bookingProviders: [
            {
              name: item.provider?.[0]?.name || "Kiwi.com",
              price: price,
              currency: params.currency || 'USD',
              link: deepLink || '',
              type: 'agency' as const,
              rating: 4.2 // Kiwi için sabit rating
            }
          ],
          deepLink: deepLink
        } as any; // Cast to FlightResult
      } catch (itemError: any) {
        console.warn(`⚠️ Error mapping Kiwi item:`, itemError.message);
        return null;
      }
    }).filter((item: any): item is FlightResult => item !== null);

  } catch (error: any) {
    console.error(`🔥 Kiwi Provider fatal error: ${error.message}`);
    console.error(error.stack);
    return [];
  }
}

// Dummy implementation for AirScraper to satisfy imports in aggregator
export async function searchAirScraper(params: any): Promise<FlightResult[]> {
  return [];
}
