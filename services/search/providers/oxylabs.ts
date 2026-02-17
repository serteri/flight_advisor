import { FlightResult } from '@/types/hybridFlight';

// 1. GÜVENLİK: Şifreleri .env dosyasından al
const OXY_USER = process.env.OXYLABS_USERNAME;
const OXY_PASS = process.env.OXYLABS_PASSWORD;
const AUTH = OXY_USER && OXY_PASS ? Buffer.from(`${OXY_USER}:${OXY_PASS}`).toString('base64') : '';

console.log(`[oxylabs.ts INIT] OXY_USER: ${OXY_USER ? 'SET' : 'NOT SET'}, OXY_PASS: ${OXY_PASS ? 'SET' : 'NOT SET'}`);

// Helper functions
function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0h';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// --- GLOBAL AKILLI KONUM VE PARA BİRİMİ MOTORU ---
function getSmartContext(origin: string) {
  const code = origin.toUpperCase();
  
  // MAJOR HUB'lar
  const AIRPORT_MAP: Record<string, { location: string; currency: string; gl: string }> = {
    // 🇦🇺 Avustralya & 🇳🇿 Yeni Zelanda
    'BNE': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'SYD': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'MEL': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'PER': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'AKL': { location: 'New Zealand', currency: 'NZD', gl: 'nz' },

    // 🇹🇷 Türkiye
    'IST': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'SAW': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'ESB': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'AYT': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'ADB': { location: 'Turkey', currency: 'TRY', gl: 'tr' },

    // 🇬🇧 İngiltere
    'LHR': { location: 'United Kingdom', currency: 'GBP', gl: 'uk' },
    'LGW': { location: 'United Kingdom', currency: 'GBP', gl: 'uk' },
    'MAN': { location: 'United Kingdom', currency: 'GBP', gl: 'uk' },

    // 🇪🇺 Avrupa (Euro Bölgesi)
    'CDG': { location: 'France', currency: 'EUR', gl: 'fr' },
    'FRA': { location: 'Germany', currency: 'EUR', gl: 'de' },
    'MUC': { location: 'Germany', currency: 'EUR', gl: 'de' },
    'AMS': { location: 'Netherlands', currency: 'EUR', gl: 'nl' },
    'FCO': { location: 'Italy', currency: 'EUR', gl: 'it' },
    'MAD': { location: 'Spain', currency: 'EUR', gl: 'es' },
    'BCN': { location: 'Spain', currency: 'EUR', gl: 'es' },

    // 🇺🇸 Amerika & 🇨🇦 Kanada
    'JFK': { location: 'United States', currency: 'USD', gl: 'us' },
    'LAX': { location: 'United States', currency: 'USD', gl: 'us' },
    'MIA': { location: 'United States', currency: 'USD', gl: 'us' },
    'SFO': { location: 'United States', currency: 'USD', gl: 'us' },
    'YYZ': { location: 'Canada', currency: 'CAD', gl: 'ca' },
    'YVR': { location: 'Canada', currency: 'CAD', gl: 'ca' },

    // 🇦🇪 Orta Doğu
    'DXB': { location: 'United Arab Emirates', currency: 'AED', gl: 'ae' },
    'AUH': { location: 'United Arab Emirates', currency: 'AED', gl: 'ae' },
    'DOH': { location: 'Qatar', currency: 'QAR', gl: 'qa' },

    // 🇯🇵 Asya
    'HND': { location: 'Japan', currency: 'JPY', gl: 'jp' },
    'NRT': { location: 'Japan', currency: 'JPY', gl: 'jp' },
    'SIN': { location: 'Singapore', currency: 'SGD', gl: 'sg' },
    'BKK': { location: 'Thailand', currency: 'THB', gl: 'th' },
    'HKG': { location: 'Hong Kong', currency: 'HKD', gl: 'hk' },
    'PEK': { location: 'China', currency: 'CNY', gl: 'cn' },
    'PVG': { location: 'China', currency: 'CNY', gl: 'cn' },
    'ICN': { location: 'South Korea', currency: 'KRW', gl: 'kr' },
  };

  if (AIRPORT_MAP[code]) {
    return AIRPORT_MAP[code];
  }

  // Varsayılan: Amerika / USD
  return { location: 'United States', currency: 'USD', gl: 'us' };
}

