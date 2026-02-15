// scripts/test_blue_fresh.ts
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
const API_HOST = 'blue-scraper.p.rapidapi.com';

async function getFreshId(city: string) {
  console.log(`🔎 ${city} için taze ID alınıyor...`);
  const url = `https://${API_HOST}/flights/auto-complete?query=${city}`;
  const res = await fetch(url, { headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST } });
  const json = await res.json();
  const data = json.data?.[0];
  if (data) {
    console.log(`   ✅ ${city} -> SkyId: ${data.skyId}, EntityId: ${data.entityId}`);
    return data;
  }
  return null;
}

async function testBlueFresh() {
  console.log(`🔵 BLUE SCRAPER - TAZE VERİ OPERASYONU...`);

  try {
    // 1. Taze ID'leri al (Hata almamak için şart!)
    const origin = await getFreshId('Brisbane');
    const dest = await getFreshId('Istanbul');

    if (!origin || !dest) {
      console.error("❌ Lokasyonlar bulunamadı.");
      return;
    }

    // 2. Arama Başlat
    const url = `https://${API_HOST}/1.0/flights/search-roundtrip`;
    const params = new URLSearchParams({
      originSkyId: origin.skyId,
      destinationSkyId: dest.skyId,
      originEntityId: origin.entityId,
      destinationEntityId: dest.entityId,
      date: '2026-03-15',
      returnDate: '2026-03-25',
      cabinClass: 'economy',
      adults: '1',
      currency: 'USD',
      market: 'en-US',
      countryCode: 'US'
    });

    console.log(`\n📡 Arama yapılıyor: ${url}`);
    
    const res = await fetch(`${url}?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
    });

    const json = await res.json();
    
    if (json.status === false || json.data?.context?.status === 'failure') {
      console.error("🔥 HATA:", json.message || "API Failure verdi.");
      console.log("JSON Çıktısı:", JSON.stringify(json));
      return;
    }

    const flights = json.data?.itineraries || [];
    console.log(`\n🎉 SONUÇ: ${flights.length} uçuş grubu bulundu!`);

    if (flights.length > 0) {
      const first = flights[0];
      console.log(`💰 Fiyat: ${first.price?.formatted}`);
      
      // İŞTE O MEŞHUR LİSTE:
      console.log("\n🏢 SATICILAR (Trip.com, Mytrip vb.):");
      first.pricingOptions?.forEach((p: any) => {
        console.log(`   - ${p.agent?.name.padEnd(15)} : ${p.price?.formatted} -> ${p.url ? '✅ LİNK TAMAM' : '❌ LİNK YOK'}`);
      });
    } else {
      console.log("⚠️ Veri gelmedi (Incomplete olabilir).");
    }

  } catch (error: any) {
    console.error("🔥 KRİTİK HATA:", error.message);
  }
}

testBlueFresh();