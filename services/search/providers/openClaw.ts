import { prisma } from '@/lib/prisma';

// Tip tanımı
interface FlightResult {
    id: string;
    source: string;
    airline: string;
    airlineLogo: string;
    flightNumber: string;
    origin: string;
    destination: string;
    price: number;
    currency: string;
    departureTime: Date;
    arrivalTime: Date;
    durationMinutes: number;
    stops: number;
    from: string;
    to: string;
    departTime: string;
    arriveTime: string;
    duration: string;
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); 

  const prompt = `
    ROL: Sen "Elite Flight Architect"sin. Sadece Premium müşteriler için çalışan, dünyanın en detaycı uçuş analistisin.
    GÖREV: ${params.origin} ile ${params.destination} arasında ${params.date} tarihindeki uçuşları bul.
    ÇIKTI FORMATI (Sadece JSON Array):
    [{"airline": "Havayolu", "price": 100, "currency": "USD", "flightNumber": "TK123", "departureTime": "YYYY-MM-DDTHH:MM", "arrivalTime": "YYYY-MM-DDTHH:MM", "durationMinutes": 180, "stops": 0, "score": 9.0, "scoreReason": "...", "amenities": {}, "policies": {}}]
  `;

  console.log(`🤖 OPENCLAW (PRO MOD) BAĞLANIYOR... [${agentBaseUrl}]`);

  try {
    const response = await fetch(`${agentBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // 🔥 İŞTE SİHİRLİ ANAHTAR!
        'User-Agent': 'OpenClaw-Agent/1.0'    // Bazı firewall'lar için
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errText = await response.text();
        console.error(`🔥 OPENCLAW HATA: ${response.status} - ${errText.substring(0, 100)}`);
        return [];
    }

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

    // TypeScript'e uygun dönüş
    return savedFlights.map(f => ({
      id: f.id,
      source: 'OPENCLAW',
      airline: f.airline,
      airlineLogo: "", 
      flightNumber: f.flightNumber,
      origin: f.origin,
      destination: f.destination,
      from: f.origin,
      to: f.destination,
      price: f.price,
      currency: f.currency,
      departureTime: f.departureTime,
      arrivalTime: f.arrivalTime,
      departTime: f.departureTime.toISOString(),
      arriveTime: f.arrivalTime.toISOString(),
      durationMinutes: f.durationMinutes,
      duration: `${Math.floor(f.durationMinutes/60)}s ${f.durationMinutes%60}dk`,
      stops: f.stops,
      cabinClass: "economy",
      score: f.score || 0,
      scoreReason: f.scoreReason || "",
      amenities: f.amenities,
      policies: f.policies,
      deepLink: "https://google.com/flights" // Burayı daha sonra özelleştirebiliriz
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
