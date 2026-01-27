/**
 * Layover Survival Guide (Genişletilmiş Veritabanı)
 * Dünya genelindeki ana aktarma merkezlerini kapsar.
 */

export interface LayoverGuide {
    risk: 'low' | 'medium' | 'high' | 'critical';
    riskEmoji: string;
    title: string;  // Translation Key: layover.risk.critical
    advice: string; // Translation Key: layover.advice.DXB_short
    airportName: string;
    tips: string[]; // Bu kısım şimdilik İngilizce/Global kalabilir veya key'e çevrilebilir
}

// 🌍 DEVASA HAVALİMANI VERİTABANI
// Tips: Kullanıcıya anlık hayat kurtarıcı bilgiler verir.
const airportData: Record<string, { name: string; tips: string[] }> = {
    // =================================================================
    // 🇹🇷 TÜRKİYE (Detaylı)
    // =================================================================
    'IST': {
        name: 'Istanbul Airport',
        tips: ['Avrupa\'nın en yoğun havalimanlarından biri, kapıya yürümek 20dk+ sürebilir.', 'Business Lounge ve Yotel (Airside) mevcut.', 'Sigara terasları dış hatlarda mevcut.']
    },
    'SAW': {
        name: 'Sabiha Gökçen',
        tips: ['Pasaport kontrol kuyrukları yoğun olabilir.', 'Kegel Lounge dış hatlarda.', 'Şehre ulaşım metro ile mümkün (M4 hattı).']
    },
    'AYT': { name: 'Antalya Airport', tips: ['Terminal 1 ve 2 arası mesafe var, taksi gerekebilir.', 'Yazın çok kalabalık.'] },
    'ESB': { name: 'Ankara Esenboğa', tips: ['Modern ve sakin bir terminal.', 'Aktarmalar genelde hızlıdır.'] },
    'ADB': { name: 'Izmir Adnan Menderes', tips: ['İç ve dış hatlar yürüme mesafesinde.', 'TAV Primeclass Lounge mevcut.'] },

    // =================================================================
    // 🇪🇺 AVRUPA (Major Hubs)
    // =================================================================
    // 🇬🇧 UK
    'LHR': { name: 'London Heathrow', tips: ['Terminaller arası (T2, T3, T4, T5) geçiş 30-40dk sürebilir.', 'Güvenlik kontrolleri çok sıkı.', 'Elizabeth Line ile şehre hızlı ulaşım.'] },
    'LGW': { name: 'London Gatwick', tips: ['Kuzey ve Güney terminalleri arası monorail var.', 'Daha çok tatil rotaları için kullanılır.'] },
    'MAN': { name: 'Manchester Airport', tips: ['Terminaller arası yürüyüş bandı (Skywalk) var.', 'Yoğun saatlerde güvenlik yavaş olabilir.'] },

    // 🇩🇪 Almanya
    'FRA': { name: 'Frankfurt Airport', tips: ['Terminal 1 (Lufthansa) ve T2 arası Skyline treni var.', 'Çok büyük ve karmaşık, tabelaları dikkatli izle.', 'Schengen çıkışı pasaport kontrolü uzun sürebilir.'] },
    'MUC': { name: 'Munich Airport', tips: ['Terminal 2 sadece Lufthansa ve Star Alliance.', 'Havalimanı içinde bira fabrikası (Airbräu) var.', 'Dünyanın en iyi terminallerinden biri.'] },
    'BER': { name: 'Berlin Brandenburg', tips: ['Tek çatı altında T1 ve T2.', 'Şehre tren bağlantısı terminal altından.'] },

    // 🇫🇷 Fransa
    'CDG': { name: 'Paris Charles de Gaulle', tips: ['Terminaller arası (T1, T2, T3) CDGVAL treni kullanılır.', 'T2 çok karışık (2A, 2B... 2G).', 'Aktarma süresi en az 2 saat olmalı.'] },
    'ORY': { name: 'Paris Orly', tips: ['Daha küçük ve şehre daha yakın.', 'OrlyVal ile Antony istasyonuna bağlantı.'] },

    // 🇳🇱 Hollanda & Diğerleri
    'AMS': { name: 'Amsterdam Schiphol', tips: ['Tek bina konsepti, terminal değişimi yok ama yürüyüş uzun.', 'Rijksmuseum\'un küçük bir şubesi var.', 'Güvenlik kapıda değil, merkezi.'] },
    'ZRH': { name: 'Zurich Airport', tips: ['Heidi Express treni ile E kapısına geçiş.', 'Çok temiz, hızlı ve verimli.', 'Çikolata dükkanları bolca mevcut.'] },
    'VIE': { name: 'Vienna International', tips: ['Skylink terminali modern.', 'Aktarmalar genelde 30-40 dakikada biter.', 'Viyana kahvesi içmeden geçme.'] },
    'MAD': { name: 'Madrid Barajas', tips: ['T4 ve T4S arası tren bağlantısı var.', 'T4 mimarisi ödüllü ama çok uzun.', 'İspanya içi uçuşlar için T1-2-3 kullanılır.'] },
    'BCN': { name: 'Barcelona El Prat', tips: ['T1 (Yeni) ve T2 (Eski) arası otobüs var.', 'Vueling uçuşları genelde T1.'] },
    'FCO': { name: 'Rome Fiumicino', tips: ['Terminal 1 ve 3 ana terminaller.', 'Pasaport kontrolü (E-Gates) hızlı çalışıyor.', 'İtalyan yemekleri için Eataly mevcut.'] },
    'MXP': { name: 'Milan Malpensa', tips: ['Şehre uzak, Malpensa Express kullanın.', 'T1 ve T2 arası mesafe uzun.'] },

    // =================================================================
    // 🕌 ORTADOĞU (Aktarma Kralları)
    // =================================================================
    'DXB': { name: 'Dubai International', tips: ['T3 sadece Emirates/Qantas.', 'T1 ve T3 arası metro var.', 'Ücretsiz "Sleep Pod"lar mevcut.', 'Çok yoğun, kapıya gitmek 30dk sürebilir.'] },
    'DOH': { name: 'Hamad International', tips: ['Dünyanın en iyi havalimanı seçildi.', '"The Orchard" tropik bahçesini gez.', 'Sessiz terminal konsepti (anons yapılmaz, ekranı takip et).'] },
    'AUH': { name: 'Abu Dhabi Zayed Intl', tips: ['Yeni Terminal A açıldı, çok modern.', 'ABD uçuşları için "US Preclearance" var (Pasaportu burada geçiyorsun).'] },
    'JED': { name: 'Jeddah King Abdulaziz', tips: ['Yeni terminal (T1) modern.', 'Hac/Umre terminali ayrı.', 'Alkol satışı ve tüketimi yasak.'] },
    'RUH': { name: 'Riyadh King Khalid', tips: ['Terminaller yenileniyor.', 'Suudi Arabistan transit vizesi gerekebilir.'] },

    // =================================================================
    // 🇺🇸 KUZEY AMERİKA (USA & Kanada)
    // =================================================================
    'JFK': { name: 'New York JFK', tips: ['Terminaller birbirine bağlı değil, AirTrain kullanmalısın.', 'Pasaport kontrolü 1-2 saat sürebilir.', 'T5 (JetBlue) ve T4 (Delta/Intl) çok yoğun.'] },
    'EWR': { name: 'Newark Liberty', tips: ['Manhattan\'a trenle ulaşım JFK\'den daha kolay olabilir.', 'United Airlines ana merkezi.'] },
    'LAX': { name: 'Los Angeles Intl', tips: ['"U" şeklinde trafik kabusu.', 'Tom Bradley (TBIT) ana dış hatlar terminali.', 'Terminaller arası yürümek mümkün ama karışık.'] },
    'SFO': { name: 'San Francisco Intl', tips: ['AirTrain ile terminaller arası geçiş.', 'Sis yüzünden rötarlar sık yaşanır.', 'Yoga odası mevcut.'] },
    'ORD': { name: 'Chicago O\'Hare', tips: ['Terminal 5 dış hatlar, diğerleri iç hat.', 'T5\'ten diğerlerine geçiş için ATS treni şart.', 'Kışın kar fırtınası riski yüksek.'] },
    'ATL': { name: 'Atlanta Hartsfield', tips: ['Dünyanın en yoğun havalimanı.', 'Yeraltı "Plane Train" ile terminalleri gez.', 'Delta\'nın ana kalesi.'] },
    'DFW': { name: 'Dallas Fort Worth', tips: ['Skylink treni ile terminal değişimi çok hızlı.', 'American Airlines ana merkezi.', 'Çok büyük ama verimli.'] },
    'MIA': { name: 'Miami International', tips: ['Latin Amerika uçuşlarının merkezi.', 'Pasaport kontrolü çok yavaş olabilir.', 'Skytrain arızalı olabilir, yürümeye hazır ol.'] },
    'YYZ': { name: 'Toronto Pearson', tips: ['T1 (Air Canada) ve T3 arası Link Train.', 'ABD uçuşları için "Preclearance" var (Erken gitmelisin).'] },
    'YVR': { name: 'Vancouver International', tips: ['Doğasıyla ünlü, akvaryum var.', 'Asya-Amerika aktarmaları için popüler.'] },

    // =================================================================
    // 🌏 ASYA (Pasifik & Uzak Doğu)
    // =================================================================
    'SIN': { name: 'Singapore Changi', tips: ['Havalimanı içinde şelale (Jewel), sinema ve havuz var.', 'Tüm terminaller birbirine bağlı.', 'Güvenlik kapı girişinde (Gate Security).'] },
    'HKG': { name: 'Hong Kong Intl', tips: ['Adaya inşa edilmiş, çok verimli.', 'Şehre Airport Express ile 24dk.', 'Cathay Pacific ana merkezi.'] },
    'NRT': { name: 'Tokyo Narita', tips: ['Şehre uzak (1 saat+).', 'Terminaller arası otobüs var.', 'Japonya\'ya giriş yapacaksan parmak izi alınır.'] },
    'HND': { name: 'Tokyo Haneda', tips: ['Şehre çok yakın.', 'Daha modern ve tercih edilen havalimanı.', 'Edo Market\'te yemek yiyebilirsin.'] },
    'ICN': { name: 'Seoul Incheon', tips: ['Ücretsiz duşlar, uyku alanları ve kültür merkezi var.', 'Robotlar yardımcı oluyor.', 'Servis kalitesi çok yüksek.'] },
    'BKK': { name: 'Bangkok Suvarnabhumi', tips: ['Tek ama devasa bir terminal.', 'Pasaport kontrolü çok yoğun olabilir.', 'Masaj salonları Airside kısmında mevcut.'] },
    'KUL': { name: 'Kuala Lumpur Intl', tips: ['KLIA1 (Full Service) ve KLIA2 (Low Cost) arası tren var.', 'Orman yürüyüş yolu (Jungle Boardwalk) terminal içinde.'] },
    'MNL': { name: 'Manila Ninoy Aquino', tips: ['Terminaller arası geçiş taksiyle trafikten dolayı zor olabilir.', 'T3 en modern terminal.'] },
    'DEL': { name: 'Delhi Indira Gandhi', tips: ['T3 ana dış hatlar terminali.', 'Vize kuralları katı, transit vizeyi kontrol et.', 'Girişte bilet/pasaport kontrolü yapılır.'] },
    'BOM': { name: 'Mumbai Chhatrapati', tips: ['T2 (Yeni) terminali sanat müzesi gibi.', 'Şehir trafiği çok yoğun, erken git.'] },

    // Çin (Vize kurallarına dikkat)
    'PEK': { name: 'Beijing Capital', tips: ['T3 devasa, trenle ulaşım var.', 'Güvenlik çok sıkı (Powerbank kapasitesine dikkat).'] },
    'PKX': { name: 'Beijing Daxing', tips: ['Yeni "Deniz Yıldızı" havalimanı.', 'Mimari harikası, çok verimli.'] },
    'PVG': { name: 'Shanghai Pudong', tips: ['T1 ve T2 arası yürünebilir veya shuttle.', 'Maglev treni ile şehre 430km/h hızla gidilir.'] },
    'CAN': { name: 'Guangzhou Baiyun', tips: ['Çin\'in güney kapısı.', '72/144 saat vizesiz geçiş imkanı olabilir.'] },

    // =================================================================
    // 🦘 OKYANUSYA (Avustralya & NZ)
    // =================================================================
    'SYD': { name: 'Sydney Kingsford Smith', tips: ['T1 (Dış) ve T2/T3 (İç) arası tren/otobüs şart (Pistlerin öbür tarafında).', 'Gece uçuş yasağı (Curfew) var.', 'Pasaport kontrolü otomatik (SmartGate).'] },
    'MEL': { name: 'Melbourne Tullamarine', tips: ['Tüm terminaller (T1-T4) tek çatı altında, yürünebilir.', 'SkyBus ile şehre ulaşım kolay.'] },
    'BNE': { name: 'Brisbane Airport', tips: ['İç ve Dış hatlar terminalleri arası tren (Airtrain) veya otobüs var.', 'Queensland\'e girişlerde biyogüvenlik sıkı.'] },
    'PER': { name: 'Perth Airport', tips: ['T1/T2 ve T3/T4 pistin zıt taraflarında. Otobüsle 15dk sürer.', 'Qantas Londra uçuşlarının merkezi.'] },
    'AKL': { name: 'Auckland Airport', tips: ['İç ve dış hatlar arası 10dk yürüyüş (Yeşil yol).', 'Biyogüvenlik çok sıkı (Yiyecek sokma!).'] },

    // =================================================================
    // 💃 GÜNEY AMERİKA
    // =================================================================
    'GRU': { name: 'São Paulo Guarulhos', tips: ['Güney Amerika\'nın ana giriş kapısı.', 'T3 en modern terminal.', 'Terminal değişimi kafa karıştırıcı olabilir.'] },
    'BOG': { name: 'Bogota El Dorado', tips: ['Rakım yüksek (2600m), nefes darlığı olabilir.', 'Modern ve verimli bir terminal.'] },
    'SCL': { name: 'Santiago de Chile', tips: ['Yeni dış hatlar terminali açıldı.', 'Pasaport kontrolü yoğun olabilir.'] },
    'EZE': { name: 'Buenos Aires Ezeiza', tips: ['Şehre uzak (45dk+).', 'Duty free mağazaları gelişmiş.'] },
    'LIM': { name: 'Lima Jorge Chávez', tips: ['Tek terminal, çok yoğun.', 'Güney Amerika aktarmaları için merkezi konum.'] },

    // =================================================================
    // 🦁 AFRİKA
    // =================================================================
    'JNB': { name: 'Johannesburg O.R. Tambo', tips: ['Afrika\'nın en yoğun havalimanı.', 'Güvenlik konusunda dikkatli olun.', 'Gautrain ile şehre güvenli ulaşım.'] },
    'CPT': { name: 'Cape Town Intl', tips: ['Modern ve güvenli.', 'Şehre yakın.', 'Rüzgar nedeniyle inişler sarsıntılı olabilir.'] },
    'CAI': { name: 'Cairo International', tips: ['T2 ve T3 yeni ve modern, T1 eski.', 'Bahşiş kültürü yaygın.', 'Trafik kaotik.'] },
    'ADD': { name: 'Addis Ababa Bole', tips: ['Ethiopian Airlines merkezi.', 'Rakım yüksek.', 'Terminal 2 yeni genişletildi.'] },
    'CMN': { name: 'Casablanca Mohammed V', tips: ['Afrika-Avrupa/ABD aktarmaları için popüler.', 'Pasaport kontrolü yavaş olabilir.'] }
};

