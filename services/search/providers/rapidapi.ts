import { FlightResult, FlightSource } from "@/types/hybridFlight";

// YARDIMCI: Aviasales Linki (Duffel ve Linki Olmayanlar İçin Yedek)
function generateAviasalesSearchLink(origin: string, dest: string, dateStr: string, marker: string) {
    try {
        const d = new Date(dateStr);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        // Arama sayfasına yönlendirir
        return `https://www.aviasales.com/search/${origin}${day}${month}${dest}1?marker=${marker}&currency=AUD`;
    } catch (e) {
        return `https://www.aviasales.com/?marker=${marker}`;
    }
}

export async function searchSkyScrapper(params: { origin: string, destination: string, date: string, currency?: string }): Promise<FlightResult[]> {
  const apiKey = process.env.RAPID_API_KEY_SKY || 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000';
  const host = 'sky-scrapper.p.rapidapi.com';
  const currency = params.currency || 'AUD'; 

  // Tarih 2025 -> 2026 düzeltmesi
  let targetDate = params.date.includes('T') ? params.date.split('T')[0] : params.date;
  if (targetDate.startsWith('2025')) targetDate = targetDate.replace('2025', '2026');

  // Konum ID'lerini bul (resolveLocation fonksiyonunu aşağıda tanımlamayı unutma)
  const originLoc = await resolveLocation(params.origin, apiKey, host);
  const destLoc = await resolveLocation(params.destination, apiKey, host);

  if (!originLoc || !destLoc) return [];

  try {
    const url = `https://${host}/api/v1/flights/searchFlights`;
    const queryParams = new URLSearchParams({
      originSkyId: originLoc.skyId, originEntityId: originLoc.entityId,
      destinationSkyId: destLoc.skyId, destinationEntityId: destLoc.entityId,
      date: targetDate, 
      cabinClass: 'economy', 
      adults: '1', 
      sortBy: 'price_high_to_low', // 🔥 DİKKAT: Ucuzları (Low Cost) kaçırmamak için 'best' yerine 'price' sıralaması denenebilir.
      currency: currency, 
      market: 'en-US', 
      countryCode: 'AU'
    });

    const res = await fetch(`${url}?${queryParams.toString()}`, {
      method: 'GET',
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host }
    });

    if (!res.ok) return [];

    const data = await res.json();
    const items = data.data?.itineraries || [];

    console.log(`✅ SKY SCRAPPER: ${items.length} uçuş (Low-Cost dahil).`);

    return items.map((item: any) => {
      
      // 🕵️‍♂️ "SATICI LİSTESİ" OLUŞTURUYORUZ (Skyscanner Modeli)
      const agents = item.pricingOptions?.map((opt: any) => ({
        name: opt.agent?.name || "Provider", // Trip.com, Expedia, Mytrip
        price: opt.price?.amount,            // $510
        image: opt.agent?.imageUrl,          // Logo
        rating: opt.agent?.rating,           // Güven puanı (Örn: 4.5/5)
        isOfficial: opt.agent?.isOp || false,// Havayolunun kendi sitesi mi?
        url: opt.items?.[0]?.url             // Satış linki (Varsa)
      })) || [];

      // En ucuz fiyat
      const bestPrice = item.price?.raw || agents[0]?.price || 0;

      // Havayolu Bilgisi
      const mainCarrier = item.legs?.[0]?.carriers?.marketing?.[0];

      return {
        id: `SKY_${item.id}`,
        source: 'SKY_SCRAPPER' as FlightSource, // Kaynak
        airline: mainCarrier?.name || "Airline",
        airlineLogo: mainCarrier?.logoUrl,
        
        // Low-Cost Kontrolü (Genelde bagaj yoksa veya belirli firmalarsa Low Cost'tur)
        isLowCost: bestPrice < 600, // Basit bir mantık, bunu geliştirebiliriz

        price: bestPrice,
        currency: currency,
        departTime: item.legs?.[0]?.departure,
        arriveTime: item.legs?.[0]?.arrival,
        duration: item.legs?.[0]?.durationInMinutes,
        stops: item.legs?.[0]?.stopCount,
        flightNumber: mainCarrier?.alternateId || "FLIGHT",
        from: params.origin,
        to: params.destination,
        cabinClass: 'economy',
        
        // 🔥 FRONTEND İÇİN KRİTİK VERİ: SATICILAR LİSTESİ 🔥
        // agents: agents, 
        bookingProviders: agents.map((a: any) => ({
             name: a.name,
             price: a.price,
             currency: currency,
             link: a.url || generateAviasalesSearchLink(params.origin, params.destination, params.date, 'SENIN_TRAVELPAYOUTS_ID'),
             type: 'agency'
        })),

        // Yedek Link (Eğer listeden seçim yapmazsa genel arama)
        deepLink: generateAviasalesSearchLink(params.origin, params.destination, params.date, 'SENIN_TRAVELPAYOUTS_ID'),
        bookingLink: generateAviasalesSearchLink(params.origin, params.destination, params.date, 'SENIN_TRAVELPAYOUTS_ID')
      };
    });

  } catch (error: any) {
    console.error("🔥 SKY HATA:", error.message);
    return [];
  }
}

// resolveLocation fonksiyonu dosyanın en altında olmalı...
async function resolveLocation(query: string, apiKey: string, host: string) {
  try {
    const url = `https://${host}/api/v1/flights/searchAirport`;
    const q = new URLSearchParams({ query: query, locale: 'en-US' });
    const res = await fetch(`${url}?${q}`, { headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': host } });
    if (!res.ok) return null;
    const json = await res.json();
    const bestMatch = json.data?.[0];
    if (bestMatch) return { skyId: bestMatch.skyId, entityId: bestMatch.entityId };
    return null;
  } catch(e) { return null; }
}

export async function searchAirScraper(params: any) {
    return []; // Placeholder
}
