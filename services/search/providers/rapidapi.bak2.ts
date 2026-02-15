import { FlightResult, FlightSource } from "@/types/hybridFlight";
import { resolveSkyPlaceIds } from "../skyPlaceResolver";
import fs from 'fs';
import path from 'path';

// "Flight Intelligence Platform" Provider - RapidAPI (Real-Time Scraper)
// Configured to use ONLY flights-scraper-real-time.p.rapidapi.com
// This provider fetches prices to mirror OTA availability (Skyscanner parity)
// and enriches them with "Smart" data (score, rating).

const HOST = process.env.RAPID_API_HOST_FLIGHT || 'flights-scraper-real-time.p.rapidapi.com';
const KEY = process.env.RAPID_API_KEY || process.env.RAPID_API_KEY_SKY || '';

export async function searchSkyScrapper(params: { 
  origin: string, 
  destination: string, 
  date: string, 
  currency?: string,
  cabinClass?: string,
  adults?: number
}): Promise<FlightResult[]> {
  // 1. Resolve Place IDs (IATA or SkyID)
  // Even for real-time scrapers, resolving to IATA is usually safest.
  // We use our smart resolver which caches and prefers IATA in prod.
  const resolved = await resolveSkyPlaceIds(params.origin, params.destination, params.date, KEY, HOST);
  const originCode = resolved.from; // e.g. BNE
  const destCode = resolved.to;     // e.g. IST

  const targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
  const adultCount = params.adults || 1;
  const currency = params.currency || 'USD';
  const cabin = (params.cabinClass || 'ECONOMY').toUpperCase();

  console.log(`🧠 Intelligence Provider: Searching ${HOST} for ${originCode}->${destCode} on ${targetDate}`);

  try {
    // 2. Prepare Request
    // Note: The specific endpoint for 'flights-scraper-real-time' is not documented in our context.
    // We try the most common 'Google Flights' or 'Skyscanner' compatible endpoints.
    // If this fails (404), the user must provide the exact endpoint from their RapidAPI dashboard.
    
    // Attempt 1: Generic /api/v1/flights/searchFlights (Common for these scrapers)
    const url = `https://${HOST}/api/v1/flights/searchFlights`; 
    
    // Fallback/Alternate: If the user confirms it's Kiwi-based, it might be /v2/flights
    // const url = `https://${HOST}/v2/flights`; 

    const queryParams = new URLSearchParams({
      originSkyId: originCode,
      destinationSkyId: destCode,
      date: targetDate,
      adults: adultCount.toString(),
      currency: currency,
      cabinClass: cabin,
      market: 'US',
      countryCode: 'US'
    });

    // 3. Execute Request
    const res = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': KEY,
        'X-RapidAPI-Host': HOST
      }
    });

    if (!res.ok) {
      console.warn(`⚠️ Intelligence Provider (${HOST}) returned ${res.status}: ${res.statusText}`);
      if (res.status === 404) console.warn("👉 Action: Check the correct endpoint in RapidAPI dashboard for 'Flights Scraper Real-Time'.");
      
      // Fallback: Return empty array so we don't block Duffel
      return [];
    }

    const json = await res.json();
    const items = extractFlights(json);
    
    console.log(`✅ Intelligence Provider found ${items.length} options.`);

    // 4. Transform & Enrich (The "Intelligence" Layer)
    return items.map((item: any) => {
      // Calculate a mock 'Seller Confidence Score' based on price/provider
      const price = item.price?.raw || 0;
      const isTooCheap = price < 500; // Example heuristic
      
      const providerName = item.provider || 'OTA Partner';
      
      // Mock Rating (In real app, fetch from Trustpilot API)
      const sellerRating = isTooCheap ? 3.5 : 4.8; 

      return {
        id: `RAPID_${item.id || Math.random()}`,
        source: 'SKY_SCANNER_PRO' as FlightSource, // Keeping internal ID for consistency
        airline: item.legs?.[0]?.carriers?.marketing?.[0]?.name || "Unknown Airline",
        airlineLogo: item.legs?.[0]?.carriers?.marketing?.[0]?.logoUrl,
        flightNumber: item.legs?.[0]?.carriers?.marketing?.[0]?.alternateId || "FLT",
        
        from: originCode,
        to: destCode,
        departTime: item.legs?.[0]?.departure,
        arriveTime: item.legs?.[0]?.arrival,
        duration: item.legs?.[0]?.durationInMinutes || 0,
        stops: item.legs?.[0]?.stopCount || 0,

        price: price,
        currency: currency,
        cabinClass: cabin.toLowerCase() as any,
        
        // "Smart" Metadata
        tags: [
          sellerRating > 4.5 ? 'Trusted Seller' : null,
          isTooCheap ? 'Risk: Low Price' : 'Best Value'
        ].filter(Boolean),

        score: sellerRating * 2, // normalized to ~10

        bookingProviders: [{
            name: providerName,
            price: price,
            currency: currency,
            link: item.deepLink || '', // Direct link if available
            logo: undefined,
            type: 'agency',
            rating: sellerRating
        }],
        
        deepLink: item.deepLink
      } as any; // Cast to FlightResult (some fields optional)
    });

  } catch (error: any) {
    console.error(`🔥 Intelligence Provider Error: ${error.message}`);
    return [];
  }
}

// Dummy implementation for AirScraper to satisfy imports in aggregator
export async function searchAirScraper(params: any): Promise<FlightResult[]> {
  return []; 
}

// Helper: Extract flights from various JSON shapes (Google/Sky/Kiwi)
function extractFlights(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (json.data?.flights) return json.data.flights;
  if (json.itineraries) return json.itineraries;
  if (json.results) return json.results;
  return [];
}
