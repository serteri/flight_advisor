
// services/guardianEngine.ts
import { MonitoredTrip, GuardianAlert } from '@/types/guardian';

// 1. TAZMİNAT AVCISI (Disruption Hunter) ⚖️
export function checkFlightDisruption(trip: MonitoredTrip): GuardianAlert | null {
    // MOCK: FlightAware API'den gelen veri gibi düşün
    const currentStatus = {
        state: 'DELAYED',
        actualArrival: new Date(new Date(trip.scheduledArrival).getTime() + 190 * 60000).toISOString(), // 190 dk gecikme
        delayReason: 'AIRLINE_OPERATIONS' // Tazminat kapsamına girer
    };

    const delayMinutes = (new Date(currentStatus.actualArrival).getTime() - new Date(trip.scheduledArrival).getTime()) / 60000;

    if (delayMinutes > 180) { // 3 saat sınırı
        return {
            type: 'DISRUPTION',
            severity: 'money',
            title: '💰 600€ Tazminat Hakkı Doğdu!',
            message: `Uçağınız ${Math.floor(delayMinutes / 60)} saat ${delayMinutes % 60} dakika gecikti. Uluslararası kurallara göre nakit tazminat hakkınız var.`,
            actionLabel: 'Tazminat Dosyasını Aç (%0 Komisyon)',
            potentialValue: '600€',
            timestamp: new Date().toISOString()
        };
    }
    return null;
}

// 2. UPGRADE SNIPER (Lüks Avcısı) 🕵️‍♂️
export function checkUpgradeAvailability(trip: MonitoredTrip): GuardianAlert | null {
    // MOCK: Amadeus GDS'den "I" Class (Promo Business) kontrolü
    // Generate random opportunity based on PNR hash or similar to be consistent
    const inventory = {
        economyFull: true,
        businessPromoAvailable: true, // Fırsat!
        businessPromoPrice: 150 // Normalde 2000, şimdi 150 farkla
    };

    if (inventory.businessPromoAvailable) {
        return {
            type: 'UPGRADE',
            severity: 'money',
            title: '💎 Business Class İndirimi Yakalandı',
            message: `Şu an sadece ${inventory.businessPromoPrice} AUD farkla Business Class'a geçebilirsiniz. Normal fark: 2000 AUD.`,
            actionLabel: 'Hemen Yükselt',
            potentialValue: 'Save 1850 AUD',
            timestamp: new Date().toISOString()
        };
    }
    return null;
}

// 3. SCHEDULE GUARDIAN (Tarife Koruyucu) 📅
export function checkScheduleChange(trip: MonitoredTrip): GuardianAlert | null {
    // MOCK: Havayolu veritabanı kontrolü
    const newSchedule = {
        departure: new Date(new Date(trip.scheduledDeparture).getTime() - 180 * 60000).toISOString() // 3 saat öne çekilmiş
    };

    const timeDiff = Math.abs(new Date(newSchedule.departure).getTime() - new Date(trip.scheduledDeparture).getTime());

    if (timeDiff > 60 * 60000) { // 1 saatten fazla değişiklik
        return {
            type: 'SCHEDULE_CHANGE',
            severity: 'critical',
            title: '🚨 Uçuş Saatiniz Değişti!',
            message: `Havayolu kalkış saatini 3 saat öne çekti. Eski: ${trip.scheduledDeparture}, Yeni: ${newSchedule.departure}. Aktarmayı kaçırabilirsiniz.`,
            actionLabel: 'Ücretsiz Değişiklik Talep Et',
            timestamp: new Date().toISOString()
        };
    }
    return null;
}

// 4. AMENITY WATCHDOG (Hizmet Kusuru) 📺
// Bu fonksiyon uçuş bittikten sonra çalışır
export function checkAmenityCompensation(report: { wifiBroken: boolean, screenBroken: boolean }): GuardianAlert | null {
    if (report.wifiBroken || report.screenBroken) {
        return {
            type: 'AMENITY',
            severity: 'money',
            title: 'Hizmet Kusuru Tazminatı',
            message: 'Uçuşta Wi-Fi veya Ekran bozuktu. Havayolundan mil veya çek talep edebiliriz.',
            actionLabel: 'Tazminat İste',
            potentialValue: '5,000 Mil',
            timestamp: new Date().toISOString()
        };
    }
    return null;
}
