import { FlightResult, HybridSearchParams } from "@/types/hybridFlight";
import { getAirportSettings } from "@/lib/airportDb";

const API_KEY = process.env.SERPAPI_KEY;

// --- 🔥 YARDIMCI FONKSİYON: API ÇAĞRISI YAPAN ---
async function fetchSerpApi(params: HybridSearchParams, sortType: string): Promise<any[]> {
  const settings = getAirportSettings(params.origin);
  const dateStr = params.date.split('T')[0];
  
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.append('engine', 'google_flights');
  url.searchParams.append('departure_id', params.origin);
  url.searchParams.append('arrival_id', params.destination);
  url.searchParams.append('outbound_date', dateStr);
  url.searchParams.append('currency', settings.currency);
  url.searchParams.append('hl', 'en'); 
  url.searchParams.append('gl', settings.country);
  url.searchParams.append('api_key', API_KEY || '');
  
  // Standart Ayarlar
  url.searchParams.append('type', '2'); // One Way
  url.searchParams.append('travel_class', '1'); // Economy
  url.searchParams.append('deep_search', 'true'); 
  url.searchParams.append('adults', '1');

  // 🔥 SİHİRLİ SIRALAMA PARAMETRESİ 🔥
  // 1: Best (Default), 2: Price, 3: Departure, 5: Duration
  if (sortType === 'PRICE') url.searchParams.append('sort_by', '2'); 
  if (sortType === 'DURATION') url.searchParams.append('sort_by', '5');
  
  try {
    const response = await fetch(url.toString());
    const json = await response.json();
    
    if (json.error) {
      console.log(`  ⚠️ SerpApi (${sortType}): ${json.error}`);
      return [];
    }

    const best = json.best_flights || [];
    const other = json.other_flights || [];
    const main = json.flights || [];
    
    const result = [...best, ...other, ...main];
    console.log(`  ✅ SerpApi (${sortType}): ${result.length} flights`);
    return result;
  } catch (e) {
    console.error(`  🔥 SerpApi (${sortType}) Failed:`, e);
    return [];
  }
}

// --- 🦁 ANA FONKSİYON: TRIPLE DRILL SEARCH ---
export async function searchSerpApi(params: HybridSearchParams): Promise<FlightResult[]> {
  if (!API_KEY) {
    console.warn("⚠️ SerpApi Key eksik!");
    return [];
  }

  const settings = getAirportSettings(params.origin);
  console.log(`\n🦁 SerpApi: TRIPLE DRILL SEARCH via ${settings.country.toUpperCase()}...`);
  console.log(`  Route: ${params.origin} → ${params.destination}`);

  try {
    // 🚀 AYNI ANDA 3 FARKLI ARAMA BAŞLATIYORUZ
    // Google'ı farklı açılardan sıkıştırıp tüm uçuşları dökmesini sağlıyoruz.
    const [bestResults, cheapResults, fastResults] = await Promise.all([
      fetchSerpApi(params, 'BEST'),     // En İyiler
      fetchSerpApi(params, 'PRICE'),    // En Ucuzlar (Farklı havayolları çıkabilir)
      fetchSerpApi(params, 'DURATION')  // En Hızlılar (Pahalı ama hızlılar çıkabilir)
    ]);

    // Hepsini Birleştir
    const rawList = [...bestResults, ...cheapResults, ...fastResults];
    console.log(`  📊 Raw Total: ${rawList.length} (Before dedup)`);

    // ÇİFT KAYITLARI TEMİZLE (Unique Filter)
    // Aynı uçuş numarası + kalkış saati = aynı uçuş
    const uniqueFlights = rawList.filter((flight, index, self) =>
        index === self.findIndex((t) => (
            t.flights?.[0]?.flight_number === flight.flights?.[0]?.flight_number &&
            t.flights?.[0]?.departure_airport?.time === flight.flights?.[0]?.departure_airport?.time
        ))
    );

    console.log(`  🎯 Unique Flights: ${uniqueFlights.length}\n`);

    return uniqueFlights.map((item: any, index: number): FlightResult | null => {
      const flightData = item.flights_cluster?.[0] || item;
      const segments = flightData.flights || [];

      if (segments.length === 0) return null;

      const firstSegment = segments[0];
      const lastSegment = segments[segments.length - 1];
      
      const airlineName = firstSegment.airline || 'Unknown';
      const airlineLogo = firstSegment.airline_logo || `https://ui-avatars.com/api/?name=${airlineName}&background=random`;
      
      // SÜRE HESAPLAMA (NaN Hatasını Çözer)
      const durationMins = item.total_duration || item.duration || 0;
      
      let tags: string[] = ['Google Verified'];
      if (item.extensions) {
          const cleanExtensions = item.extensions.map((ext: string) => 
            ext.replace('Average legroom', '').trim()
          ).filter((ext: string) => ext.length > 0 && ext.length < 25);
          tags = [...tags, ...cleanExtensions];
      }

      // Booking Token (ID için)
      const uniqueId = item.booking_token 
        ? `GF_${item.booking_token.substring(0, 15)}` 
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
        // --- 🛠️ SEGMENT (NaN) DÜZELTMESİ ---
        segments: segments.map((f: any) => ({
            departure: f.departure_airport?.time,
            arrival: f.arrival_airport?.time,
            duration: f.duration || 0,  // NaN'ı engelle
            airline: f.airline,
            flightNumber: f.flight_number,
            origin: f.departure_airport?.id,
            destination: f.arrival_airport?.id,
            aircraft: f.airplane
        }))
      };
    }).filter((f): f is FlightResult => f !== null);

  } catch (error) {
    console.error("🔥 SerpApi Connection Failed:", error);
    return [];
  }
}

function formatDuration(minutes: number): string {
  if (!minutes || isNaN(minutes)) return '0h 0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
