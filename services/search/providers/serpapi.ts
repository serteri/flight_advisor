import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { getAirportSettings } from "@/lib/airportDb";

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

  // --- ARTIK TEK SATIR! ---
  // Hangi havalimanıysa, kütüphaneden ayarını çekiyoruz.
  const settings = getAirportSettings(params.origin);

  console.log(`\n🦁 [SERPAPI] Google Flights via ${settings.country.toUpperCase()} (${settings.region}) in ${settings.currency}...`);
  console.log(`  Route: ${params.origin} → ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  try {
    const dateStr = params.date.split('T')[0]; // Extract YYYY-MM-DD

    // SerpApi Google Flights endpoint
    // https://serpapi.com/google-flights-api
    const url = new URL("https://serpapi.com/search.json");
    
    url.searchParams.set("engine", "google_flights");
    url.searchParams.set("api_key", SERPAPI_KEY);
    url.searchParams.set("departure_id", params.origin);
    url.searchParams.set("arrival_id", params.destination);
    url.searchParams.set("outbound_date", dateStr);
    url.searchParams.set("currency", settings.currency); // 👈 Kütüphaneden gelen para birimi
    url.searchParams.set("hl", "en");
    url.searchParams.set("gl", settings.country); // 👈 Kütüphaneden gelen ülke kodu
    
    url.searchParams.set("gl", settings.country); // 👈 Kütüphaneden gelen ülke kodu
    
    // Ekonomi & Tek Yön (type: 2 = one-way, travel_class: 1 = economy)
    url.searchParams.set("type", "2");
    url.searchParams.set("travel_class", "1");
    
    if (params.adults) {
      url.searchParams.set("adults", params.adults.toString());
    }
    if (params.children) {
      url.searchParams.set("children", params.children.toString());
    }
    if (params.infants) {
      url.searchParams.set("infants_in_seat", params.infants.toString());
    }

    console.log(`  📡 GET ${url.toString().substring(0, 120)}...`);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ SERPAPI Error ${response.status}:`, errorText.substring(0, 200));
      return [];
    }

    const data = await response.json();
    
    if (data.error) {
      console.error("🔥 SerpApi API Error:", data.error);
      return [];
    }
    
    // SerpApi returns: { best_flights: [...], other_flights: [...] }
    console.log("\n📦 SERPAPI Response:");
    console.log("  Keys:", Object.keys(data));
    
    const bestFlights = data.best_flights || [];
    const otherFlights = data.other_flights || [];
    const allFlights = [...bestFlights, ...otherFlights];
    
    console.log(`  Found ${allFlights.length} raw flights`);

    const flights: FlightResult[] = [];

    for (const item of allFlights) {
      try {
        // Parse SerpApi flight structure
        const legs = item.flights || [];
        if (legs.length === 0) continue;

        const firstLeg = legs[0];
        const lastLeg = legs[legs.length - 1];

        // Extract airline info
        const airline = firstLeg.airline || "Unknown Airline";
        const airlineLogo = firstLeg.airline_logo || undefined;
        const flightNumber = firstLeg.flight_number || "N/A";

        // Price
        const price = parseFloat(item.price) || 0;
        if (price <= 0) continue;

        // Duration in minutes
        const durationMins = item.total_duration || 0;

        // Tags & Extensions
        let tags: string[] = ['Google Verified'];
        if (item.extensions && Array.isArray(item.extensions)) {
          tags = [...tags, ...item.extensions];
        }
        
        // Carbon Emissions
        if (item.carbon_emissions?.this_flight) {
          const emissions = Math.round(item.carbon_emissions.this_flight / 1000);
          tags.push(`🌿 ${emissions}kg CO2`);
          if (item.carbon_emissions.difference_percent < 0) {
            tags.push('✅ Eco Choice');
          }
        }

        // Layovers
        const layovers = item.layovers?.map((layover: any) => ({
          city: layover.name || "",
          airport: layover.id || "",
          duration: layover.duration ? `${layover.duration} min` : "0"
        })) || [];

        const flightResult: FlightResult = {
          id: `serp_${Math.random().toString(36).substr(2, 9)}`,
          source: 'SERPAPI',
          airline,
          airlineLogo,
          flightNumber,
          from: params.origin,
          to: params.destination,
          departTime: firstLeg.departure_airport?.time || "",
          arriveTime: lastLeg.arrival_airport?.time || "",
          duration: durationMins,
          durationLabel: formatDuration(durationMins),
          stops: Math.max(0, legs.length - 1),
          price,
          currency: settings.currency, // 👈 Kütüphaneden gelen para birimi
          cabinClass: params.cabin || 'economy',
          layovers: layovers.length > 0 ? layovers : undefined,
          segments: legs.map((leg: any) => ({
            departure: leg.departure_airport?.time,
            arrival: leg.arrival_airport?.time,
            duration: leg.duration,
            airline: leg.airline,
            flightNumber: leg.flight_number,
            origin: leg.departure_airport?.id,
            destination: leg.arrival_airport?.id,
            aircraft: leg.airplane
          }))
        };

        flights.push(flightResult);
        console.log(`  ✅ ${airline} ${params.origin}->${params.destination} ${settings.currency} ${price}`);

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
