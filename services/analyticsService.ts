import { prisma } from '@/lib/prisma'; // Prisma client
import { Flight } from '@/types'; // Use centralized type if available, or FlightForScoring

// Define a subset interface if Flight is not perfectly compatible or imports are messy
interface AnalyticsFlight {
    price: number;
}

export async function updateRouteStats(
    origin: string,
    destination: string,
    flights: AnalyticsFlight[]
) {
    if (flights.length === 0) return;

    // 1. BU ARAMANIN İSTATİSTİKLERİ
    const prices = flights.map(f => f.price).filter(p => p > 0);
    if (prices.length === 0) return;

    const currentMin = Math.min(...prices);
    const currentMax = Math.max(...prices);
    const currentAvg = prices.reduce((a, b) => a + b, 0) / prices.length;

    // Şu anki ay (Sezonluk analiz için önemli)
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // 2. VERİTABANINDA GÜNCELLE (Upsert)
    // Bu işlem database'i şişirmez, var olan satırı matematiksel olarak günceller.

    try {
        // Önce var olan kaydı bul
        const existingStat = await prisma.routeStatistics.findUnique({
            where: {
                originCode_destinationCode_month: {
                    originCode: origin,
                    destinationCode: destination,
                    month: currentMonth
                }
            }
        });

        if (existingStat) {
            // --- MATEMATİKSEL BİRLEŞTİRME (WEIGHTED AVERAGE) ---
            // Eski ortalamayı bozmadan yeniyi ekliyoruz.
            // Formül: ((EskiOrt * EskiSayı) + (YeniOrt * 1)) / (EskiSayı + 1)

            const totalSamples = existingStat.sampleSize + 1;
            const newGlobalAvg = ((existingStat.avgPrice * existingStat.sampleSize) + currentAvg) / totalSamples;

            await prisma.routeStatistics.update({
                where: { id: existingStat.id },
                data: {
                    minPrice: Math.min(existingStat.minPrice, currentMin), // Hangisi daha düşükse onu tut
                    maxPrice: Math.max(existingStat.maxPrice, currentMax),
                    avgPrice: newGlobalAvg,
                    sampleSize: { increment: 1 }, // Örneklem sayısını artır
                }
            });
        } else {
            // --- İLK KEZ KAYIT ---
            await prisma.routeStatistics.create({
                data: {
                    originCode: origin,
                    destinationCode: destination,
                    month: currentMonth,
                    minPrice: currentMin,
                    maxPrice: currentMax,
                    avgPrice: currentAvg,
                    sampleSize: 1
                }
            });
        }

        console.log(`📊 [ANALYTICS] ${origin}-${destination} (Month: ${currentMonth}) stats updated. New Avg: ${currentAvg.toFixed(0)}`);

    } catch (error) {
        console.error("İstatistik hatası:", error);
        // İstatistik hatası olsa bile kullanıcıya sonucu göster, akışı kesme.
    }
}
