import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { getAirportSettings } from "@/lib/airportDb";

const API_KEY = process.env.SERPAPI_KEY;

// 🛠️ YARDIMCI FONKSİYON: "NAKED" SEARCH
async function fetchSerpApi(
  params: HybridSearchParams,
  overrideGl?: string,
  overrideCur?: string
): Promise<any[]> {
  const defaultSettings = getAirportSettings(params.origin);
  const targetGl = overrideGl || defaultSettings.country;
  const targetCur = overrideCur || defaultSettings.currency;

  const dateStr = params.date.split("T")[0];

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.append("engine", "google_flights");
  url.searchParams.append("departure_id", params.origin);
  url.searchParams.append("arrival_id", params.destination);
  url.searchParams.append("outbound_date", dateStr);

  // 🌍 KONUM VE PARA BİRİMİ
  url.searchParams.append("currency", targetCur);
  url.searchParams.append("gl", targetGl);
  url.searchParams.append("hl", "en");
  url.searchParams.append("api_key", API_KEY || "");

  // 🔥 "NAKED" MOD: FİLTRELERİ KALDIRDIK 🔥
  // type / travel_class / adults SİLİNDİ
  url.searchParams.append("deep_search", "true");
  url.searchParams.append("show_hidden", "true");
  url.searchParams.append("stops", "0");

  try {
    const response = await fetch(url.toString());
    const json = await response.json();

    if (json.error) {
      console.warn(`⚠️ SerpApi Error [GL:${targetGl}]:`, json.error);
      return [];
    }

    // Log response structure for debugging
    console.log(`[SerpApi Debug] Response keys:`, Object.keys(json));
    console.log(`[SerpApi Debug] best_flights count:`, json.best_flights?.length || 0);
    console.log(`[SerpApi Debug] other_flights count:`, json.other_flights?.length || 0);
    console.log(`[SerpApi Debug] flights count:`, json.flights?.length || 0);

    const results = [
      ...(json.best_flights || []),
      ...(json.other_flights || []),
      ...(json.flights || [])
    ].map((item: any) => ({
      ...item,
      __currency: targetCur,
      __gl: targetGl
    }));

    console.log(`📊 SerpApi [GL: ${targetGl.toUpperCase()}] fetched: ${results.length} flights`);
    return results;
  } catch (error) {
    console.error(`🔥 SerpApi Request Failed [GL:${targetGl}]:`, error);
    return [];
  }
}

export async function searchSerpApi(params: HybridSearchParams): Promise<FlightResult[]> {
  if (!API_KEY) {
    console.warn("⚠️ SerpApi Key eksik!");
    return [];
  }

  const localSettings = getAirportSettings(params.origin);
  console.log(
    `🦁 SerpApi: NAKED DOUBLE AGENT (No Filters) via ${localSettings.country.toUpperCase()} & US...`
  );

  try {
    const [localResults, usResults] = await Promise.all([
      fetchSerpApi(params),
      fetchSerpApi(params, "us", "USD")
    ]);

    const rawList = [...localResults, ...usResults];
    console.log(`📦 SerpApi TOTAL RAW: ${rawList.length} flights`);

    const uniqueMap = new Map<string, any>();

    rawList.forEach((item) => {
      const flightNo = item.flights?.[0]?.flight_number || "";
      const departTime = item.flights?.[0]?.departure_airport?.time || "";
      const key = `${flightNo}_${departTime}`;

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
        return;
      }

      const currentCurrency = item.__currency || "USD";
      if (currentCurrency === localSettings.currency) {
        uniqueMap.set(key, item);
      }
    });

    const uniqueFlights = Array.from(uniqueMap.values());
    console.log(`✅ SerpApi FINAL UNIQUE: ${uniqueFlights.length} flights!`);

    return uniqueFlights
      .map((item: any, index: number): FlightResult | null => {
        const flightData = item.flights_cluster?.[0] || item;
        const segments = flightData.flights || [];

        if (segments.length === 0) return null;

        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];

        const airlineName = firstSegment.airline || "Unknown";
        const airlineLogo = firstSegment.airline_logo || undefined;
        const durationMins = item.total_duration || item.duration || 0;
        const stopCount = (item.layovers || []).length;
        const currencyCode = item.__currency || localSettings.currency;

        const uniqueId = item.booking_token
          ? `GF_${item.booking_token.substring(0, 15)}`
          : `SERP_${index}_${Math.random().toString(36).substr(2, 5)}`;

        return {
          id: uniqueId,
          source: "SERPAPI",
          airline: airlineName,
          airlineLogo,
          flightNumber: firstSegment.flight_number || "N/A",
          from: params.origin,
          to: params.destination,
          departTime: firstSegment.departure_airport?.time || params.date,
          arriveTime: lastSegment.arrival_airport?.time || params.date,
          duration: durationMins,
          durationLabel: formatDuration(durationMins),
          stops: stopCount,
          price: typeof item.price === "number" ? item.price : Number(item.price) || 0,
          currency: currencyCode,
          cabinClass: params.cabin || "economy",
          layovers: (item.layovers || []).map((layover: any) => ({
            city: layover.name || "",
            airport: layover.id || "",
            duration: layover.duration ? `${layover.duration} min` : "0"
          })),
          segments: segments.map((segment: any) => ({
            departure: segment.departure_airport?.time,
            arrival: segment.arrival_airport?.time,
            duration: segment.duration || 0,
            airline: segment.airline,
            flightNumber: segment.flight_number,
            origin: segment.departure_airport?.id,
            destination: segment.arrival_airport?.id,
            aircraft: segment.airplane
          }))
        };
      })
      .filter((flight): flight is FlightResult => flight !== null);
  } catch (error) {
    console.error("🔥 SerpApi Fatal Error:", error);
    return [];
  }
}

function formatDuration(minutes: number): string {
  if (!minutes || Number.isNaN(minutes)) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
