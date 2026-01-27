
// types/guardian.ts

export type GuardianStatus = 'active' | 'triggered' | 'resolved' | 'expired';

export interface MonitoredTrip {
    id: string;
    userId: string;
    pnr: string; // Rezervasyon Kodu (Örn: QLWZE)
    airlineCode: string;
    flightNumber: string;
    scheduledDeparture: string;
    scheduledArrival: string;

    // Takip edilen özellikler
    watchList: {
        disruption: boolean;    // Rötar/İptal Takibi
        upgrade: boolean;       // Business Upgrade Takibi
        schedule: boolean;      // Saat Değişikliği Takibi
        seats: boolean;         // Koltuk Takibi
        amenities: boolean;     // Hizmet Kusuru Takibi
        priceDrop: boolean;     // Fiyat Düşüşü Takibi
    };

    // Anlık Durumlar (Sistemin buldukları)
    alerts: GuardianAlert[];
}

export interface GuardianAlert {
    type: 'DISRUPTION' | 'UPGRADE' | 'SCHEDULE_CHANGE' | 'SEAT_ALERT' | 'AMENITY' | 'PRICE_DROP';
    severity: 'info' | 'warning' | 'critical' | 'money'; // 'money' = Para kazanma fırsatı
    title: string;
    message: string;
    actionLabel?: string; // "Tazminat Talep Et" veya "Upgrade Al"
    potentialValue?: string; // "600€" veya "Business Class"
    timestamp: string;
}
