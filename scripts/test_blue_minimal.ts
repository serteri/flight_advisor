// scripts/test_blue_minimal.ts
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
const API_HOST = 'blue-scraper.p.rapidapi.com';

async function testBlueMinimal() {
  console.log(`🔵 BLUE SCRAPER (SADELEŞTİRİLMİŞ) TESTİ...`);

  try {
    // Adres: search-roundtrip (Çünkü oneway 404 veriyordu)
    const url = `https://${API_HOST}/1.0/flights/search-roundtrip`;

    // PARAMETRELER: Sadece IATA kodu ve Tarih. EntityID YOK!
    const params = new URLSearchParams({
      originSkyId: 'BNE',       
      destinationSkyId: 'IST',
      
      // ÖNEMLİ: 'departureDate' yerine tekrar 'date' deniyoruz (Yıl doğru: 2026)
      date: '2026-03-15',       
      returnDate: '2026-03-20', // Roundtrip için gerekli olabilir
      
      cabinClass: 'economy',
      adults: '1',
      currency: 'USD',
      market: 'en-US',
      countryCode: 'US'
    });

    console.log(`📡 İstek: ${url}?${params.toString()}`);

    const res = await fetch(`${url}?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
    });

    const json = await res.json();
    
    // Durum kontrolü
    const status = json.data?.context?.status;
    console.log(`🚦 Durum: ${status || 'Bilinmiyor'}`);

    if (status === 'failure') {
        console.log("❌ Yine 'failure' verdi. Bu API (Blue) şu an sorunlu olabilir.");
        return;
    }

    const flights = json.data?.itineraries || [];
    console.log(`🎉 UÇUŞ SAYISI: ${flights.length}`);

    if (flights.length > 0) {
        const first = flights[0];
        console.log(`💰 Fiyat: ${first.price?.formatted}`);
        
        // Bize lazım olan "50 Sitenin" listesi burada:
        console.log("🏢 Satıcılar:");
        first.pricingOptions?.forEach((p: any) => {
            console.log(`   - ${p.agent?.name}: ${p.price?.amount} USD -> ${p.url ? 'Link Var ✅' : 'Link Yok ❌'}`);
        });
    } else {
        console.log("⚠️ Liste boş döndü (veya incomplete).");
        if (json.data?.context?.sessionId) {
            console.log("ℹ️ Polling gerekebilir ama önce 'failure' almadığımızı görelim.");
        }
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testBlueMinimal();
