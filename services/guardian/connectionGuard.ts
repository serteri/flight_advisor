
import { prisma } from '@/lib/prisma';

export async function checkConnectionRisk(tripId: string) {
    // Trip'in tüm bacaklarını sırasıyla çek
    const segments = await prisma.flightSegment.findMany({
        where: { tripId },
        orderBy: { segmentOrder: 'asc' }
    });

    // Eğer tek uçuşsa aktarma yoktur, çık.
    if (segments.length < 2) return;

    // Döngü: Her bacak ile bir sonrakini kıyasla
    for (let i = 0; i < segments.length - 1; i++) {
        const currentFlight = segments[i];
        const nextFlight = segments[i + 1];

        // 1. Gerçek İniş Saatini Tahmin Et (Scheduled + Rötar varsa)
        // (Burada FlightAware'den gelen gerçek durumu kontrol etmemiz gerekir ama model basitliği için
        // şimdilik 'currentFlight.arrivalDate' kullanıyoruz. İleride 'actualArrivalDate' veya benzeri eklenebilir)
        // Simülasyon: FlightAware datasını henüz DB'ye "actual_arrival" olarak işlemiyoruz,
        // ama bu fonksiyonu çağırmadan önce disruption check yapıp segment'i güncelleyebilirdik.
        // Şimdilik scheduled time üzerinden gidelim, ya da basit bir delay varsayalım.

        // TODO: Integrate actual delay from DB/Redis if available. 
        const delayMinutes = 0;
        const arrivalTime = new Date(currentFlight.arrivalDate.getTime() + delayMinutes * 60000);

        const departureTime = new Date(nextFlight.departureDate);

        // 2. Aktarma Süresini Hesapla (Dakika)
        // Eğer nextFlight başka bir gün ise getTime() farkı bunu zaten halleder.
        const connectionTimeMinutes = (departureTime.getTime() - arrivalTime.getTime()) / 60000;

        // console.log(`🏃 Aktarma Analizi (${currentFlight.destination}): Süre ${connectionTimeMinutes} dk`);

        // Only alert if Connection time is positive (meaning relevant connection), negative implies data error or user error
        if (connectionTimeMinutes < 0) continue;

        // 3. Risk Analizi (MCT - Minimum Connection Time)
        // Genelde uluslararası aktarma için 60 dk, riskli sınır 45 dk'dır.

        // Spam check logic would go here ideally to avoid repeat alerts for same risk
        const existingAlert = await prisma.guardianAlert.findFirst({
            where: { tripId: tripId, segmentId: currentFlight.id, type: 'CONNECTION_RISK' }
        });

        if (existingAlert) continue; // Skip if already warned

        if (connectionTimeMinutes < 45) {

            await prisma.guardianAlert.create({
                data: {
                    tripId,
                    segmentId: currentFlight.id, // Alarmı ilk uçuşa bağlıyoruz
                    type: 'CONNECTION_RISK',
                    severity: 'CRITICAL',
                    title: '⚠️ KOŞMANIZ LAZIM!',
                    message: `İlk uçak gecikti veya aktarma çok kısa. Aktarmaya sadece ${Math.floor(connectionTimeMinutes)} dakika kaldı. Pasaport sırasına girmeyin, direkt 'Express Connection' isteyin!`,
                    actionLabel: 'Havalimanı Haritası'
                }
            });
            console.log(`🚨 Connection Risk Alert created for Trip ${tripId} at ${currentFlight.destination}`);

        } else if (connectionTimeMinutes < 90) {
            // Orta Risk (Optional)
            // await prisma.guardianAlert.create(...)
        }
    }
}
