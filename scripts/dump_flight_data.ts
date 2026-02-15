// scripts/dump_flight_data.ts
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function dumpFlightData() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com'; 

  console.log(`📦 VERİ PAKETLENİYOR...`);

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
      console.log("❌ Uçuş yok.");
      return;
    }

    // İlk uçuşu al
    const firstFlight = flights[0];

    // Dosyaya yaz (Okunabilir formatta)
    fs.writeFileSync('flight_dump.json', JSON.stringify(firstFlight, null, 2));
    
    console.log("✅ BAŞARILI!");
    console.log("📂 'flight_dump.json' dosyası oluşturuldu.");
    console.log("👉 Şimdi bu dosyayı aç ve içinde 'http' veya 'token' kelimelerini arat.");

    // Konsola da bookingOptions kısmını basalım, belki gözden kaçmıştır
    if (firstFlight.bookingOptions) {
        console.log("\n--- Booking Options Özeti ---");
        console.log(JSON.stringify(firstFlight.bookingOptions, null, 2));
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

dumpFlightData();