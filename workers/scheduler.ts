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

                // B. Veritabanını güncelle
                await prisma.monitoredTrip.update({
                    where: { id: trip.id },
                    data: {
                        nextCheckAt: new Date(now.getTime() + 5 * 60000) // 5 dk sonra
                    }
                });
            }

            console.log(`🚀 Dispatched ${tripsToCheck.length} jobs to the worker fleet.`);


            // ------------------------------------------
            // 3. AMENITY WATCHDOG (Uçuş Bitti mi?)
            // ------------------------------------------
            const completedTrips = await prisma.monitoredTrip.findMany({
                where: {
                    status: 'ACTIVE',
                    segments: {
                        every: {
                            arrivalDate: { lt: now }
                        }
                    }
                }
            });

            if (completedTrips.length > 0) {
                console.log(`🐕 Amenity Watchdog: Found ${completedTrips.length} completed trips.`);

                for (const trip of completedTrips) {
                    // 1. Durumu COMPLETED yap
                    await prisma.monitoredTrip.update({
                        where: { id: trip.id },
                        data: { status: 'COMPLETED' }
                    });

                    // 2. Alert Oluştur (Notification simülasyonu)
                    await prisma.guardianAlert.create({
                        data: {
                            tripId: trip.id,
                            type: 'AMENITY_COMPENSATION',
                            severity: 'INFO',
                            title: 'Hoş Geldiniz! Yolculuk nasıldı?',
                            message: 'Eğer Wi-Fi bozuksa veya ekran çalışmadıysa tazminat alabiliriz. Tıklayın.',
                            actionLabel: 'Tazminat İste',
                            potentialValue: '5.000 Mil',
                            isRead: false
                        }
                    });

                    console.log(`✨ Trip ${trip.pnr} Completed. Amenity alert Sent.`);
                }
            }

        } catch (error) {
            console.error("❌ Scheduler Error:", error);
        }
    }, CHECK_INTERVAL_MS);
}

// Servisi Başlat
// runScheduler(); 
// Not: Bu dosyayı import edenler (Next.js build) otomatik başlatmasın diye kapattık.
// Çalıştırmak için: `npm run scheduler` (scripts/start-scheduler.ts veya tek seferlik çağrı gerekir)

if (require.main === module) {
    runScheduler();
}

export { runScheduler };
