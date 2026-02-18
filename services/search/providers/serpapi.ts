import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { getAirportSettings } from "@/lib/airportDb";

const API_KEY = process.env.SERPAPI_KEY;

async function fetchSerpApi(params: HybridSearchParams, sortType: string): Promise<any[]> {
  const settings = getAirportSettings(params.origin);
  const dateStr = params.date.split('T')[0];

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.append("engine", "google_flights");
  url.searchParams.append("departure_id", params.origin);
  url.searchParams.append("arrival_id", params.destination);
  url.searchParams.append("outbound_date", dateStr);
  url.searchParams.append("currency", settings.currency);
  url.searchParams.append("hl", "en");
  url.searchParams.append("gl", settings.country);
  url.searchParams.append("api_key", API_KEY || "");

  url.searchParams.append("type", "2");
  url.searchParams.append("travel_class", "1");
  url.searchParams.append("deep_search", "true");
  url.searchParams.append("show_hidden", "true");
  url.searchParams.append("stops", "0");
  url.searchParams.append("adults", "1");

  if (sortType === "PRICE") url.searchParams.append("sort_by", "2");
  if (sortType === "DEPARTURE") url.searchParams.append("sort_by", "3");
  if (sortType === "ARRIVAL") url.searchParams.append("sort_by", "4");
  if (sortType === "DURATION") url.searchParams.append("sort_by", "5");

  try {
    const response = await fetch(url.toString());
    const json = await response.json();

    if (json.error) {
      console.warn(`⚠️ SerpApi Error (${sortType}):`, json.error);
      return [];
    }

    const best = json.best_flights || [];
    const other = json.other_flights || [];
    const main = json.flights || [];

    return [...best, ...other, ...main];
  } catch (error) {
    console.error(`🔥 SerpApi Request Failed (${sortType}):`, error);
    return [];
  }
}

export async function searchSerpApi(params: HybridSearchParams): Promise<FlightResult[]> {
  if (!API_KEY) {
    console.warn("⚠️ SerpApi Key eksik!");
    return [];
  }

  const settings = getAirportSettings(params.origin);
  console.log(`\n🦁 SerpApi: QUADRANT ATTACK via ${settings.country.toUpperCase()}...`);

  try {
    const [priceResults, durationResults, departureResults, arrivalResults] = await Promise.all([
      fetchSerpApi(params, "PRICE"),
      fetchSerpApi(params, "DURATION"),
      fetchSerpApi(params, "DEPARTURE"),
      fetchSerpApi(params, "ARRIVAL")
    ]);

    const rawList = [...priceResults, ...durationResults, ...departureResults, ...arrivalResults];

    const uniqueFlights = rawList.filter((flight, index, self) =>
      index === self.findIndex((t) => (
        t.flights?.[0]?.flight_number === flight.flights?.[0]?.flight_number &&
        t.flights?.[0]?.departure_airport?.time === flight.flights?.[0]?.departure_airport?.time &&
        t.flights?.[0]?.airline === flight.flights?.[0]?.airline
      ))
    );

    console.log(`✅ SerpApi MERGED Results: Found ${rawList.length}, Unique: ${uniqueFlights.length} flights!`);

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
          price: item.price || 0,
          currency: settings.currency,
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
