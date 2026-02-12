export async function searchOpenClaw(params: { origin: string, destination: string, date: string }) {
  // Vercel'deki Ngrok adresi
  const agentBaseUrl = process.env.OPENCLAW_API_URL;

  if (!agentBaseUrl) {
    console.error("❌ OPENCLAW URL YOK! Ngrok adresini Vercel'e ekle.");
    return [];
  }

  // Ajan'a emir veriyoruz
  const prompt = `
    TASK: Find flight prices from ${params.origin} to ${params.destination} on ${params.date}.
    ROLE: You are a flight search API.
    OUTPUT: Return ONLY a JSON array. No text.
    FORMAT: [{"airline": "Name", "price": "100", "currency": "USD", "departureTime": "HH:MM", "duration": "2h 30m"}]
  `;

  console.log(`🤖 OPENCLAW BAĞLANIYOR... [${agentBaseUrl}]`);

  try {
    // OpenClaw genelde OpenAI formatını taklit eder.
    const response = await fetch(`${agentBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a flight search engine that outputs raw JSON." },
          { role: "user", content: prompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      console.error(`🔥 OPENCLAW HATA: ${response.status} (Endpoint yanlış olabilir)`);
      const errText = await response.text();
      console.error("Detay:", errText);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || data.response || "";
    console.log("🤖 AJAN CEVABI:", content.substring(0, 100) + "...");

    // JSON Temizliği
    const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
    let flights = [];
    try {
      flights = JSON.parse(jsonStr);
    } catch (e) {
      console.warn("⚠️ Ajan JSON vermedi.");
      return [];
    }

    if (!Array.isArray(flights)) return [];

    console.log(`✅ OPENCLAW: ${flights.length} uçuş buldu!`);

    return flights.map((f: any, i: number) => ({
      id: `OC_${i}`,
      source: 'OPENCLAW',
      airline: f.airline || "AI Agent",
      airlineLogo: "",
      flightNumber: "AI-101",
      origin: params.origin,
      destination: params.destination,
      price: f.price?.toString().replace(/[^0-9.]/g, '') || "0",
      currency: 'USD',
      departureTime: `${params.date}T${f.departureTime || '00:00'}:00`,
      arrivalTime: `${params.date}T${f.arrivalTime || '00:00'}:00`,
      duration: f.duration || "Normal",
      stops: 0,
      amenities: {
        hasWifi: false,
        hasMeal: false,
        baggage: "Bot"
      },
      deepLink: "https://google.com/flights"
    }));
  } catch (error) {
    console.error("🔥 TÜNEL HATASI:", error);
    return [];
  }
}
