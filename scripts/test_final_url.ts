// scripts/test_final_url.ts
import dotenv from 'dotenv';
dotenv.config();

async function testFinalUrl() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com'; 

  console.log(`🔗 LİNK TAMİR TESTİ...`);

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
    const flight = json.data?.itineraries?.[0] || json.data?.[0];

    if (!flight) { console.log("❌ Uçuş yok."); return; }

    // HAZİNE BURADA:
    const relativeUrl = flight.bookingOptions?.edges?.[0]?.node?.bookingUrl;
    
    if (relativeUrl) {
        // BAŞINA DOMAIN EKLE
        const fullLink = `https://www.kiwi.com${relativeUrl}`;
        
        console.log(`\n✅✅✅ İŞTE ÇALIŞAN LİNK:`);
        console.log(`👉 ${fullLink}`);
    } else {
        console.log("❌ Booking URL bulunamadı.");
    }

  } catch (error: any) {
    console.error("🔥 HATA:", error.message);
  }
}

testFinalUrl();