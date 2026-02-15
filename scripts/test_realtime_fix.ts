// scripts/test_realtime_fix.ts
import dotenv from 'dotenv';
dotenv.config();

async function testRealTimeFix() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  // Snippet'taki host:
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com'; 

  console.log(`✈️ FLIGHTS REAL-TIME (DÜZELTİLMİŞ) TESTİ...`);
  console.log(`🔑 Host: ${apiHost}`);

  // 1. ADIM: Önce SkyId Bulmamız Lazım (BNE ve IST için)
  // Snippet 'originSkyId' istiyorsa, önce 'searchAirport' benzeri bir şeyle ID bulmalıyız.
  // Tahmini endpoint: /flights/searchAirport veya /flights/auto-complete
  
  try {
    // Önce en yaygın arama endpoint'ini deneyelim: /flights/search
    // SkyId'leri manuel yazıyorum (Genelde havalimanı kodunun aynısıdır veya yakındır)
    
    // NOT: Snippet'ta originSkyId: 'JFK' yazıyordu. Demek ki direkt IATA kodu (BNE) da kabul edebilir!
    
    const searchUrl = `https://${apiHost}/flights/search`; // Tahmini
    
    // Snippet'taki parametre mantığına göre düzenliyorum:
    const params = new URLSearchParams({
      originSkyId: 'BNE',       // Snippet'ta JFK idi, biz BNE yaptık
      destinationSkyId: 'IST',  // Snippet'ta LGW idi, biz IST yaptık
      date: '2026-03-15',       // Tarih
      cabinClass: 'economy',
      adults: '1',
      currency: 'USD'
    });

    console.log(`📡 Tahmini Endpoint Deneniyor: ${searchUrl}?${params.toString()}`);

    const res = await fetch(`${searchUrl}?${params.toString()}`, {
      method: 'GET',
      headers: { 
        'X-RapidAPI-Key': apiKey, 
        'X-RapidAPI-Host': apiHost 
      }
    });

    if (res.status === 404) {
      console.log("❌ '/flights/search' bulunamadı. Başka bir yol deneyelim...");
      // B Planı: Belki endpoint '/api/v1/flights/search' şeklindedir?
      await tryBackupEndpoint(apiHost, apiKey);
      return;
    }

    if (!res.ok) {
      console.error(`🔥 HATA (${res.status}):`, await res.text());
      return;
    }

    const json = await res.json();
    console.log("✅ CEVAP GELDİ!");
    
    const flights = json.data || json.itineraries || [];
    console.log(`🎉 Sonuç Sayısı: ${flights.length}`);

    if (flights.length > 0) {
        console.log("💰 Örnek Fiyat:", flights[0].price?.formatted || flights[0].price);
        // Link kontrolü
        console.log("🔗 Link:", JSON.stringify(flights[0]).includes("http") ? "VAR ✅" : "YOK ❌");
    }

  } catch (error: any) {
    console.error("🔥 KRİTİK HATA:", error.message);
  }
}

// YEDEK PLAN
async function tryBackupEndpoint(host: string, key: string) {
    console.log("\n🔄 B PLANINA GEÇİLİYOR: Endpoint taranıyor...");
    
    // Olası adresler
    const endpoints = [
        '/flights/searchFlights',
        '/api/v1/flights/searchFlights',
        '/api/v2/flights/searchFlights'
    ];

    for (const path of endpoints) {
        const url = `https://${host}${path}?originSkyId=BNE&destinationSkyId=IST&date=2026-03-15`;
        console.log(`   👉 Deneniyor: ${path}`);
        const res = await fetch(url, { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host } });
        
        if (res.ok) {
            console.log(`   ✅ BULUNDU! Doğru adres: ${path}`);
            return;
        }
    }
    console.log("❌ Hiçbiri tutmadı. Dokümana bakmak şart oldu.");
}

testRealTimeFix();