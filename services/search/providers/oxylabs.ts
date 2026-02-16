import { FlightResult } from '@/types/hybridFlight';

// 1. GÜVENLİK: Şifreleri sadece .env dosyasından çekiyoruz
const OXY_USER = process.env.OXYLABS_USERNAME;
const OXY_PASS = process.env.OXYLABS_PASSWORD;

// Auth Token (Basic Auth)
const AUTH = OXY_USER && OXY_PASS ? Buffer.from(`${OXY_USER}:${OXY_PASS}`).toString('base64') : '';

// --- AKILLI KONUM VE PARA BİRİMİ MOTORU ---
// Kalkış havalimanına göre kullanıcıya uygun para birimi ve lokasyonu seçer.
function getSmartContext(origin: string) {
  const originCode = origin.toUpperCase();

  // Avustralya Şehirleri (Genişletilebilir)
  if (['BNE', 'SYD', 'MEL', 'PER', 'ADL', 'OOL', 'CBR'].includes(originCode)) {
    return { location: "Australia", currency: "AUD", gl: "au" };
  }
  // Türkiye Şehirleri
  if (['IST', 'SAW', 'ESB', 'AYT', 'ADB'].includes(originCode)) {
    return { location: "Turkey", currency: "TRY", gl: "tr" };
  }
  // İngiltere
  if (['LHR', 'LGW', 'MAN', 'STN'].includes(originCode)) {
    return { location: "United Kingdom", currency: "GBP", gl: "uk" };
  }
  // Avrupa (Genel - Euro Bölgesi)
  if (['CDG', 'FRA', 'AMS', 'MUC', 'FCO'].includes(originCode)) {
    return { location: "Germany", currency: "EUR", gl: "de" };
  }

  // Varsayılan: Amerika / USD
  return { location: "United States", currency: "USD", gl: "us" };
}

export async function searchOxylabs(params: any): Promise<FlightResult[]> {
  // Güvenlik Kontrolü
  if (!OXY_USER || !OXY_PASS) {
    console.warn("⚠️ Oxylabs kimlik bilgileri .env dosyasında eksik! Arama atlanıyor.");
    return [];
  }

  // Akıllı Context'i Hesapla
  const context = getSmartContext(params.origin);
  console.log(`🦁 Oxylabs: Searching from ${context.location} using ${context.currency}...`);

  try {
    const dateStr = params.date.split('T')[0];

    // Oxylabs API Gövdesi
    const body = {
      source: "google_search", 
      domain: "com", // google.com.au yerine google.com kullanıp parametreyle yönetmek daha stabil
      // Sorguyu manipüle edip para birimini zorluyoruz: "Flights from BNE to IST in AUD"
      query: `flights from ${params.origin} to ${params.destination} on ${dateStr} in ${context.currency}`,
      parse: true,
      
      // Dinamik Lokasyon Ayarları
      geo_location: context.location, // Örn: "Australia"
      context: [
        { key: "results_language", value: "en" }, // Dil hep İngilizce olsun (Global app)
        { key: "gl", value: context.gl },         // Google Bölgesi (au, tr, us)
        { key: "safe_search", value: "off" }
      ]
    };

    const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${AUTH}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error("🔥 Oxylabs API Error:", response.status, await response.text());
      return [];
    }

    const json = await response.json();
    
    // Google'dan dönen veriyi yakala
    // Not: "google_search" kaynağı kullandığımız için veri 'organic_results' veya 'knowledge_graph' içinde olabilir.
    // Oxylabs uçuş widget'ını bazen özel bir yapıda döner.
    const content = json.results?.[0]?.content || {};
    
    console.log(`✅ Oxylabs Response Received. Parsing results for ${context.currency}...`);

    // --- PARSING (AYIKLAMA) MANTIĞI ---
    // Burası Google'ın o anki HTML yapısına göre değişebilir.
    // Şimdilik gelen veriyi simüle edip boş dönüyoruz.
    // Gerçek veriyi gördüğümüzde burayı "map" fonksiyonu ile dolduracağız.
    
    /* Eğer Oxylabs başarılı bir şekilde Google Flights widget'ını parse ettiyse,
       burada 'flights' dizisi olur. Olmazsa HTML'den kendimiz çıkarmalıyız.
       Şimdilik hata vermemesi için boş dizi dönüyoruz.
    */

    return []; 

  } catch (error) {
    console.error("🔥 Oxylabs Connection Failed:", error);
    return [];
  }
}
