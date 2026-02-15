// scripts/test_blue_fix.ts
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
const API_HOST = 'blue-scraper.p.rapidapi.com';

// Bekleme Fonksiyonu
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testBlueFix() {
  console.log(`🔵 BLUE SCRAPER (KESİN TEST) BAŞLIYOR...`);
  console.log(`🔑 Host: ${API_HOST}`);

  try {
    // Önceki denemelerden bildiğimiz çalışan endpoint
    // Doküman: 1.0/flights/search-roundtrip
    const url = `https://${API_HOST}/1.0/flights/search-roundtrip`;

    // PARAMETRELER (Dokümana %100 uygun)
    const params = new URLSearchParams({
      originSkyId: 'BNE',         // Brisbane IATA
      destinationSkyId: 'IST',    // Istanbul IATA
      originEntityId: '27539502', // BNE Entity ID (Önceki loglardan aldık)
      destinationEntityId: '27542918', // IST Entity ID
      
      // 🚨 KRİTİK DÜZELTME: 'date' değil 'departureDate'
      departureDate: '2026-03-15', 
      returnDate: '2026-03-20',   // Roundtrip olduğu için dönüş tarihi şart olabilir
      
      cabinClass: 'economy',
      adults: '1',
      currency: 'USD',
      market: 'en-US',
      countryCode: 'US'
    });

    console.log(`📡 İstek Başlatılıyor...`);
    console.log(`👉 URL: ${url}?${params.toString()}`);

    let res = await fetch(`${url}?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
    });

    if (!res.ok) {
      console.error(`🔥 İLK İSTEK HATASI (${res.status}):`, await res.text());
      return;
    }

    let json = await res.json();
    
    // API "Bekle" diyor mu? (Incomplete)
    // Blue Scraper genelde 'status: incomplete' döner ve 'sessionToken' verir.
    let status = json.status === false ? 'error' : (json.data?.context?.status || 'complete');
    const sessionToken = json.data?.context?.sessionId || json.token;

    console.log(`\n🚦 Durum: ${status}`);
    
    if (json.message) console.log(`   Mesaj: ${JSON.stringify(json.message)}`);

    // POLLING (TEKRAR SORMA) DÖNGÜSÜ
    let attempts = 0;
    while (status === 'incomplete' && attempts < 5) {
      attempts++;
      console.log(`   ⏳ [${attempts}/5] Veri hazırlanıyor... Bekleniyor...`);
      await sleep(2500); // 2.5 saniye bekle

      // Dokümanda 'search-incomplete' endpoint'i var
      // Adres: /1.0/flights/search-incomplete
      const incompleteUrl = `https://${API_HOST}/1.0/flights/search-incomplete`;
      
      const pollQuery = new URLSearchParams({
        sessionToken: sessionToken, // İlk cevaptan dönen token
        market: 'en-US',
        locale: 'en-US',
        currency: 'USD'
      });

      res = await fetch(`${incompleteUrl}?${pollQuery.toString()}`, {
        headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
      });

      json = await res.json();
      status = json.data?.context?.status || 'complete';
      console.log(`      👉 Yeni Durum: ${status}`);
    }

    // SONUÇLARI GÖSTER
    const flights = json.data?.itineraries || [];
    console.log(`\n🎉 FİNAL SONUÇ: ${flights.length} uçuş bulundu!`);

    if (flights.length > 0) {
      const first = flights[0];
      console.log(`   💰 Fiyat: ${first.price?.formatted || first.price?.amount}`);
      console.log(`   ✈️ Havayolu: ${first.legs?.[0]?.carriers?.marketing?.[0]?.name}`);
      
      const agents = first.pricingOptions?.filter((p: any) => p.url);
      if (agents?.length > 0) {
        console.log(`   ✅ LİNK: ${agents[0].url.substring(0, 40)}...`);
        console.log(`   🏢 Satıcı: ${agents[0].agent?.name}`);
      } else {
        console.log("   ⚠️ Fiyat var ama link yok.");
      }
    } else {
        // Eğer hala boşsa, JSON yapısını görelim
        console.log("⚠️ Liste boş. Gelen verinin özeti:");
        console.log(JSON.stringify(json).substring(0, 500));
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testBlueFix();
