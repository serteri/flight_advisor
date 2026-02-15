import dotenv from 'dotenv';
dotenv.config();

async function testKiwiDirect() {
  const apiKey = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com';

  console.log(`🥝 KIWI (Real-Time) OPERASYONU BAŞLIYOR...`);
  console.log(`🔑 Host: ${apiHost}`);

  if (!apiKey) {
    console.error("⛔ API Key Yok! .env dosyasını kontrol et.");
    return;
  }

  try {
    const url = `https://${apiHost}/flights`;

    const params = new URLSearchParams({
      fly_from: 'BNE',
      fly_to: 'IST',
      date_from: '15/03/2026',
      date_to: '15/03/2026',
      adults: '1',
      curr: 'USD',
      locale: 'en'
    });

    console.log(`📡 İstek Gönderiliyor: ${url}?${params.toString()}`);

    const res = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
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
    const flights = json.data || [];
    console.log(`\n🎉 SONUÇ: ${flights.length} uçuş bulundu!`);

    if (flights.length > 0) {
      const first = flights[0];
      console.log(`✈️  Örnek: ${first.price} ${json.currency || 'USD'}`);
      console.log(`🔗 Deep Link: ${first.deep_link ? '✅ VAR' : '❌ YOK'}`);
      if (first.deep_link) {
        console.log(`👉 LİNK: ${first.deep_link.substring(0, 60)}...`);
      }
    } else {
      console.warn("⚠️ Liste boş. Tarih formatı veya rota desteklenmiyor olabilir.");
    }

  } catch (error: any) {
    console.error("🔥 KRİTİK HATA:", error?.message || error);
  }
}

testKiwiDirect();
