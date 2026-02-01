import { prisma } from '@/lib/prisma';
import { getRealTimeFlightData } from '@/lib/flightaware';

export async function checkSegmentDisruption(segmentId: string) {
    // 1. Segment verisini çek
    const segment = await prisma.flightSegment.findUnique({
        where: { id: segmentId },
        include: { trip: true }
    });

    if (!segment) return;

    // 2. FlightAware'e Sor (Örn: TK55)
    // Not: FlightAware genelde ICAO kodu ister (THY55). Basit bir mapper gerekebilir.
    // Şimdilik IATA (TK55) ile deniyoruz, çoğu zaman çalışır.
    const ident = `${segment.airlineCode}${segment.flightNumber}`;
    const flightStatus = await getRealTimeFlightData(ident);

    if (!flightStatus) {
        console.log(`⚠️ FlightAware data not found for: ${ident}`);
        return;
    }

    // 3. Gecikme Analizi (Saniye cinsinden)
    const delaySeconds = flightStatus.arrival_delay;
    const delayMinutes = Math.floor(delaySeconds / 60);

    console.log(`✈️ [${ident}] Gecikme: ${delayMinutes} dk`);

    // Eşik Değer: 3 Saat (180 Dakika)
    if (delayMinutes >= 180) {

        // Daha önce bu alarmı oluşturduk mu? (Spam yapmayalım)
        const existingAlert = await prisma.guardianAlert.findFirst({
            where: {
                tripId: segment.tripId,
                segmentId: segment.id,
                type: 'DISRUPTION'
            }
        });

        if (!existingAlert) {
            // 🚨 ALARM OLUŞTUR
            await prisma.guardianAlert.create({
                data: {
                    tripId: segment.tripId,
                    segmentId: segment.id,
                    type: 'DISRUPTION',
                    severity: 'CRITICAL',
                    title: '💰 Tazminat Hakkı Doğdu!',
                    message: `Uçuşunuz ${delayMinutes} dakika gecikmeli görünüyor. Uluslararası kurallara göre 600€ tazminat hakkınız doğdu.`,
                    actionLabel: 'Başvuruyu Başlat',
                    potentialValue: '600 EUR'
                }
            });
            console.log(`🚨 Disruption alert created for segment ${segment.id}`);
            // Burada e-posta gönderme servisini tetikleyebilirsin
        }
    }
}
