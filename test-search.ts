// test-search.ts
import { searchOpenClaw } from './services/search/providers/openClaw.ts';
import { prisma } from './lib/prisma';
import * as dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log("🚀 OpenClaw Premium Arama Testi Başlatılıyor...");
  console.log("🔍 Parametreler: BNE -> IST, 15 Haziran 2026");

  // Arama Fonksiyonunu Çağır
  const flights = await searchOpenClaw({
    origin: 'BNE',
    destination: 'IST',
    date: '2026-06-15'
  });

  console.log(`\n✅ İşlem Tamamlandı. ${flights.length} uçuş bulundu.`);

  if (flights.length > 0) {
    const firstFlight = flights[0];
    console.log(`\n✈️ İlk Uçuş: ${firstFlight.airline} (${firstFlight.flightNumber})`);
    console.log(`💰 Fiyat: ${firstFlight.price} ${firstFlight.currency}`);
    console.log(`🌟 Skor: ${firstFlight.score}/10`);
    
    // Veritabanı Kontrolü
    const dbRecord = await prisma.flightOption.findFirst({
      where: { id: firstFlight.id }
    });

    if (dbRecord) {
      console.log(`\n💾 Veritabanı Kaydı: BAŞARILI (ID: ${dbRecord.id})`);
      console.log(`🛠️ Premium Özellikler (Amenities):`, dbRecord.amenities);
      console.log(`📜 Poliçeler (Policies):`, dbRecord.policies);
    } else {
      console.error("\n❌ Veritabanında kayıt bulunamadı!");
    }
  } else {
    console.warn("\n⚠️ Hiç uçuş bulunamadı. Ngrok/API bağlantısını kontrol et.");
  }
}

runTest()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
