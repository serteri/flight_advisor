// lib/airportDb.ts

// Havalimanı Konfigürasyon Tipi
interface AirportConfig {
  country: string;  // Google 'gl' parametresi (Örn: us, tr, de)
  currency: string; // Google 'currency' parametresi (Örn: USD, TRY, EUR)
  region: string;   // Bilgi amaçlı bölge ismi
}

// 🌍 GLOBAL HAVALİMANI VERİTABANI
// Buraya dünyanın en işlek havalimanlarını ekledik.
export const AIRPORT_DB: Record<string, AirportConfig> = {
  // --- 🇦🇺 OKYANUSYA (Avustralya & Y.Zelanda) ---
  'BNE': { country: 'au', currency: 'AUD', region: 'Oceania' }, // Brisbane
  'SYD': { country: 'au', currency: 'AUD', region: 'Oceania' }, // Sydney
  'MEL': { country: 'au', currency: 'AUD', region: 'Oceania' }, // Melbourne
  'PER': { country: 'au', currency: 'AUD', region: 'Oceania' }, // Perth
  'ADL': { country: 'au', currency: 'AUD', region: 'Oceania' }, // Adelaide
  'OOL': { country: 'au', currency: 'AUD', region: 'Oceania' }, // Gold Coast
  'AKL': { country: 'nz', currency: 'NZD', region: 'Oceania' }, // Auckland
  'CHC': { country: 'nz', currency: 'NZD', region: 'Oceania' }, // Christchurch

  // --- 🇹🇷 TÜRKİYE ---
  'IST': { country: 'tr', currency: 'TRY', region: 'Europe' }, // Istanbul
  'SAW': { country: 'tr', currency: 'TRY', region: 'Europe' }, // Sabiha Gökçen
  'ESB': { country: 'tr', currency: 'TRY', region: 'Europe' }, // Ankara
  'AYT': { country: 'tr', currency: 'TRY', region: 'Europe' }, // Antalya
  'ADB': { country: 'tr', currency: 'TRY', region: 'Europe' }, // Izmir
  'DLM': { country: 'tr', currency: 'TRY', region: 'Europe' }, // Dalaman
  'BJV': { country: 'tr', currency: 'TRY', region: 'Europe' }, // Bodrum

  // --- 🇪🇺 AVRUPA (EURO BÖLGESİ) ---
  'FRA': { country: 'de', currency: 'EUR', region: 'Europe' }, // Frankfurt
  'MUC': { country: 'de', currency: 'EUR', region: 'Europe' }, // Munich
  'BER': { country: 'de', currency: 'EUR', region: 'Europe' }, // Berlin
  'CDG': { country: 'fr', currency: 'EUR', region: 'Europe' }, // Paris Charles de Gaulle
  'ORY': { country: 'fr', currency: 'EUR', region: 'Europe' }, // Paris Orly
  'AMS': { country: 'nl', currency: 'EUR', region: 'Europe' }, // Amsterdam
  'FCO': { country: 'it', currency: 'EUR', region: 'Europe' }, // Rome
  'MXP': { country: 'it', currency: 'EUR', region: 'Europe' }, // Milan
  'MAD': { country: 'es', currency: 'EUR', region: 'Europe' }, // Madrid
  'BCN': { country: 'es', currency: 'EUR', region: 'Europe' }, // Barcelona
  'ATH': { country: 'gr', currency: 'EUR', region: 'Europe' }, // Athens
  'VIE': { country: 'at', currency: 'EUR', region: 'Europe' }, // Vienna

  // --- 🇬🇧 İNGİLTERE (GBP) ---
  'LHR': { country: 'uk', currency: 'GBP', region: 'Europe' }, // London Heathrow
  'LGW': { country: 'uk', currency: 'GBP', region: 'Europe' }, // London Gatwick
  'STN': { country: 'uk', currency: 'GBP', region: 'Europe' }, // London Stansted
  'MAN': { country: 'uk', currency: 'GBP', region: 'Europe' }, // Manchester

  // --- 🇺🇸 KUZEY AMERİKA (USD/CAD) ---
  'JFK': { country: 'us', currency: 'USD', region: 'Americas' }, // New York JFK
  'EWR': { country: 'us', currency: 'USD', region: 'Americas' }, // Newark
  'LAX': { country: 'us', currency: 'USD', region: 'Americas' }, // Los Angeles
  'SFO': { country: 'us', currency: 'USD', region: 'Americas' }, // San Francisco
  'MIA': { country: 'us', currency: 'USD', region: 'Americas' }, // Miami
  'ORD': { country: 'us', currency: 'USD', region: 'Americas' }, // Chicago
  'ATL': { country: 'us', currency: 'USD', region: 'Americas' }, // Atlanta
  'YYZ': { country: 'ca', currency: 'CAD', region: 'Americas' }, // Toronto
  'YVR': { country: 'ca', currency: 'CAD', region: 'Americas' }, // Vancouver

  // --- 🇦🇪 ORTA DOĞU (AED/QAR) ---
  'DXB': { country: 'ae', currency: 'AED', region: 'Middle East' }, // Dubai
  'AUH': { country: 'ae', currency: 'AED', region: 'Middle East' }, // Abu Dhabi
  'DOH': { country: 'qa', currency: 'QAR', region: 'Middle East' }, // Doha (Qatar)

  // --- 🇯🇵 ASYA (JPY/CNY/SGD...) ---
  'HND': { country: 'jp', currency: 'JPY', region: 'Asia' }, // Tokyo Haneda
  'NRT': { country: 'jp', currency: 'JPY', region: 'Asia' }, // Tokyo Narita
  'KIX': { country: 'jp', currency: 'JPY', region: 'Asia' }, // Osaka
  'SIN': { country: 'sg', currency: 'SGD', region: 'Asia' }, // Singapore
  'HKG': { country: 'hk', currency: 'HKD', region: 'Asia' }, // Hong Kong
  'BKK': { country: 'th', currency: 'THB', region: 'Asia' }, // Bangkok
  'ICN': { country: 'kr', currency: 'KRW', region: 'Asia' }, // Seoul
  'PEK': { country: 'cn', currency: 'CNY', region: 'Asia' }, // Beijing
  'PVG': { country: 'cn', currency: 'CNY', region: 'Asia' }, // Shanghai
  'DEL': { country: 'in', currency: 'INR', region: 'Asia' }, // Delhi
  'BOM': { country: 'in', currency: 'INR', region: 'Asia' }, // Mumbai
};

/**
 * Havalimanı koduna göre en uygun Google Flights ayarlarını getirir.
 * Listede yoksa varsayılan olarak ABD/USD döner.
 */
export function getAirportSettings(airportCode: string): AirportConfig {
  const code = airportCode.toUpperCase();
  const config = AIRPORT_DB[code];

  if (config) {
    return config;
  }

  // FALLBACK (Listede yoksa)
  // Eğer kod 'E' ile başlıyorsa Avrupa olma ihtimali yüksek (Basit tahmin)
  if (code.startsWith('E') && code.length === 4) { 
     return { country: 'de', currency: 'EUR', region: 'Europe' };
  }

  // Hiçbir şey bulamazsak Global Standart (USD)
  return { country: 'us', currency: 'USD', region: 'Global' };
}
