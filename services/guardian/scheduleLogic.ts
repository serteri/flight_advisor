// services/guardian/scheduleLogic.ts
import { MonitoredTrip, GuardianAlert } from '@/types/guardian';

interface ScheduleData {
    currentDeparture: Date;
    currentArrival: Date;
    flightNumber: string;
}

export function checkScheduleChanges(trip: MonitoredTrip, realTimeData: ScheduleData): GuardianAlert | null {
    const originalDep = new Date(trip.scheduledDeparture); // Veritabanındaki kayıt matches MonitoredTrip interface
    const currentDep = new Date(realTimeData.currentDeparture); // Havayolundan gelen taze veri

    // Farkı dakika cinsinden bul (Mutlak değer)
    const diffMs = currentDep.getTime() - originalDep.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    // 15 dakikadan az değişimleri görmezden gel
    if (Math.abs(diffMinutes) < 15) return null;

    // Değişim Yönü
    const direction = diffMinutes > 0 ? 'LATER' : 'EARLIER';
    const absMinutes = Math.abs(diffMinutes);

    // Mesaj Oluşturma
    let severity: 'warning' | 'critical' = 'warning'; // Matches GuardianAlert type
    let title = '⏰ Uçuş Saati Değişti';
    let message = `Uçağınız ${absMinutes} dakika ${direction === 'EARLIER' ? 'öne çekildi' : 'ertelendi'}.`;
    let actionLabel = 'Yeni Saati Onayla';
    let potentialValue: string | undefined = undefined;

    // KRİTİK SENARYO: 2 Saat üzeri değişim veya Öne Çekilme (Uçağı kaçırtır)
    if (absMinutes > 120 || direction === 'EARLIER') {
        severity = 'critical';
        title = '🚨 KRİTİK: Tarife Değişikliği';
        message = `DİKKAT! Havayolu uçuş saatini ciddi şekilde değiştirdi. Yeni saat: ${currentDep.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}. Bu değişiklik aktarmanızı riske atabilir veya ücretsiz iade hakkı doğurabilir.`;
        actionLabel = 'Havayoluyla İletişime Geç';
        if (absMinutes > 120) {
            potentialValue = 'Free Refund Right';
        }
    }

    return {
        type: 'SCHEDULE_CHANGE',
        severity,
        title,
        message,
        potentialValue,
        actionLabel,
        // Eski ve Yeni saati detaylarda saklayalım
        metadata: {
            oldTime: originalDep.toISOString(),
            newTime: currentDep.toISOString()
        },
        timestamp: new Date().toISOString()
    };
}
