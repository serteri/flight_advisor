// scripts/test_blue_final.ts
import dotenv from 'dotenv';
dotenv.config();

async function testBlueFinal() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'blue-scraper.p.rapidapi.com'; 

  console.log(`💙 BLUE SCRAPER (2026 DÜZELTME) TESTİ...`);
  console.log(`🔑 Host: ${apiHost}`);

  try {
    const url = `https://${apiHost}/1.0/flights/search-roundtrip`;
    
    // TARİH AYARI: Şu an Şubat 2026'dayız.
    // İleri bir tarih seçelim: Mayıs 2026.
    const params = new URLSearchParams({
      originSkyId: 'BNE',       
      destinationSkyId: 'IST',  
      originEntityId: '27539502', // BNE Entity (Opsiyonel ama ekleyelim)
      destinationEntityId: '27542918', // IST Entity
      
      // 🚨 DÜZELTME 1: Parametre adı 'departDate' yapıldı (Bazı API'ler 'date' sevmez)
      departDate: '2026-05-15', 
      returnDate: '2026-05-25', 
      
      // Yedek olarak 'date' de gönderelim, API hangisini isterse onu alsın
      date: '2026-05-15',

      cabinClass: 'economy',
      adults: '1',
      currency: 'USD',
      market: 'en-US',
      countryCode: 'US'
    });

    console.log(`📡 İstek Gönderiliyor: ${url}?${params.toString()}`);
    
    const res = await fetch(`${url}?${params.toString()}`, {
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost }
    });

    if (!res.ok) {
        console.error(`❌ HTTP HATA (${res.status}):`, await res.text());
        return;
    }

    const json = await res.json();
    
    if (json.message) {
        console.error("❌ API MESAJI:", json.message);
    }

    const flights = json.data?.itineraries || [];
    
    console.log(`\n🎉 SONUÇ: ${flights.length} uçuş bulundu!`);
    
    if (flights.length > 0) {
        const first = flights[0];
        console.log(`   💰 Fiyat: ${first.price?.formatted || '?'}`);
        
        // Linkleri kontrol et
        const agents = first.pricingOptions?.filter((p: any) => p.url && p.url.startsWith('http'));
        
        if (agents?.length > 0) {
            console.log(`   ✅ LİNK VAR! -> ${agents[0].url.substring(0, 40)}...`);
            console.log(`   🏢 Satıcı: ${agents[0].agent?.name}`);
        } else {
            console.log("   ⚠️ Link yok, sadece fiyat var.");
        }
    } else {
         console.log("⚠️ Liste boş. JSON Özeti:", JSON.stringify(json).substring(0, 200));
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testBlueFinal();