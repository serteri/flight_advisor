import { prisma } from '@/lib/prisma';

// Tip tanımını buraya alalım veya import edelim (Genelde @/types/hybridFlight içindedir ama burada manuel tanımlayacağım garanti olsun)
interface FlightResult {
    id: string;
    source: string;
    airline: string;
    flightNumber: string;
    origin: string;
    destination: string;
    price: number;
    currency: string;
    departureTime: Date; // Date nesnesi olarak tutuyoruz
    arrivalTime: Date;
    durationMinutes: number;
    stops: number;
    // UI için ek alanlar (TypeScript hatasını çözmek için)
    from: string;
    to: string;
    departTime: string; // ISO string
    arriveTime: string; // ISO string
    duration: string;   // "3h 30m" formatı
    cabinClass: string; 
    score?: number;
    scoreReason?: string;
    amenities?: any;
    policies?: any;
    deepLink?: string;
}

export async function searchOpenClaw(params: { origin: string, destination: string, date: string }) {
  const agentBaseUrl = process.env.OPENCLAW_API_URL;

  if (!agentBaseUrl) return [];

  // 🔥 GÜNCELLEME: 8 sn yerine 60 sn beklesin (Pro olduğun için)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 Saniye

  // 🔥 GÜNCELLENMİŞ "PREMIUM ANALİST" KOMUTU
  const prompt = `
    ROL: Sen "Elite Flight Architect"sin. Sadece Premium müşteriler için çalışan, dünyanın en detaycı uçuş analistisin.

    GÖREV: ${params.origin} ile ${params.destination} arasında ${params.date} tarihindeki uçuşları bul ve "Röntgenini Çek".

    TALİMATLAR (Derinlemesine Analiz):
    1. **Uçuşları Bul:** Temel listeyi çıkar.
    2. **PREMIUM ANALİZ (Bu detaylar hayati önem taşır):**
       * **Koltuk Konforu:** Diz mesafesi (Pitch) kaç cm? (Standart 78cm). 76cm altı "Dar", 81cm üstü "Geniş".
       * **Yemek:** Sadece kraker/su mu, yoksa Sıcak Yemek (Hot Meal) var mı?
       * **Teknoloji:** Wi-Fi var mı? (Ücretli/Ücretsiz). Koltuk arkası ekran (AVOD) var mı?
       * **Bagaj:** Kargo bagajı (Checked Baggage) fiyata dahil mi? Yoksa sadece kabin mi?
       * **ESNEKLİK & STATÜ (Kritik):**
         - Bilet iade edilebilir mi? (Refundable).
         - Tarih/Saat değişikliği yapılabilir mi? (Changeable).
         - **Upgrade İmkanı:** Bu bilet sınıfı (Fare Class) mil veya parayla Business upgrade'ine açık mı? (Genelde "Eco Flex" açıktır, "Eco Promo" kapalıdır).

    3. **PUANLAMA YAP (10.0 üzerinden - ACIMASIZ OL):**
       * **Başlangıç:** 10.0 Puan.
       * **Bagaj Yoksa:** -2.0 Puan (Direkt sil!).
       * **Yemek Yoksa:** -1.0 Puan.
       * **Koltuk Darsa (<76cm):** -1.0 Puan.
       * **Upgrade Kapalıysa:** -0.5 Puan (Premium yolcu bunu sevmez).
       * **Değişiklik Yasaksa:** -1.5 Puan.
       * **Aktarma:** Her durak -1.5 Puan. Bekleme <1 saat ise -2.0 (Risk).
       * **Konfor:** Ekran varsa +0.5, Wi-Fi varsa +0.5.

    ÇIKTI FORMATI (Sadece JSON Array):
    [
      {
        "airline": "Türk Hava Yolları",
        "flightNumber": "TK1882",
        "departureTime": "YYYY-MM-DDTHH:MM",
        "arrivalTime": "YYYY-MM-DDTHH:MM",
        "price": 1250.00,
        "currency": "USD",
        "durationMinutes": 180,
        "stops": 0,
        "score": 8.9,
        "scoreReason": "Sıcak yemek, geniş bagaj ve Upgrade imkanı var. Fiyat/Performans harika.",
        "amenities": {
          "seatPitch": "81cm",
          "seatType": "Standard Recline",
          "food": "Sıcak Yemek (Dahil)",
          "wifi": true,
          "entertainment": "Kişisel Ekran (13 inç)"
        },
        "policies": {
          "baggageKg": 30,
          "cabinBagKg": 8,
          "refundable": true,
          "changeAllowed": true,
          "changeFee": "50 USD",
          "upgradeAllowed": true
        }
      }
    ]
  `;

  console.log(`🤖 OPENCLAW (PRO MOD) BAĞLANIYOR... [${agentBaseUrl}]`);

  try {
    const response = await fetch(`${agentBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        stream: false
      }),
      signal: controller.signal // Sayacı bağla
    });

    clearTimeout(timeoutId); // Cevap geldiyse sayacı durdur

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();

    let flights = [];
    try {
      flights = JSON.parse(jsonStr);
    } catch (e) {
      console.error("⚠️ Ajan JSON formatında hata yaptı:", content);
      return [];
    }

    console.log(`🤖 AJAN RAPORU: ${flights.length} PREMIUM uçuş analiz edildi.`);

    const savedFlights = [];
    for (const flight of flights) {
      // Prisma create işlemi
      const saved = await prisma.flightOption.create({
        data: {
          origin: params.origin,
          destination: params.destination,
          date: new Date(params.date),
          airline: flight.airline,
          flightNumber: flight.flightNumber || "UNKNOWN",
          departureTime: new Date(flight.departureTime),
          arrivalTime: new Date(flight.arrivalTime),
          durationMinutes: flight.durationMinutes || 0,
          stops: flight.stops || 0,
          price: parseFloat(flight.price),
          currency: flight.currency || "USD",
          score: parseFloat(flight.score),
          scoreReason: flight.scoreReason,
          amenities: flight.amenities, 
          policies: flight.policies    
        }
      });
      savedFlights.push(saved);
    }

    console.log(`✅ VERİTABANI GÜNCELLENDİ: ${savedFlights.length} uçuş.`);

    // Frontend'e dönüş (Veriler orada filtrelenecek)
    // TypeScript hatasını önlemek için tüm alanları dolduruyoruz
    return savedFlights.map(f => ({
      id: f.id,
      source: 'OPENCLAW',
      airline: f.airline,
      airlineLogo: "", // Logo URL'si eklenebilir
      flightNumber: f.flightNumber,
      
      // Temel bilgiler
      origin: f.origin,
      destination: f.destination,
      from: f.origin,       // Eksik alan eklendi
      to: f.destination,    // Eksik alan eklendi
      
      price: f.price,
      currency: f.currency,
      
      // Zamanlar (Hem Date hem String olarak)
      departureTime: f.departureTime,
      arrivalTime: f.arrivalTime,
      departTime: f.departureTime.toISOString(), // Eksik alan eklendi
      arriveTime: f.arrivalTime.toISOString(),   // Eksik alan eklendi
      
      // Süre
      durationMinutes: f.durationMinutes, // Ham veri kalsın
      duration: `${Math.floor(f.durationMinutes/60)}s ${f.durationMinutes%60}dk`, // Eksik alan eklendi
      
      stops: f.stops,
      cabinClass: "economy", // Eksik alan eklendi (Varsayılan)
      
      // Premium Detaylar
      score: f.score || 0,
      scoreReason: f.scoreReason || "",
      amenities: f.amenities,
      policies: f.policies,
      
      deepLink: "https://google.com/flights"
    }));

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn("⏳ OPENCLAW ÇOK YAVAŞ KALDI (60 sn geçti!)");
    } else {
      console.error("🔥 BAĞLANTI HATASI:", error.message);
    }
    return [];
  }
}
