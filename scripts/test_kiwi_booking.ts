// scripts/test_kiwi_booking.ts
import dotenv from 'dotenv';
dotenv.config();

async function testKiwiBooking() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com'; 

  console.log(`🥝 KIWI BOOKING LINK TESTİ...`);
  console.log(`🔑 Host: ${apiHost}`);

  try {
    // 1. UÇUŞU BUL (Bildiğimiz çalışan yöntem)
    const url = `https://${apiHost}/flights/search-oneway`;
    const params = new URLSearchParams({
      originSkyId: 'BNE',       
      destinationSkyId: 'IST',   
      departureDate: '2026-03-15', 
      cabinClass: 'ECONOMY',    
      adults: '1',
      currency: 'USD'
    });

    console.log(`📡 Veri Çekiliyor...`);
    const res = await fetch(`${url}?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost }
    });

    const json = await res.json();
    // JSON yapısı bazen data -> itineraries, bazen direkt data olabilir. 
    // Senin son çıktında 'sector' gördüm, bu data'nın içindedir.
    const flights = json.data?.itineraries || json.data || [];

    if (flights.length === 0) {
      console.log("❌ Uçuş bulunamadı.");
      return;
    }

    // 2. ID'Yİ AL VE LİNK OLUŞTUR
    const firstFlight = flights[0];
    const flightId = firstFlight.id; // Loglarda 'id' anahtarını görmüştük

    console.log(`\n🎉 UÇUŞ BULUNDU!`);
    console.log(`   🆔 Flight ID: ${flightId.substring(0, 20)}...`);
    console.log(`   💰 Fiyat: ${firstFlight.price?.amount} ${firstFlight.price?.currencyCode || 'USD'}`);

    // KIWI DEEP LINK FORMATI
    // affilid=senin_id (yoksa test için 'skyscanner' veya 'momondo' yazabiliriz)
    const bookingLink = `https://www.kiwi.com/deep?flightsId=${flightId}&affilid=skypicker&currency=USD`;

    console.log(`\n🚀 İŞTE OLUŞTURULAN LİNK (Tıkla ve Dene):`);
    console.log(`👉 ${bookingLink}`);

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testKiwiBooking();