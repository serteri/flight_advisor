import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";

/**
 * SERPAPI - Google Flights Search via SerpApi
 * Docs: https://serpapi.com/google-flights-api
 */

const SERPAPI_KEY = process.env.SERPAPI_KEY;

export async function searchSerpApi(params: HybridSearchParams): Promise<FlightResult[]> {
  if (!SERPAPI_KEY) {
    console.log("⚠️ SERPAPI_KEY not configured");
    return [];
  }

  console.log(`\n🔍 [SERPAPI] Searching flights...`);
  console.log(`  Route: ${params.origin} → ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  try {
    // SerpApi Google Flights endpoint
    // https://serpapi.com/google-flights-api
    const url = new URL("https://serpapi.com/search");
    
    url.searchParams.set("engine", "google_flights");
    url.searchParams.set("api_key", SERPAPI_KEY);
    url.searchParams.set("departure_id", params.origin);
    url.searchParams.set("arrival_id", params.destination);
    url.searchParams.set("outbound_date", params.date);
    url.searchParams.set("currency", params.currency || "USD");
    url.searchParams.set("hl", "en");
    
    if (params.adults) {
      url.searchParams.set("adults", params.adults.toString());
    }
    if (params.children) {
      url.searchParams.set("children", params.children.toString());
    }
    if (params.infants) {
      url.searchParams.set("infants_in_seat", params.infants.toString());
    }
    if (params.cabin) {
      // Map cabin class: economy, premium_economy, business, first
      const cabinMap: Record<string, string> = {
        'economy': '1',
        'business': '3', 
        'first': '4'
      };
      url.searchParams.set("type", cabinMap[params.cabin] || '1');
    }

    console.log(`  📡 GET ${url.toString().substring(0, 100)}...`);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ SERPAPI Error ${response.status}:`, errorText.substring(0, 200));
      return [];
    }

    const data = await response.json();
    
    // SerpApi returns: { best_flights: [...], other_flights: [...] }
    console.log("\n📦 SERPAPI Response:");
    console.log("  Keys:", Object.keys(data));
    
    const allFlights = [
      ...(data.best_flights || []),
      ...(data.other_flights || [])
    ];
    
    console.log(`  Found ${allFlights.length} raw flights`);

    const flights: FlightResult[] = [];

    for (const flight of allFlights) {
      try {
        // Parse SerpApi flight structure
        const legs = flight.flights || [];
        if (legs.length === 0) continue;

        const firstLeg = legs[0];
        const lastLeg = legs[legs.length - 1];

        // Extract airline info
        const airline = firstLeg.airline || "Unknown";
        const flightNumber = firstLeg.flight_number || "N/A";

        // Price
        const price = parseFloat(flight.price) || 0;
        if (price <= 0) continue;

        // Duration in minutes
        const durationMins = flight.total_duration || 0;

        // Layovers
        const layovers = legs.slice(0, -1).map((leg: any) => ({
          city: leg.arrival_airport?.name || "",
          airport: leg.arrival_airport?.id || "",
          duration: leg.layover_duration ? `${leg.layover_duration} min` : "0"
        }));

        const flightResult: FlightResult = {
          id: `serp_${Math.random().toString(36).substr(2, 9)}`,
          source: 'SERPAPI',
          airline,
          flightNumber,
          from: params.origin,
          to: params.destination,
          departTime: firstLeg.departure_airport?.time || "",
          arriveTime: lastLeg.arrival_airport?.time || "",
          duration: durationMins,
          durationLabel: formatDuration(durationMins),
          stops: Math.max(0, legs.length - 1),
          price,
          currency: params.currency || 'USD',
          cabinClass: params.cabin || 'economy',
          layovers: layovers.length > 0 ? layovers : undefined,
          segments: legs
        };

        flights.push(flightResult);
        console.log(`  ✅ ${airline} ${params.origin}->${params.destination} $${price}`);

      } catch (err) {
        console.log(`  ⚠️ Skipped 1 flight:`, err);
      }
    }

    console.log(`\n✅ SERPAPI: Parsed ${flights.length} valid flights\n`);
    return flights;

  } catch (error) {
    console.error("🔥 SERPAPI Error:", error);
    return [];
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}s ${m}d`;
}
