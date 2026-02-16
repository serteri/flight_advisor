const crypto = require('crypto');

// Senin Tokenların
const token = '31769c19fe387c3aebfcc0bbb5aadcdb';
const marker = '701049';
const origin = 'BNE';
const destination = 'IST';

console.log("🦁 Travelpayouts Ajanı Göreve Başladı...");

async function testAviasales() {
  // YÖNTEM 1: En Ucuz Biletler (Cache)
  // Bu endpoint en geniş veriye sahiptir. Tarih vermeden soralım.
  const url1 = `https://api.travelpayouts.com/v1/prices/cheap?origin=${origin}&destination=${destination}&token=${token}`;
  
  console.log("\n--- TEST 1: Cache Kontrolü ---");
  try {
    const res = await fetch(url1);
    const data = await res.json();
    if (data.success === false) {
        console.log("❌ HATA:", data.error);
    } else {
        const flightCount = Object.keys(data.data || {}).length;
        console.log(`✅ Cache Durumu: ${flightCount} uçuş bulundu.`);
        console.log("Örnek Veri:", JSON.stringify(data.data[destination], null, 2).substring(0, 200) + "...");
    }
  } catch (e) {
    console.log("❌ Bağlantı Hatası:", e.message);
  }

  // YÖNTEM 2: Canlı Arama (Signature Testi)
  console.log("\n--- TEST 2: İmza & Yetki Kontrolü ---");
  const signatureStr = `${token}:${marker}:1:0:0:2026-03-01:${destination}:${origin}:Y:127.0.0.1`;
  const signature = crypto.createHash('md5').update(signatureStr).digest('hex');
  
  console.log(`🔑 Oluşturulan İmza: ${signature}`);
  
  // Burada sadece imzanın kabul edilip edilmediğini görmek için POST atacağız
  // (Kodun devamı karmaşık olduğu için sadece ilk cevaba bakıyoruz)
}

testAviasales();