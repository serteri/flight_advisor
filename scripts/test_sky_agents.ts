// scripts/test_sky_agents.ts
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
const API_HOST = 'sky-scrapper.p.rapidapi.com'; // Orijinal Sky Scrapper

async function testSkyAgents() {
  console.log(`🌤️ SKY SCRAPPER (ACENTE LİSTESİ) TESTİ...`);
  console.log(`🔑 Host: ${API_HOST}`);

  try {
    // 1. ADIM: ID'leri Bul (Bu API entityId olmadan çalışmaz)
    // -------------------------------------------------------
    console.log("📡 Konumlar aranıyor...");
    
    // BNE (Brisbane)
    const resBne = await fetch(`https://${API_HOST}/api/v1/flights/searchAirport?query=Brisbane`, {
      headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
    });
    const bneData = (await resBne.json()).data?.[0];

    // IST (Istanbul)
    const resIst = await fetch(`https://${API_HOST}/api/v1/flights/searchAirport?query=Istanbul`, {
      headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
    });
    const istData = (await resIst.json()).data?.[0];

    if (!bneData || !istData) {
      console.error("❌ Konum ID'leri bulunamadı. (API Kotası dolmuş olabilir)");
      return;
    }

    console.log(`   ✅ BNE: ${bneData.skyId} (Entity: ${bneData.entityId})`);
    console.log(`   ✅ IST: ${istData.skyId} (Entity: ${istData.entityId})`);

    // 2. ADIM: Uçuşları ve Acenteleri Ara
    // -------------------------------------------------------
    console.log(`\n🚀 Uçuşlar ve Satıcılar taranıyor (2026-03-15)...`);
    
    const searchUrl = `https://${API_HOST}/api/v1/flights/searchFlights`;
    const params = new URLSearchParams({
      originSkyId: bneData.skyId,
      destinationSkyId: istData.skyId,
      originEntityId: bneData.entityId,
      destinationEntityId: istData.entityId,
      date: '2026-03-15', // Sky Scrapper 'date' sever
      cabinClass: 'economy',
      adults: '1',
      currency: 'USD',
      market: 'en-US',
      countryCode: 'US'
    });

    const res = await fetch(`${searchUrl}?${params.toString()}`, {
      headers: { 'X-RapidAPI-Key': API_KEY!, 'X-RapidAPI-Host': API_HOST }
    });

    if (!res.ok) {
        console.error(`🔥 HATA (${res.status}):`, await res.text());
        return;
    }

    const json = await res.json();
    const flights = json.data?.itineraries || [];
    
    console.log(`🎉 UÇUŞ SAYISI: ${flights.length}`);

    if (flights.length > 0) {
        const first = flights[0];
        console.log(`\n💰 En Ucuz Fiyat: ${first.price?.formatted}`);
        console.log(`✈️  Havayolu: ${first.legs?.[0]?.carriers?.marketing?.[0]?.name}`);
        
        // İŞTE SENİN İSTEDİĞİN LİSTE (ACENTELER)
        console.log(`\n🏢 BU BİLETİ SATAN SİTELER (Meta-Search):`);
        console.log("------------------------------------------------");
        
        const agents = first.pricingOptions;
        
        if (agents && agents.length > 0) {
            agents.forEach((opt: any) => {
                const sellerName = opt.agent?.name;
                const price = opt.price?.formatted || opt.price?.amount;
                const linkVar = opt.url ? "✅ Link Var" : "❌ Link Yok";
                
                console.log(`   🏷️  ${sellerName.padEnd(15)} : ${price}  (${linkVar})`);
            });
            console.log("------------------------------------------------");
            console.log("👉 Eğer yukarıda 'Trip.com', 'Mytrip' görüyorsan başardık demektir!");
        } else {
            console.log("⚠️ Sadece fiyat var, alt satıcı detayı yok.");
        }

    } else {
        console.log("⚠️ Liste boş döndü.");
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testSkyAgents();