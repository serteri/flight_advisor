const crypto = require('crypto');

// --- AYARLAR ---
const token = '31769c19fe387c3aebfcc0bbb5aadcdb';
const marker = '701049';
const origin = 'BNE';
const destination = 'IST';
const date = '2026-03-05'; // İleri bir tarih seçelim ki uçuş olsun
const ip = '127.0.0.1'; // API isteği için standart IP

console.log(`🦁 Travelpayouts CANLI Ajanı: ${origin} -> ${destination} (${date})`);

async function runLiveTest() {
  try {
    // 1. İMZA OLUŞTURMA (MD5 Signature)
    // Sıralama çok önemlidir: token:marker:adults:children:infants:date:dest:origin:trip_class:ip:state
    const signatureBase = `${token}:${marker}:1:0:0:${date}:${destination}:${origin}:Y:${ip}:`;
    const signature = crypto.createHash('md5').update(signatureBase).digest('hex');
    
    console.log(`🔑 İmza Oluşturuldu: ${signature}`);

    // 2. ARAMAYI BAŞLAT (INIT REQUEST)
    const requestBody = {
      signature: signature,
      marker: marker,
      host: 'localhost',
      user_ip: ip,
      locale: 'en',
      trip_class: 'Y',
      passengers: {
        adults: 1,
        children: 0,
        infants: 0
      },
      segments: [
        {
          origin: origin,
          destination: destination,
          date: date
        }
      ]
    };

    console.log("🚀 Arama Başlatılıyor...");
    const initRes = await fetch('http://api.travelpayouts.com/v1/flight_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const initData = await initRes.json();

    if (!initRes.ok) {
      console.log("❌ BAŞLATMA HATASI:", initData);
      return;
    }

    const searchId = initData.search_id;
    console.log(`⏳ Search ID Alındı: ${searchId}`);
    console.log("😴 Sonuçlar toplanıyor... 5 saniye bekleniyor...");

    // 3. BEKLEME (POLLING)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 4. SONUÇLARI ÇEKME
    console.log("📦 Sonuçlar İsteniyor...");
    const resultUrl = `http://api.travelpayouts.com/v1/flight_search_results?search_id=${searchId}`;
    const resultRes = await fetch(resultUrl);
    const resultData = await resultRes.json();

    if (!resultRes.ok) {
      console.log("❌ SONUÇ HATASI:", resultData);
      return;
    }

    // 5. ANALİZ
    if (resultData && resultData[0] && resultData[0].proposals) {
      const count = resultData[0].proposals.length;
      console.log(`\n🎉 SONUÇ: Toplam ${count} adet CANLI uçuş bulundu!`);
      
      const firstDeal = resultData[0].proposals[0];
      console.log(`💰 En iyi fiyat: ${firstDeal.total_price} ${firstDeal.currency || 'USD'}`);
      console.log(`🔗 Satış Linki: https://search.aviasales.com/${searchId}/${firstDeal.sign}`);
    } else {
      console.log("\n⚠️ Arama bitti ama uçuş dönmedi. (Rota veya tarih uygun olmayabilir)");
      console.log("Ham Cevap:", JSON.stringify(resultData).substring(0, 200));
    }

  } catch (error) {
    console.error("🔥 Beklenmeyen Hata:", error);
  }
}

runLiveTest();
