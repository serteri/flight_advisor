// scripts/test_blue_v2.ts
import dotenv from 'dotenv';
dotenv.config();

async function testBlueV2() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  // Host: blue-scraper.p.rapidapi.com
  const apiHost = 'blue-scraper.p.rapidapi.com'; 

  console.log(`💙 BLUE SCRAPER v1.0 TESTİ BAŞLIYOR...`);
  console.log(`🔑 Host: ${apiHost}`);

  if (!apiKey) { console.error("⛔ Key yok!"); return; }

  try {
    // ---------------------------------------------------------
    // ADIM 1: Konum ID'sini Bul (Search Airport)
    // Tahmini Endpoint: /1.0/flights/searchAirport
    // ---------------------------------------------------------
    console.log("📡 ADIM 1: Havalimanı ID'si aranıyor (Brisbane)...");
    
    // Olası konum endpoint'leri
    const geoEndpoints = [
        '/1.0/flights/searchAirport',
        '/1.0/location/search',
        '/1.0/airports/search'
    ];

    let originSkyId = 'BNE'; // Bulamazsak bunu deneyeceğiz
    let originEntityId = '27539502'; // BNE Entity ID (Varsayılan)

    for (const ep of geoEndpoints) {
        const url = `https://${apiHost}${ep}?query=Brisbane`;
        const res = await fetch(url, { headers: { 'X-RapidAPI-Key': apiKey!, 'X-RapidAPI-Host': apiHost } });
        if (res.ok) {
            const json = await res.json();
            const data = json.data?.[0] || json[0];
            if (data) {
                console.log(`   ✅ Konum Bulundu: ${ep}`);
                console.log(`      📍 ${data.presentation?.title || data.name} (SkyId: ${data.skyId})`);
                originSkyId = data.skyId;
                originEntityId = data.entityId;
                break;
            }
        }
    }

    // ---------------------------------------------------------
    // ADIM 2: Uçuş Ara (Tek Yön)
    // Snippet'ta 'search-roundtrip' vardı, biz 'search-oneway' deneyeceğiz.
    // ---------------------------------------------------------
    console.log("\n📡 ADIM 2: Tek Yön Uçuş Aranıyor (BNE -> IST)...");
    
    // Olası uçuş endpoint'leri
    const flightEndpoints = [
        '/1.0/flights/search-oneway',  // En muhtemel
        '/1.0/flights/search-one-way',
        '/1.0/flight/search-oneway',
        '/1.0/flight/search-one-way'
    ];

    for (const ep of flightEndpoints) {
        const url = `https://${apiHost}${ep}`;
        
        const params = new URLSearchParams({
            originSkyId: originSkyId,       
            destinationSkyId: 'IST',        
            originEntityId: originEntityId, 
            destinationEntityId: '27542918', // Istanbul
            date: '2026-03-15',
            cabinClass: 'economy',
            adults: '1',
            currency: 'USD'
        });

        console.log(`   👉 Deneniyor: ${ep}`);
        
        const res = await fetch(`${url}?${params.toString()}`, {
            headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost }
        });

        if (res.ok) {
            const json = await res.json();
            const flights = json.data?.itineraries || json.itineraries || [];
            
            console.log(`   🎉 BAŞARILI! ${flights.length} uçuş bulundu.`);
            
            if (flights.length > 0) {
                const first = flights[0];
                console.log(`      💰 Fiyat: ${first.price?.formatted || '?'}`);
                
                // LİNK KONTROLÜ
                const agents = first.pricingOptions?.filter((p: any) => p.url && p.url.startsWith('http'));
                console.log(`      🔗 Acente Linkleri: ${agents?.length || 0} adet`);
                
                if (agents?.length > 0) {
                    console.log(`      ✅ Trip.com vb. VAR! -> ${agents[0].url.substring(0, 40)}...`);
                    // Eğer burayı görürsek bu iş bitmiştir!
                    return; 
                }
            }
            return; // Uçuş bulundu ama link yoksa bile endpoint doğrudur.
        } else {
            console.log(`      ❌ ${res.status} (Hata)`);
        }
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testBlueV2();