import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const queryLat = searchParams.get('lat');
    const queryLon = searchParams.get('lon');

    // Varsayılan değerler (Hata durumunda Brisbane dönecek)
    let lat: number | null = -27.47; // Brisbane Lat
    let lon: number | null = 153.02; // Brisbane Lon
    let city = "Brisbane";
    let country = "Australia";
    let isFallback = false;

    // 1. Önce Explicit Lat/Lon (Tarayıcı GPS'i) var mı?
    if (queryLat && queryLon) {
        lat = parseFloat(queryLat);
        lon = parseFloat(queryLon);
        console.log(`[Geo API] Explicit coordinates received: ${lat}, ${lon}`);

        // Reverse Geocoding (Şehir ismini bul)
        try {
            // ⏱️ TIMEOUT EKLEMESİ: 3 saniye bekle, cevap yoksa iptal et.
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
                { 
                    headers: { 
                        'User-Agent': 'FlightAI-App/1.0', // OSM bunu şart koşar
                        'Accept-Language': 'en-US'
                    },
                    signal: controller.signal // İsteği iptal edilebilir yap
                }
            );
            
            clearTimeout(timeoutId); // Zamanlayıcıyı temizle

            if (!response.ok) throw new Error("OSM API Error");

            const data = await response.json();
            
            // Şehir verisini güvenli çek
            city = data?.address?.city || 
                   data?.address?.town || 
                   data?.address?.village || 
                   data?.address?.suburb || // Brisbane'de semtler (Albion gibi) suburb dönebilir
                   "Brisbane"; // Bulamazsa varsayılan
            
            country = data?.address?.country || "Australia";

        } catch (error) {
            console.error('[Geo API] Reverse geocoding failed (Using Fallback):', error);
            // Hata olsa bile kod durmaz, yukarıdaki varsayılan "Brisbane" değerlerini korur.
            isFallback = true;
        }
    } 
    // 2. Fallback: IP Detection (Eğer koordinat gelmediyse)
    else {
        try {
            let ip = req.headers.get('x-forwarded-for') as string || req.headers.get('x-real-ip') as string || '';

            // Localhost kontrolü
            if (ip === '::1' || ip === '127.0.0.1' || !ip) {
                ip = ''; 
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000); // IP servisi için 2 sn yeter

            const ipApiUrl = ip ? `http://ip-api.com/json/${ip}` : 'http://ip-api.com/json/';
            const response = await fetch(ipApiUrl, {
                headers: { 'User-Agent': 'FlightAI-App/1.0' },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            const data = await response.json();

            if (data.status === 'success') {
                lat = data.lat;
                lon = data.lon;
                city = data.city || "Brisbane";
                country = data.country || "Australia";
            }
        } catch (error) {
            console.error('[Geo API] IP detection failed (Using Fallback):', error);
            isFallback = true;
        }
    }

    // Sonuç Dönüşü
    return NextResponse.json({
        detected: true, // Her zaman true dön ki UI yüklensin
        city,
        country,
        isFallback, // UI'da gerekirse "Konum tahmin edildi" uyarısı için
        location: {
            city,
            country,
            latitude: lat,
            longitude: lon
        }
    });
}