export function getLayoverGuide(airportCode: string, durationMinutes: number): LayoverGuide {
    // 1. Havalimanı verisini çek (Yoksa Generic oluştur)
    const data = airportData[airportCode] || {
        name: airportCode,
        tips: ['Uluslararası bir havalimanı.', 'Uçuş kapını ekranlardan takip et.', 'En az 2 saat önce kapıda ol.']
    };

    // 2. Risk Seviyesi Belirle
    let risk: LayoverGuide['risk'];
    let riskEmoji: string;
    let titleKey: string;

    // Özel durumlar (Örn: LHR, JFK gibi büyük yerlerde min süre daha uzun olmalı)
    const massiveAirports = ['LHR', 'JFK', 'LAX', 'CDG', 'PEK', 'MNL'];
    const criticalThreshold = massiveAirports.includes(airportCode) ? 90 : 60;
    const highThreshold = massiveAirports.includes(airportCode) ? 120 : 90;

    if (durationMinutes < criticalThreshold) {
        risk = 'critical';
        riskEmoji = '🔴';
        titleKey = 'layover.risk.critical'; // "Çok Riskli!"
    } else if (durationMinutes < highThreshold) {
        risk = 'high';
        riskEmoji = '🟠';
        titleKey = 'layover.risk.high'; // "Acele Et"
    } else if (durationMinutes < 180) {
        risk = 'medium';
        riskEmoji = '🟡';
        titleKey = 'layover.risk.medium'; // "Yeterli Zaman"
    } else {
        risk = 'low';
        riskEmoji = '🟢';
        titleKey = 'layover.risk.low'; // "Keyfine Bak"
    }

    // 3. Tavsiye Key'i Oluştur
    // "layover.advice.DXB_short" gibi bir key oluşturur.
    const isSpecialAirport = ['DXB', 'DOH', 'IST', 'SIN', 'LHR', 'JFK'].includes(airportCode);

    let durationCat = 'long';
    if (durationMinutes < highThreshold) durationCat = 'short';
    else if (durationMinutes < 180) durationCat = 'medium';

    const prefix = isSpecialAirport ? airportCode : 'default';
    const adviceKey = `layover.advice.${prefix}_${durationCat}`;

    return {
        risk,
        riskEmoji,
        title: titleKey,
        advice: adviceKey,
        airportName: data.name,
        tips: data.tips // Şimdilik hardcoded string dizisi
    };
}

// Yardımcı fonksiyon: Sadece isim almak için
export function getAirportName(code: string): string {
    return airportData[code]?.name || code;
} 