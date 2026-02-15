// scripts/test_blue_polling.ts
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
const API_HOST = 'blue-scraper.p.rapidapi.com';

// Yardımcı: Gecikme fonksiyonu (API'yi boğmamak için)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getSkyId(query: string) {
  console.log(`🔎 Şehir ID aranıyor: ${query}...`);
  const url = `https://${API_HOST}/flights/auto-complete?query=${query}`;
  
  const res = await fetch(url, {
    headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
  });

  const json = await res.json();
  // Dokümana göre: data -> navigation -> relevantFlightParams -> skyId
  // Ama genelde data[0].skyId daha garantidir.
  const item = json.data?.[0];
  
  if (item) {
    console.log(`   ✅ Bulundu: ${item.presentation.title} -> SkyId: ${item.skyId}`);
    return { skyId: item.skyId, entityId: item.entityId };
  }
  return null;
}

async function testBluePolling() {
  console.log(`🔵 BLUE SCRAPER (POLLING) TESTİ BAŞLIYOR...`);

  try {
    // 1. ADIM: ID'leri Bul
    const origin = await getSkyId('Brisbane');
    const dest = await getSkyId('Istanbul');

    if (!origin || !dest) {
      console.error("❌ Lokasyon ID'leri bulunamadı.");
      return;
    }

    // 2. ADIM: İlk İsteği At (Initiate Search)
    // Not: Dokümanda search-roundtrip kesin çalışıyor, returnDate vermezsek one-way gibi davranabilir mi bakalım.
    // Eğer 'search-oneway' 404 veriyorsa, 'search-roundtrip' kullanıp returnDate'i boş geçmeyi deneyeceğiz.
    
    console.log(`\n🚀 Arama Başlatılıyor (2026-03-15)...`);
    
    // Dokümana göre Endpoint: /flights/search-roundtrip (veya oneway varsa)
    // Biz garanti olsun diye roundtrip endpoint'ini OneWay gibi kullanmaya çalışacağız.
    const searchUrl = `https://${API_HOST}/1.0/flights/search-roundtrip`;
    
    const params = new URLSearchParams({
      originSkyId: origin.skyId,
      destinationSkyId: dest.skyId,
      originEntityId: origin.entityId,
      destinationEntityId: dest.entityId,
      departureDate: '2026-03-15', // Doküman: departureDate
      returnDate: '', // Boş bırakarak Tek Yön yapmayı deniyoruz
      cabinClass: 'economy',
      adults: '1',
      currency: 'USD',
      market: 'en-US',
      countryCode: 'US'
    });

    let res = await fetch(`${searchUrl}?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
    });

    let json = await res.json();
    let token = json.token || json.sessionToken || json.data?.token; // Token'ı yakala
    let status = json.data?.context?.status || 'unknown';

    console.log(`   📡 İlk Cevap Durumu: ${status}`);

    // 3. ADIM: DÖNGÜ (POLLING)
    // Eğer status 'incomplete' ise token ile tekrar soracağız.
    let attempt = 1;
    const maxAttempts = 5;

    while (status === 'incomplete' && attempt <= maxAttempts) {
      console.log(`   ⏳ [${attempt}/${maxAttempts}] Veri toplanıyor... Bekle...`);
      await sleep(2000); // 2 saniye bekle

      // Dokümanda belirtilen endpoint: /flight/search-incomplete (DİKKAT: flight tekil olabilir)
      const incompleteUrl = `https://${API_HOST}/1.0/flight/search-incomplete`;
      
      // Token'ı parametre olarak geçiyoruz
      const pollParams = new URLSearchParams({
        sessionToken: token || json.data?.context?.sessionId, // Token adı değişebilir, logdan bakacağız
        currency: 'USD',
        market: 'en-US',
        locale: 'en-US'
      });

      // Bazen token query yerine body'de veya direkt url'de istenir.
      // Doküman tam vermemiş ama genelde query paramdır.
      // Eğer sessionToken yoksa, ilk sorgudaki aynı parametreleri tekrar göndeririz (bazı API'ler böyle çalışır).
      
      // MANTIK: Eğer token yoksa, aynı URL'i tekrar çağırırız.
      const nextUrl = token ? `${incompleteUrl}?${pollParams}` : `${searchUrl}?${params.toString()}`;

      res = await fetch(nextUrl, {
         headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
      });
      
      json = await res.json();
      status = json.data?.context?.status || 'complete'; // Bulamazsa complete varsayalım
      
      console.log(`      👉 Durum: ${status}, Uçuş Sayısı: ${json.data?.itineraries?.length || 0}`);
      attempt++;
    }

    // 4. ADIM: SONUÇLARI DÖK
    const flights = json.data?.itineraries || [];
    console.log(`\n🎉 FİNAL SONUÇ: ${flights.length} uçuş bulundu!`);

    if (flights.length > 0) {
      const first = flights[0];
      console.log(`   💰 Fiyat: ${first.price?.formatted || first.price?.amount}`);
      console.log(`   ✈️ Havayolu: ${first.legs?.[0]?.carriers?.marketing?.[0]?.name}`);
      
      // LİNK KONTROLÜ
      const agents = first.pricingOptions?.filter((p: any) => p.url);
      if (agents?.length > 0) {
        console.log(`   ✅ LİNK VAR: ${agents[0].url.substring(0, 50)}...`);
        console.log(`   🏢 Satıcı: ${agents[0].agent?.name}`);
      } else {
        console.log("   ⚠️ Link yok, sadece fiyat.");
      }
    } else {
        console.log("❌ Hala uçuş yok. Parametrelerde veya tarihte (2026) sorun olabilir.");
        console.log("🔍 Debug için JSON özeti:", JSON.stringify(json).substring(0, 200));
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testBluePolling();