export async function searchOxylabs(params: any): Promise<FlightResult[]> {
  console.log(`\n🦁 OXYLABS SEARCH START`);
  console.log(`  Origin: ${params.origin}`);
  console.log(`  Destination: ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  // Şifre kontrolü
  if (!OXY_USER || !OXY_PASS) {
    console.warn("⚠️ Oxylabs kimlik bilgileri eksik! USER=" + OXY_USER + ", PASS=" + OXY_PASS);
    return [];
  }

  const context = getSmartContext(params.origin);
  console.log(`  Context: ${context.location} / ${context.currency}`);

  try {
    const dateStr = params.date.split('T')[0];

    // Oxylabs API İsteği
    const body = {
      source: 'google_search',
      domain: 'com',
      query: `flights from ${params.origin} to ${params.destination} on ${dateStr}`,
      parse: true,
      geo_location: context.location,
      context: [
        { key: 'results_language', value: 'en' },
        { key: 'gl', value: context.gl }
      ]
    };

    console.log(`📡 Sending request to Oxylabs...`);

    const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${AUTH}`
      },
      body: JSON.stringify(body)
    });

    console.log(`  Response Status: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error("🔥 Oxylabs API Error:", response.status, errText.substring(0, 200));
      return [];
    }

    const json = await response.json();

    // --- Oxylabs response parsing ---
    const results = json.results?.[0] || {};
    const content = results.content || {};

    console.log("\n📦 OXYLABS PARSING:");
    console.log("  Keys:", Object.keys(content));

    // Parse Google Flights results
    const flights: FlightResult[] = [];
    
    // Oxylabs returns parsed Google Flights data in content
    // Structure: content.flights or content.results or similar based on parse:true
    const parsedFlights = content.flights || content.results || content.result || [];
    
    console.log(`  Found ${parsedFlights?.length || 0} flights in parsed data`);

    if (Array.isArray(parsedFlights)) {
      for (const flight of parsedFlights) {
        try {
          // Parse Oxylabs flight structure
          const segments = flight.legs || flight.segments || [];
          
          if (segments.length === 0) continue;

          // Build departure & arrival from segments
          const outbound = segments[0];
          const inbound = segments[segments.length - 1];

          if (!outbound) continue;

          const departureTime = outbound.departure_time || outbound.departureTime || outbound.depart_time || '';
          const arrivalTime = inbound?.arrival_time || inbound?.arrivalTime || outbound.arrival_time || outbound.arriveTime || '';
          
          // Extract airlines
          const airlines = new Set<string>();
          const airlineNames = new Set<string>();
          segments.forEach((seg: any) => {
            const airlineCode = seg.airline_icao || seg.airline || seg.operating_carrier || '';
            const airlineName = seg.airline_name || airlineCode;
            if (airlineCode) airlines.add(airlineCode);
            if (airlineName) airlineNames.add(airlineName);
          });

          // Price extraction
          const priceStr = flight.price || flight.price_raw || flight.total_price || '0';
          const price = parseFloat(String(priceStr).replace(/[^0-9.]/g, '')) || 0;

          // Duration in minutes
          let durationMins = 0;
          try {
            if (departureTime && arrivalTime) {
              const dep = new Date(departureTime).getTime();
              const arr = new Date(arrivalTime).getTime();
              durationMins = Math.floor((arr - dep) / 60000);
            }
          } catch (e) {
            durationMins = 0;
          }

          const flightResult: FlightResult = {
            id: `oxy_${Math.random().toString(36).substr(2, 9)}`,
            source: 'OXYLABS',
            airline: Array.from(airlineNames)[0] || 'Multiple Airlines',
            flightNumber: segments[0].flight_number || 'OXY',
            from: params.origin,
            to: params.destination,
            departTime: departureTime,
            arriveTime: arrivalTime,
            duration: durationMins,
            durationLabel: formatDuration(durationMins),
            stops: Math.max(0, segments.length - 1),
            price,
            currency: context.currency,
            cabinClass: (flight.cabin_class || 'economy') as any,
            layovers: segments.length > 1 ? segments.slice(0, -1).map((seg: any) => ({
              city: seg.arrival_city || '',
              airport: seg.arrival_airport || seg.destination || '',
              duration: seg.layover_duration || '0'
            })) : undefined,
            segments: segments
          };

          flights.push(flightResult);
        } catch (flightError) {
          console.log(`  ⚠️ Skipped 1 flight: ${flightError}`);
        }
      }
    }

    console.log(`  ✅ Parsed ${flights.length} valid flights\n`);
    return flights;

  } catch (error) {
    console.error("🔥 Oxylabs Fail:", error);
    return [];
  }
}
