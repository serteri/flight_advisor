
import { getAmadeusClient } from '@/lib/amadeus';
import { prisma } from '@/lib/prisma';

export async function checkAwardAvailability(segmentId: string) {
    const segment = await prisma.flightSegment.findUnique({ where: { id: segmentId } });
    if (!segment || segment.cabinClass === 'BUSINESS') return; // Zaten Business ise bakma

    const amadeus = getAmadeusClient();

    try {
        // 1. Business Class Ara
        // Wrapper metodumuz 'travelClass' parametresini destekliyor
        const offers = await amadeus.searchFlights({
            originLocationCode: segment.origin,
            destinationLocationCode: segment.destination,
            departureDate: segment.departureDate.toISOString().split('T')[0],
            adults: 1,
            travelClass: 'BUSINESS',
            currencyCode: 'EUR' // Karşılaştırma kolaylığı için EUR
        });

        if (offers && offers.length > 0) {
            const offer = offers[0]; // En ucuz olan
            const price = parseFloat(offer.price.total);

            // MANTIK: Eğer Business fiyatı anormal düşükse (veya elimizde mil verisi varsa)
            // Şimdilik "Uygun Fiyatlı Business" olarak uyarıyoruz.
            // Eşik değer: Örn 1000 EUR altı (Uzun menzil için iyi fiyat, kısa için pahalı olabilir ama demo için OK)

            if (price < 1000) {

                const existingAlert = await prisma.guardianAlert.findFirst({
                    where: { tripId: segment.tripId, segmentId: segment.id, type: 'AWARD_CHANCE' }
                });

                if (!existingAlert) {
                    await prisma.guardianAlert.create({
                        data: {
                            tripId: segment.tripId,
                            segmentId: segment.id,
                            type: 'AWARD_CHANCE',
                            severity: 'INFO',
                            title: '💎 Mil/Upgrade Fırsatı!',
                            message: `Business Class koltukları açıldı. Fiyatlar düştü (${price} ${offer.price.currency}). Millerinizle yükseltme yapmak için havayolunu aramanın tam zamanı!`,
                            potentialValue: 'Upgrade',
                            actionLabel: 'Fırsatı İncele'
                        }
                    });
                    console.log(`💎 Award Upgrade Alert created for segment ${segment.id} (Price: ${price})`);
                }
            }
        }
    } catch (error) {
        console.error("Award Check Error:", error);
    }
}
