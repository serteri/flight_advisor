// scripts/test_realtime_final.ts
import dotenv from 'dotenv';
dotenv.config();

async function testRealTimeFinal() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  // Host: flights-scraper-real-time.p.rapidapi.com
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com'; 

  console.log(`✈️ FLIGHTS REAL-TIME (DOKÜMAN ODAKLI) TESTİ...`);
  console.log(`🔑 Host: ${apiHost}`);

  if (!apiKey) { console.error("⛔ Key Yok!"); return; }

  try {
    // DOKÜMANDAN BULDUĞUMUZ KESİN ADRES:
    const url = `https://${apiHost}/flights/search-oneway`;

    // DOKÜMANDA YAZAN KESİN PARAMETRELER:
    const params = new URLSearchParams({
      originSkyId: 'BNE',        // Doküman "Code example: JFK" diyor, yani IATA olur.
      destinationSkyId: 'IST',   // Istanbul
      departureDate: '2026-03-15', // Doküman tam olarak bu ismi istiyor!
      cabinClass: 'ECONOMY',     // Dokümandaki değer
      adults: '1',
      currency: 'USD'
    });

    console.log(`📡 İstek: ${url}?${params.toString()}`);

    const res = await fetch(`${url}?${params.toString()}`, {
      method: 'GET', // Dokümanda method yazmasa da search genelde GET'tir.
      headers: { 
        'X-RapidAPI-Key': apiKey, 
        'X-RapidAPI-Host': apiHost 
      }
    });

    if (!res.ok) {
      console.error(`🔥 HATA (${res.status}):`, await res.text());
      return;
    }

    const json = await res.json();
    console.log("✅ BAŞARILI! Cevap geldi.");

    // Veri yapısını (search-oneway'e göre) analiz edelim
    // Genelde data.itineraries veya data.flights olur
    const flights = json.data?.itineraries || json.data || [];
    
    console.log(`🎉 UÇUŞ SAYISI: ${flights.length}`);

    if (flights.length > 0) {
      const first = flights[0];
      // Fiyat nerede saklanıyor?
      const price = first.price?.formatted || first.price?.amount || "Bulunamadı";
      console.log(`💰 Fiyat: ${price}`);

      // LİNKLERİ BULALIM (search-oneway çıktısında)
      // Doküman "Retrieve carrier/code from search-oneway" diyorsa, detaylar buradadır.
      
      const agents = first.pricingOptions?.filter((p: any) => p.url && p.url.startsWith('http'));
      console.log(`🔗 Acente Linkleri: ${agents?.length || 0} adet`);

      if (agents?.length > 0) {
        console.log(`   👉 1. Acente: ${agents[0].agent?.name}`);
        console.log(`   👉 Link: ${agents[0].url.substring(0, 50)}...`);
      } else {
        console.warn("⚠️ Link yok. Ham verinin bir kısmına bakalım:");
        console.log(JSON.stringify(first).substring(0, 200));
      }
    } else {
       console.log("⚠️ Liste boş. Gelen JSON:", JSON.stringify(json).substring(0, 500));
    }

  } catch (error: any) {
    console.error("🔥 KRİTİK HATA:", error.message);
  }
}

testRealTimeFinal();