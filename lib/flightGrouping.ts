import { FlightForScoring } from './flightScoreEngine';

export interface FlightGroup {
    id: string;              // Grubun unique ID'si (Main flight ID)
    mainFlight: FlightForScoring;      // Kartta gösterilecek "Kazanan" (En yüksek puanlı)
    options: FlightForScoring[];       // O uçağın tüm varyasyonları (Saver, Flex vb.)
    totalOptions: number;
    cheapestPrice: number;
}

/**
 * Aynı uçağın farklı fiyat/paket opsiyonlarını gruplar.
 * Ana kartta "En Mantıklı" (Yüksek Puanlı) olanı gösterir.
 */
export function groupFlights(flights: FlightForScoring[]): FlightGroup[] {
    const groups: Record<string, FlightForScoring[]> = {};

    // 1. FİZİKSEL UÇAKLARI GRUPLA
    for (const f of flights) {
        // Unique Key: Kalkış + Varış + Carrier (Codeshare'leri ayırmak isteyebiliriz veya birleştirebiliriz)
        // Kullanıcı isteği: "departureTime_arrivalTime" (Codeshare birleşsin)
        // Ancak Carrier farklıysa (Codeshare marketing carrier) frontend'de kafa karışıklığı yaratabilir.
        // Şimdilik Carrier'ı da dahil edelim ki "Aynı Havayolu" altındaki paketler gruplansın.
        // China Southern Saver vs China Southern Flex.
        // Codeshare (QF vs EK) ayrı gruplar olmalı çünkü farklı havayolları farklı deneyim/kurallar sunar.

        const key = `${f.carrier}_${f.departureTime}_${f.arrivalTime}`;

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(f);
    }

    // 2. KAZANANI SEÇ (The Winner Selection)
    const flightGroups: FlightGroup[] = [];

    Object.values(groups).forEach(groupOptions => {
        // Seçenekleri puana göre sırala (En yüksek puanlı = En mantıklı Fiyat/Kalite dengesi)
        // scoreFlightsStrict zaten sıralamış olabilir ama garantiye alalım.
        groupOptions.sort((a, b) => (b.score || 0) - (a.score || 0));

        // Grubun "Ana Kartı" (Main Flight) en yüksek puanlı olan seçilir.
        // ÖRNEK: Flex (8.5 puan), Saver (8.0 puan) -> Flex gösterilir.
        const winner = groupOptions[0];

        // Seçenekleri fiyata göre diz (Kullanıcı "Diğer Seçenekler" listesinde ucuzdan pahalıya görsün)
        const sortedOptions = [...groupOptions].sort((a, b) => (a.effectivePrice || a.price) - (b.effectivePrice || b.price));

        // Grubu oluştur
        flightGroups.push({
            id: winner.id,
            mainFlight: winner,
            options: sortedOptions,
            totalOptions: groupOptions.length,
            cheapestPrice: sortedOptions[0].effectivePrice || sortedOptions[0].price
        });
    });

    // 3. GRUPLARI SIRALA (Listeleme Sırası)
    // Ana uçuşu en yüksek puanlı olan grup en üste gelir.
    return flightGroups.sort((a, b) => (b.mainFlight.score || 0) - (a.mainFlight.score || 0));
}
