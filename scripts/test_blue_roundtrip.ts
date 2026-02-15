// scripts/test_blue_roundtrip.ts
import dotenv from 'dotenv';
dotenv.config();

async function testBlueRoundTrip() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'blue-scraper.p.rapidapi.com'; 

  console.log(`💙 BLUE SCRAPER (ROUNDTRIP HİLESİ) TESTİ...`);
  console.log(`🔑 Host: ${apiHost}`);

  if (!apiKey) { console.error("⛔ Key yok!"); return; }

  try {
    // ---------------------------------------------------------
    // ADIM 1: Konum ID'sini Bul (Search Airport)
    // ---------------------------------------------------------
    console.log("📡 ADIM 1: Havalimanı ID'si aranıyor (Brisbane)...");
    
    // Konum bulma endpoint'i (Bunu da snippet'tan veya tahminle deniyoruz)
    // Eğer bu da 404 verirse, IATA kodlarını direkt kullanmayı deneyeceğiz.
    let originSkyId = 'BNE';
    let originEntityId = '27539502'; 
    
    // searchAirport endpointi 404 verdiyse direkt search-roundtrip'i IATA ile zorlayacağız.
    // O yüzden burayı pas geçip direkt aramaya gidiyorum (Risk alıyoruz ama zaman kazandırır)

    // ---------------------------------------------------------
    // ADIM 2: Uçuş Ara (Gidiş-Dönüş Kapısından Gir)
    // Endpoint: /1.0/flights/search-roundtrip (Snippet'ta yazan!)
    // ---------------------------------------------------------
    console.log("\n📡 ADIM 2: Uçuş Aranıyor (BNE -> IST)...");
    
    const url = `https://${apiHost}/1.0/flights/search-roundtrip`;
    
    const params = new URLSearchParams({
      originSkyId: 'BNE',       // ID bulamazsak IATA deniyoruz
      destinationSkyId: 'IST',  
      originEntityId: originEntityId, // ID şart olabilir, ama şansımızı deniyoruz
      destinationEntityId: '27542918',
      date: '2026-03-15',      // Gidiş
      returnDate: '2026-03-20', // Dönüş (Mecburi alan olabilir)
      cabinClass: 'economy',
      adults: '1',
      currency: 'USD',
      market: 'en-US',
      countryCode: 'US'
    });

    console.log(`   👉 Deneniyor: ${url}`);
    
    const res = await fetch(`${url}?${params.toString()}`, {
        headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost }
    });

    if (!res.ok) {
        console.error(`   ❌ HATA (${res.status}):`, await res.text());
        return;
    }

    const json = await res.json();
    const flights = json.data?.itineraries || [];
    
    console.log(`   🎉 BAŞARILI! ${flights.length} uçuş bulundu.`);
    
    if (flights.length > 0) {
        const first = flights[0];
        console.log(`      💰 Fiyat: ${first.price?.formatted || '?'}`);
        
        // LİNK KONTROLÜ
        const agents = first.pricingOptions?.filter((p: any) => p.url && p.url.startsWith('http'));
        console.log(`      🔗 Acente Linkleri: ${agents?.length || 0} adet`);
        
        if (agents?.length > 0) {
            console.log(`      ✅ Trip.com vb. VAR! -> ${agents[0].url.substring(0, 40)}...`);
            console.log(`      🏢 Satıcı: ${agents[0].agent?.name}`);
        } else {
            console.warn("      ⚠️ Link yok (Sadece fiyat).");
        }
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testBlueRoundTrip();