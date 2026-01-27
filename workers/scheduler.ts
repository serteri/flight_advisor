// workers/scheduler.ts
import 'dotenv/config';
import { prisma } from '@/lib/prisma';
import { flightMonitorQueue } from './queue';

const CHECK_INTERVAL_MS = 60 * 1000; // Her 1 dakikada bir kontrol et
const BATCH_SIZE = 50; // Tek seferde en fazla 50 uçuşu kuyruğa at (Boğulmayı önle)

async function runScheduler() {
    console.log("💓 Travel Guardian Scheduler Started (Heartbeat Active)...");

    setInterval(async () => {
        try {
            const now = new Date();

            // 1. ZAMANI GELMİŞ UÇUŞLARI BUL
            // Durumu 'ACTIVE' olan VE kontrol zamanı (nextCheckAt) gelmiş/geçmiş olanlar
            const tripsToCheck = await prisma.monitoredTrip.findMany({
                where: {
                    status: 'ACTIVE',
                    nextCheckAt: { lte: now }, // Less than or equal to NOW
                },
                take: BATCH_SIZE,
                orderBy: { nextCheckAt: 'asc' } // En çok gecikenleri önce al
            });

            if (tripsToCheck.length === 0) {
                // İş yoksa sessizce bekle
                return;
            }

            console.log(`⏰ Time to wake up! Found ${tripsToCheck.length} trips to check.`);

            // 2. İŞLERİ KUYRUĞA AT (REDIS)
            for (const trip of tripsToCheck) {

                // A. Kuyruğa ekle (Worker bunu işleyecek)
                await flightMonitorQueue.add('check-flight', { tripId: trip.id }, {
                    removeOnComplete: true,
                    attempts: 3
                });

                // B. Veritabanını güncelle (Hemen tekrar seçilmesin diye ileri at)
                // Worker işi bitirince bu süreyi "Akıllı Süre" ile tekrar güncelleyecek.
                // Şimdilik "İşlemde" olduğunu belirtmek için 5 dakika ileri atıyoruz.
                await prisma.monitoredTrip.update({
                    where: { id: trip.id },
                    data: {
                        nextCheckAt: new Date(now.getTime() + 5 * 60000) // 5 dk sonra (Geçici)
                    }
                });
            }

            console.log(`🚀 Dispatched ${tripsToCheck.length} jobs to the worker fleet.`);

        } catch (error) {
            console.error("❌ Scheduler Error:", error);
        }
    }, CHECK_INTERVAL_MS);
}

// Servisi Başlat
runScheduler();
