import { FlightResult } from '@/types/hybridFlight';

// 1. GÜVENLİK: Şifreleri .env dosyasından al
const OXY_USER = process.env.OXYLABS_USERNAME;
const OXY_PASS = process.env.OXYLABS_PASSWORD;
const AUTH = OXY_USER && OXY_PASS ? Buffer.from(`${OXY_USER}:${OXY_PASS}`).toString('base64') : '';

console.log(`[oxylabs.ts INIT] OXY_USER: ${OXY_USER ? 'SET' : 'NOT SET'}, OXY_PASS: ${OXY_PASS ? 'SET' : 'NOT SET'}`);

// --- GLOBAL AKILLI KONUM VE PARA BİRİMİ MOTORU ---
function getSmartContext(origin: string) {
  const code = origin.toUpperCase();
  
  // MAJOR HUB'lar
  const AIRPORT_MAP: Record<string, { location: string; currency: string; gl: string }> = {
    // 🇦🇺 Avustralya & 🇳🇿 Yeni Zelanda
    'BNE': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'SYD': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'MEL': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'PER': { location: 'Australia', currency: 'AUD', gl: 'au' },
    'AKL': { location: 'New Zealand', currency: 'NZD', gl: 'nz' },

    // 🇹🇷 Türkiye
    'IST': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'SAW': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'ESB': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'AYT': { location: 'Turkey', currency: 'TRY', gl: 'tr' },
    'ADB': { location: 'Turkey', currency: 'TRY', gl: 'tr' },

    // 🇬🇧 İngiltere
    'LHR': { location: 'United Kingdom', currency: 'GBP', gl: 'uk' },
    'LGW': { location: 'United Kingdom', currency: 'GBP', gl: 'uk' },
    'MAN': { location: 'United Kingdom', currency: 'GBP', gl: 'uk' },

    // 🇪🇺 Avrupa (Euro Bölgesi)
    'CDG': { location: 'France', currency: 'EUR', gl: 'fr' },
    'FRA': { location: 'Germany', currency: 'EUR', gl: 'de' },
    'MUC': { location: 'Germany', currency: 'EUR', gl: 'de' },
    'AMS': { location: 'Netherlands', currency: 'EUR', gl: 'nl' },
    'FCO': { location: 'Italy', currency: 'EUR', gl: 'it' },
    'MAD': { location: 'Spain', currency: 'EUR', gl: 'es' },
    'BCN': { location: 'Spain', currency: 'EUR', gl: 'es' },

    // 🇺🇸 Amerika & 🇨🇦 Kanada
    'JFK': { location: 'United States', currency: 'USD', gl: 'us' },
    'LAX': { location: 'United States', currency: 'USD', gl: 'us' },
    'MIA': { location: 'United States', currency: 'USD', gl: 'us' },
    'SFO': { location: 'United States', currency: 'USD', gl: 'us' },
    'YYZ': { location: 'Canada', currency: 'CAD', gl: 'ca' },
    'YVR': { location: 'Canada', currency: 'CAD', gl: 'ca' },

    // 🇦🇪 Orta Doğu
    'DXB': { location: 'United Arab Emirates', currency: 'AED', gl: 'ae' },
    'AUH': { location: 'United Arab Emirates', currency: 'AED', gl: 'ae' },
    'DOH': { location: 'Qatar', currency: 'QAR', gl: 'qa' },

    // 🇯🇵 Asya
    'HND': { location: 'Japan', currency: 'JPY', gl: 'jp' },
    'NRT': { location: 'Japan', currency: 'JPY', gl: 'jp' },
    'SIN': { location: 'Singapore', currency: 'SGD', gl: 'sg' },
    'BKK': { location: 'Thailand', currency: 'THB', gl: 'th' },
    'HKG': { location: 'Hong Kong', currency: 'HKD', gl: 'hk' },
    'PEK': { location: 'China', currency: 'CNY', gl: 'cn' },
    'PVG': { location: 'China', currency: 'CNY', gl: 'cn' },
    'ICN': { location: 'South Korea', currency: 'KRW', gl: 'kr' },
  };

  if (AIRPORT_MAP[code]) {
    return AIRPORT_MAP[code];
  }

  // Varsayılan: Amerika / USD
  return { location: 'United States', currency: 'USD', gl: 'us' };
}

export async function searchOxylabs(params: any): Promise<FlightResult[]> {
  console.log(`\n🦁 OXYLABS SEARCH START`);
  console.log(`  Origin: ${params.origin}`);
  console.log(`  Destination: ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  // Şifre kontrolü
  if (!OXY_USER || !OXY_PASS) {
    console.warn("⚠️ Oxylabs kimlik bilgileri eksik! USER=" + OXY_USER + ", PASS=" + OXY_PASS);
    return [];
  }

  const context = getSmartContext(params.origin);
  console.log(`  Context: ${context.location} / ${context.currency}`);

  try {
    const dateStr = params.date.split('T')[0];

    // Oxylabs API İsteği
    const body = {
      source: 'google_search',
      domain: 'com',
      query: `flights from ${params.origin} to ${params.destination} on ${dateStr}`,
      parse: true,
      geo_location: context.location,
      context: [
        { key: 'results_language', value: 'en' },
        { key: 'gl', value: context.gl }
      ]
    };

    console.log(`📡 Sending request to Oxylabs...`);

    const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${AUTH}`
      },
      body: JSON.stringify(body)
    });

    console.log(`  Response Status: ${response.status}`);

    if (!response.ok) {
      const errText = await response.text();
      console.error("🔥 Oxylabs API Error:", response.status, errText.substring(0, 200));
      return [];
    }

    const json = await response.json();

    // --- DEBUG: Gelen veriyi analiz et ---
    const results = json.results?.[0] || {};
    const content = results.content || {};

    console.log("\n--------------------------------------------------");
    console.log("📦 OXYLABS HAM VERİ ANALİZİ:");
    console.log("  Anahtarlar:", Object.keys(content));
    console.log("  JSON Özeti:", JSON.stringify(content).substring(0, 500));
    console.log("--------------------------------------------------\n");

    return [];

  } catch (error) {
    console.error("🔥 Oxylabs Fail:", error);
    return [];
  }
}
