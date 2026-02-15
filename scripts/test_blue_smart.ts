// scripts/test_blue_smart.ts
import dotenv from 'dotenv';
dotenv.config();

async function testBlueSmart() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'blue-scraper.p.rapidapi.com'; 

  console.log(`💙 BLUE SCRAPER (AKILLI MOD) TESTİ...`);
  console.log(`🔑 Host: ${apiHost}`);

  try {
    // ---------------------------------------------------------
    // ADIM 1: ŞEHİR ID BUL (Auto-Complete)
    // ---------------------------------------------------------
    console.log("📡 ADIM 1: Şehir ID'si aranıyor (Brisbane)...");
    
    // Dokümana göre 'flight' (tekil) olabilir. İkisini de deneyelim.
    let originSkyId = 'BNE';
    let destinationSkyId = 'IST';
    
    // Auto-complete için olası yollar
    const geoPaths = ['/flight/auto-complete', '/flights/auto-complete'];
    
    for (const path of geoPaths) {
        const url = `https://${apiHost}${path}?query=Brisbane`;
        const res = await fetch(url, { headers: { 'X-RapidAPI-Key': apiKey!, 'X-RapidAPI-Host': apiHost } });
        
        if (res.ok) {
            const json = await res.json();
            const data = json.data?.[0] || json[0]; 
            if (data) {
                console.log(`   ✅ Şehir Bulundu (${path}): ${data.presentation?.title || data.name}`);
                originSkyId = data.skyId; // Doküman: data -> navigation -> relevantFlightParams -> skyId
                console.log(`      📍 SkyId: ${originSkyId}`);
                break;
            }
        }
    }

    // ---------------------------------------------------------
    // ADIM 2: UÇUŞ ARA (Search)
    // ---------------------------------------------------------
    console.log(`\n📡 ADIM 2: Uçuş Aranıyor (ID: ${originSkyId} -> IST)...`);

    // Dokümandaki parametreler: originSkyId, departureDate (yyyy-mm-dd)
    const searchParams = new URLSearchParams({
        originSkyId: originSkyId,
        destinationSkyId: 'IST',
        departureDate: '2026-03-15', // Doküman tam olarak bunu istiyor
        adults: '1',
        currency: 'USD',
        cabinClass: 'economy',
        market: 'en-US',
        locale: 'en-US'
    });

    // Tekil ve Çoğul endpointleri dene
    const searchPaths = [
        '/flight/search-oneway',     // Doküman iması (Singular)
        '/flights/search-oneway',    // Genel standart (Plural)
        '/flight/search-roundtrip',  
        '/flights/search-roundtrip'
    ];

    for (const path of searchPaths) {
        const url = `https://${apiHost}${path}`;
        console.log(`   👉 Deneniyor: ${url}`);
        
        const res = await fetch(`${url}?${searchParams.toString()}`, {
            headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': apiHost }
        });

        if (!res.ok) {
            console.log(`      ❌ ${res.status}`);
            continue;
        }

        const json = await res.json();
        
        // "INCOMPLETE" KONTROLÜ (Dokümandaki kritik uyarı!)
        const status = json.data?.context?.status;
        console.log(`      ⚠️ Durum: ${status || 'Bilinmiyor'}`);

        if (status === 'incomplete') {
            console.log("      ⏳ Veri eksik, 'search-incomplete' endpoint'i gerekebilir ama şimdilik gelenlere bakalım...");
        }

        const flights = json.data?.itineraries || [];
        console.log(`      🎉 SONUÇ: ${flights.length} uçuş bulundu!`);

        if (flights.length > 0) {
            const first = flights[0];
            console.log(`      💰 Fiyat: ${first.price?.formatted || first.price?.amount}`);
            
            // Linkleri kontrol et
            const agents = first.pricingOptions?.filter((p: any) => p.url); // url kontrolü
            console.log(`      🔗 Link Sayısı: ${agents?.length || 0}`);
            
            if (agents?.length > 0) {
                console.log(`      ✅ LİNK VAR! -> ${agents[0].url.substring(0, 40)}...`);
                // Hedefi bulduk, çıkabiliriz
                return; 
            }
        }
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testBlueSmart();