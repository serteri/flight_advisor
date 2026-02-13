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

  // Konum ID'lerini bul (resolveLocation artık daha güvenli)
  const originLoc = await resolveLocation(params.origin, apiKey, host);
  const destLoc = await resolveLocation(params.destination, apiKey, host);

  // Fallback: Eğer API'den ID bulamazsak, direkt IATA kodunu kullanırız.
  const originEntity = originLoc || { skyId: params.origin, entityId: params.origin };
  const destEntity = destLoc || { skyId: params.destination, entityId: params.destination };

  try {
    const url = `https://${host}/api/v1/flights/searchFlights`;
    const queryParams = new URLSearchParams({
      originSkyId: originEntity.skyId, originEntityId: originEntity.entityId,
      destinationSkyId: destEntity.skyId, destinationEntityId: destEntity.entityId,
      date: targetDate, 
      cabinClass: 'economy', 
      adults: '1', 
      sortBy: 'best',
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

    return items.map((item: any) => {
      
      // 🔥 İŞTE SKYSCANNER LİSTESİ BURADA 🔥
      // Para kazanmayı düşünmeden, API'nin verdiği tüm satıcıları ve linkleri alıyoruz.
      const agents = item.pricingOptions?.map((opt: any) => ({
        name: opt.agent?.name,           // Örn: "Aunt Betty", "Gotogate"
        price: opt.price?.amount,        // Örn: 1139.50
        image: opt.agent?.imageUrl,      // Acente Logosu
        rating: opt.agent?.rating,       // Puanı (4.5/5)
        reviewCount: opt.agent?.reviewCount, // Yorum Sayısı (5438)
        
        // 🔗 KRİTİK NOKTA: DİREKT LİNK
        // Sky Scrapper bize kullanıcıyı direkt ödeme sayfasına götüren linki burada verir.
        // Bunu olduğu gibi alıyoruz, değiştirmiyoruz.
        url: opt.items?.[0]?.url 
      })) || [];

      // Listeyi ucuzdan pahalıya sıralayalım ki en tepede en ucuz olsun
      agents.sort((a: any, b: any) => a.price - b.price);

      return {
        id: `SKY_${item.id}`,
        source: 'SKY_SCRAPPER' as FlightSource,
        airline: item.legs?.[0]?.carriers?.marketing?.[0]?.name,
        airlineLogo: item.legs?.[0]?.carriers?.marketing?.[0]?.logoUrl,
        
        // Ana ekranda en ucuz fiyatı gösterelim
        price: agents[0]?.price || item.price?.raw,
        currency: currency,
        
        departTime: item.legs?.[0]?.departure,
        arriveTime: item.legs?.[0]?.arrival,
        duration: item.legs?.[0]?.durationInMinutes,
        stops: item.legs?.[0]?.stopCount,
        flightNumber: item.legs?.[0]?.carriers?.marketing?.[0]?.alternateId || "FLIGHT",
        from: params.origin,
        to: params.destination,
        cabinClass: 'economy',
        
        // Frontend'in kullanacağı "Deals" listesi
        bookingProviders: agents.map((a: any) => ({
             name: a.name,
             price: a.price,
             currency: currency,
             link: a.url || "", // Eğer link yoksa boş bırak, Aviasales yok!
             type: 'agency',
             logo: a.image,
             rating: a.rating,
             reviewCount: a.reviewCount,
             isOfficial: a.isOfficial
        })),

        // Eğer listeden seçim yapmazsa gideceği ana link (En ucuzun linki)
        // Eğer link yoksa, boş string bırakıyoruz. Aviasales'e ZORLA YÖNLENDİRME İPTAL.
        deepLink: agents[0]?.url || "",
        bookingLink: agents[0]?.url || ""
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
