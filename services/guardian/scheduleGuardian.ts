// services/guardian/scheduleGuardian.ts

export interface ScheduleChangeAlert {
    alert: boolean;
    message?: string;
    type?: 'ARBITRAGE_GOLD' | 'MINOR_CHANGE' | 'MAJOR_CHANGE';
    diffInMinutes?: number;
    hasRefundRight?: boolean;
}

/**
 * Schedule Guardian - Zaman Muhafızı
 * Monitors flight schedule changes and alerts users of their refund/change rights
 */
export function checkScheduleChange(
    originalFlight: any,
    currentFlight: any
): ScheduleChangeAlert {
    try {
        const originalTime = new Date(originalFlight.departureTime).getTime();
        const currentTime = new Date(currentFlight.departureTime).getTime();

        // Fark hesaplama (mutlak değer)
        const diffInMinutes = Math.abs(currentTime - originalTime) / (1000 * 60);

        // Küçük değişiklikler (<15 dk) görmezden gelinir
        if (diffInMinutes < 15) {
            return { alert: false };
        }

        // 15+ dakika değişim = Ücretsiz değişim/iade hakkı olabilir
        if (diffInMinutes >= 15 && diffInMinutes < 180) {
            return {
                alert: true,
                message: `SCHEDULE ALERT: Uçuş saati ${Math.round(diffInMinutes)} dk değişti! Ücretsiz iade veya değişim hakkın olabilir.`,
                type: 'MINOR_CHANGE',
                diffInMinutes: Math.round(diffInMinutes),
                hasRefundRight: true
            };
        }

        // 3+ saat değişim = Kesin arbitraj fırsatı (EU261 kuralları)
        if (diffInMinutes >= 180) {
            return {
                alert: true,
                message: `🚨 MAJOR ALERT: Uçuş saati ${Math.round(diffInMinutes / 60)} saat değişti! Tazminat + Tam İade hakkın var.`,
                type: 'ARBITRAGE_GOLD',
                diffInMinutes: Math.round(diffInMinutes),
                hasRefundRight: true
            };
        }

        return { alert: false };
    } catch (error) {
        console.error('Schedule Guardian Error:', error);
        return { alert: false };
    }
}

/**
 * Checks if a flight should be monitored based on departure date
 */
export function shouldMonitorFlight(departureDate: string): boolean {
    const departure = new Date(departureDate);
    const now = new Date();
    const daysUntilDeparture = (departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Monitor flights that are 1-90 days away
    return daysUntilDeparture >= 1 && daysUntilDeparture <= 90;
}

/**
 * Calculates monitoring frequency based on departure proximity
 */
export function getMonitoringFrequency(departureDate: string): number {
    const departure = new Date(departureDate);
    const now = new Date();
    const daysUntilDeparture = (departure.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // 1-7 days: Check every 6 hours
    if (daysUntilDeparture <= 7) return 6;

    // 8-30 days: Check daily
    if (daysUntilDeparture <= 30) return 24;

    // 31-90 days: Check every 3 days
    return 72;
}
