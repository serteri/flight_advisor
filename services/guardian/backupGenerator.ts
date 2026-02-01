
import { getAmadeusClient } from '@/lib/amadeus';
import { prisma } from '@/lib/prisma';

export async function generateBackupPlan(segmentId: string) {
    const segment = await prisma.flightSegment.findUnique({ where: { id: segmentId } });
    if (!segment) return;

    console.log(`🔄 Backup Generator Çalışıyor: ${segment.airlineCode}${segment.flightNumber} iptal edildi.`);

    // Amadeus client
    const amadeus = getAmadeusClient();

    try {
        // 1. Amadeus'a Sor: "Bugün aynı rotada başka kim uçuyor?"
        // Kalkış saati: Şu andan itibaren
        // Not: Amadeus wrapper'ımız 'searchFlights' metoduna sahip, veya direkt SDK kullanabiliriz.
        // Kullanıcı örneğinde direkt SDK çağrısı var 'shopping.flightOffersSearch.get'.
        // Bizim wrapper içinde 'searchFlights' bu işi yapıyor ama 'max' parametresi vs için direkt SDK kullanımına uygun wrapper var mı bakalım.
        // Amadeus wrapper'ımız 'amadeusClient' (axios) dönüyor veya wrapper metodları var.
        // Kullanıcının verdiği kod 'amadeus.shopping...' şeklinde, bu da 'amadeus' paketinin kendi instance'ı.
        // Bizim 'lib/amadeus.ts' default export olarak 'amadeus' (SDK instance) dönüyor.
        // Ancak lib/amadeus.ts dosyasında 'getAmadeusClient' wrapper'ı da var.
        // User kodunu bizim yapıya uyarlayalım: Wrapper'daki 'searchFlights' kullanabiliriz.

        // searchFlights parametreleri bizim wrapper'da tanımlı.
        const alternatives = await amadeus.searchFlights({
            originLocationCode: segment.origin,
            destinationLocationCode: segment.destination,
            departureDate: segment.departureDate.toISOString().split('T')[0], // YYYY-MM-DD
            adults: 1,
            // max: 3 // Wrapper default 250, filtreleyebiliriz
        });

        // Wrapper sonucundan ilk 3'ü alalım
        const topAlternatives = alternatives.slice(0, 3);

        if (topAlternatives.length > 0) {
            // 2. Alternatifleri Formatla
            const altList = topAlternatives.map((alt: any) => {
                const flight = alt.itineraries[0].segments[0];
                const departureTime = flight.departure.at.split('T')[1].slice(0, 5);
                return `${flight.carrierCode}${flight.number} (${departureTime}) - ${alt.numberOfBookableSeats} Koltuk`;
            }).join('\n');

            // 3. Kurtarıcı Bildirimini At
            await prisma.guardianAlert.create({
                data: {
                    tripId: segment.tripId,
                    segmentId: segment.id,
                    type: 'BACKUP_PLAN',
                    severity: 'CRITICAL',
                    title: '🚨 UÇUŞ İPTAL OLDU - İŞTE B PLANINIZ',
                    message: `Panik yapmayın. Sizi eve götürecek uçuşları bulduk. Bankoya gidip şunu gösterin:\n\n${altList}`,
                    actionLabel: 'Alternatifleri Gör'
                }
            });
            console.log(`✅ Backup options found and alerted for ${segment.airlineCode}${segment.flightNumber}`);
        } else {
            console.log(`❌ No alternatives found for ${segment.airlineCode}${segment.flightNumber}`);
        }

    } catch (error) {
        console.error("Backup Plan Error:", error);
    }
}
