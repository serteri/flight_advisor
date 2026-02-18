import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { getAirportSettings } from "@/lib/airportDb";

/**
 * SERPAPI - Google Flights Search via SerpApi
 * 🔥 ULTIMATE DEEP SEARCH - Tüm musluklar açık!
 * Docs: https://serpapi.com/google-flights-api
 */

const API_KEY = process.env.SERPAPI_KEY;

export async function searchSerpApi(params: HybridSearchParams): Promise<FlightResult[]> {
  if (!API_KEY) {
    console.warn("⚠️ SerpApi Key eksik! (.env dosyasına ekle)");
    return [];
  }

  const settings = getAirportSettings(params.origin);
  console.log(`🦁 SerpApi: ULTIMATE Deep Search via ${settings.country.toUpperCase()}...`);

  try {
    const dateStr = params.date.split('T')[0];

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.append('engine', 'google_flights');
    url.searchParams.append('departure_id', params.origin);
    url.searchParams.append('arrival_id', params.destination);
    url.searchParams.append('outbound_date', dateStr);
    url.searchParams.append('currency', settings.currency);
    url.searchParams.append('hl', 'en'); 
    url.searchParams.append('gl', settings.country);
    url.searchParams.append('api_key', API_KEY);
    
    // --- 🔥 DOKÜMANA GÖRE OPTİMİZASYON ---
    url.searchParams.append('type', '2'); // Tek Yön
    url.searchParams.append('travel_class', '1'); // Economy
    
    // 1. DERİN ARAMA: Bu parametre Google'ın tüm veritabanını tarar.
    url.searchParams.append('deep_search', 'true'); 
    
    // 2. TÜMÜNÜ GÖSTER: "Kötü" veya "Gizli" uçuşları da getirir.
    url.searchParams.append('show_hidden', 'true');

    // 2. TÜMÜNÜ GÖSTER: "Kötü" veya "Gizli" uçuşları da getirir.
    url.searchParams.append('show_hidden', 'true');

    const response = await fetch(url.toString());
    const json = await response.json();

    if (json.error) {
      console.error("🔥 SerpApi Error:", json.error);
      return [];
    }

    // Google sonuçları ikiye ayırır: "En İyiler" ve "Diğerleri"
    // Hepsini birleştiriyoruz.
    const bestFlights = json.best_flights || [];
    const otherFlights = json.other_flights || [];
    const mainFlights = json.flights || []; // Bazen direkt burada gelir
    
    // Tüm listeleri birleştir
    const rawList = [...bestFlights, ...otherFlights, ...mainFlights];

    console.log(`✅ SerpApi Raw Results: ${rawList.length} flights received.`);

    // --- 🚨 FİLTRE KALDIRILDI ---
    // Önceki kodda burada yanlış bir "Duplicate Filter" vardı, 
    // aynı uçakla başlayan farklı aktarmaları siliyordu. O yüzden az sonuç geliyordu.
    // Artık SerpApi ne gönderirse hepsini kullanıcıya sunuyoruz.

    const flights = rawList.map((item: any, index: number): FlightResult | null => {
      const flightData = item.flights_cluster?.[0] || item;
      const segments = flightData.flights || [];

      if (segments.length === 0) return null;

      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];
      
      const airlineName = firstSegment.airline || 'Unknown';
      const airlineLogo = firstSegment.airline_logo || `https://ui-avatars.com/api/?name=${airlineName}&background=random`;
      
      // Toplam süre ve etiketler
      const durationMins = item.total_duration || item.duration || 0;
      let tags: string[] = ['Google Verified'];
      
      if (item.extensions) {
          // Gereksiz uzun metinleri temizle, kısa etiket yap
          const cleanExtensions = item.extensions.map((ext: string) => 
            ext.replace('Average legroom', '').replace('Below average legroom', '').trim()
          ).filter((ext: string) => ext.length > 0 && ext.length < 20);
          
          tags = [...tags, ...cleanExtensions];
      }
      
      if (item.carbon_emissions?.this_flight) {
         const emissions = Math.round(item.carbon_emissions.this_flight / 1000);
         tags.push(`🌿 ${emissions}kg CO2`);
      }

      // Booking Token varsa unique ID olarak kullan, yoksa random üret
      const uniqueId = item.booking_token 
        ? `GF_${item.booking_token.substring(0, 10)}` 
        : `SERP_${index}_${Math.random().toString(36).substr(2, 5)}`;

      return {
        id: uniqueId,
        source: 'SERPAPI' as const,
        airline: airlineName,
        airlineLogo: airlineLogo,
        price: item.price || 0,
        currency: settings.currency,
        departTime: firstSegment.departure_airport?.time || params.date,
        arriveTime: lastSegment.arrival_airport?.time || params.date,
        duration: durationMins,
        durationLabel: formatDuration(durationMins),
        from: params.origin,
        to: params.destination,
        stops: (item.layovers || []).length,
        cabinClass: params.cabin || 'economy',
        flightNumber: firstSegment.flight_number || 'N/A',
        layovers: (item.layovers || []).map((layover: any) => ({
          city: layover.name || "",
          airport: layover.id || "",
          duration: layover.duration ? `${layover.duration} min` : "0"
        })),
        segments: segments.map((f: any) => ({
            departure: f.departure_airport?.time,
            arrival: f.arrival_airport?.time,
            duration: f.duration,
            airline: f.airline,
            flightNumber: f.flight_number,
            origin: f.departure_airport?.id,
            destination: f.arrival_airport?.id,
            aircraft: f.airplane
        }))
      };
    }).filter((f): f is FlightResult => f !== null);
    
    return flights;

  } catch (error) {
    console.error("🔥 SerpApi Connection Failed:", error);
    return [];
  }
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}s ${m}d`;
}
