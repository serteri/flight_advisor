// scripts/inspect_json.ts
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function inspectJson() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com'; 

  console.log(`🕵️‍♂️ JSON DEDEKTİFİ İŞ BAŞINDA...`);

  try {
    const url = `https://${apiHost}/flights/search-oneway`;
    const params = new URLSearchParams({
      originSkyId: 'BNE',       
      destinationSkyId: 'IST',   
      departureDate: '2026-03-15', 
      cabinClass: 'ECONOMY',    
      adults: '1',
      currency: 'USD'
    });

    const res = await fetch(`${url}?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': apiKey!, 'X-RapidAPI-Host': apiHost }
    });

    const json = await res.json();
    const flights = json.data?.itineraries || json.data || [];

    if (flights.length === 0) {
      console.log("❌ Veri boş geldi.");
      return;
    }

    const firstFlight = flights[0];
    
    // 1. Veriyi Dosyaya Kaydet (Backup)
    fs.writeFileSync('debug_flight.json', JSON.stringify(firstFlight, null, 2));
    console.log("💾 Veri 'debug_flight.json' dosyasına kaydedildi.\n");

    // 2. İçinde 'http' geçen her şeyi bul (Recursive Search)
    console.log("🔍 GİZLİ LİNKLER ARANIYOR...");
    findLinks(firstFlight);

    // 3. Anahtarları Listele (Yol Haritası)
    console.log("\n🗺️ VERİ YAPISI (Anahtarlar):");
    console.log(Object.keys(firstFlight).join(", "));

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

// Yardımcı: Derinlemesine Arama Fonksiyonu
function findLinks(obj: any, path: string = '') {
  if (!obj) return;

  if (typeof obj === 'string') {
    if (obj.includes('http') || obj.includes('www')) {
      console.log(`   👉 BULUNDU! [${path}]: ${obj.substring(0, 80)}...`);
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => findLinks(item, `${path}[${index}]`));
    return;
  }

  if (typeof obj === 'object') {
    for (const key in obj) {
      findLinks(obj[key], path ? `${path}.${key}` : key);
    }
  }
}

inspectJson();