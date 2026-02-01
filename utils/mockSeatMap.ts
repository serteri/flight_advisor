
import { AircraftLayout, Row, Seat } from '@/types/seatmap';

export function getMockAircraftLayout(aircraftType: string, userSeat: string | null): AircraftLayout {
    // 1. Uçak Tipine Göre Konfigürasyon
    // 738, 320: Tek koridor (3-3)
    // 777, 350: Çift koridor (3-4-3 veya 3-3-3)
    let config = {
        rows: 30,
        layout: '3-3', // ABC-DEF
        groups: [['A', 'B', 'C'], ['D', 'E', 'F']]
    };

    if (aircraftType.includes('77') || aircraftType.includes('350') || aircraftType.includes('380') || aircraftType.includes('787')) {
        config = {
            rows: 50,
            layout: '3-4-3', // ABC-DEFG-HJK
            groups: [['A', 'B', 'C'], ['D', 'E', 'F', 'G'], ['H', 'J', 'K']]
        };
    }

    // 2. Satırları Oluştur
    const rows: Row[] = [];

    // Parse user seat to highlight it
    // userSeat format: "24A"
    const userRowVal = userSeat ? parseInt(userSeat.replace(/\D/g, '')) : -1;
    const userLetter = userSeat ? userSeat.replace(/\d/g, '').toUpperCase() : '';

    for (let r = 1; r <= config.rows; r++) {
        // Business / Economy ayrımı (İlk 5 sıra business olsun)
        const isBusiness = r <= 5;
        // Business ise sıra numarası ve koltuk sayısı değişir genelde ama basit tutalım.

        const seats: Seat[] = [];

        config.groups.forEach(group => {
            group.forEach(letter => {
                // Random status logic
                let status = Math.random() > 0.3 ? 'AVAILABLE' : 'OCCUPIED';

                // Blocked or Premium logic
                if (r === 12 || r === 13) status = 'BLOCKED'; // Acil çıkış

                // User Seat Logic
                if (r === userRowVal && letter === userLetter) {
                    status = 'USER_SEAT';
                }

                seats.push({
                    number: `${r}${letter}`,
                    coordinates: { x: letter, y: r },
                    status: status as any,
                    features: []
                });
            });
        });

        rows.push({
            rowNumber: r,
            seats: seats
        });
    }

    return {
        aircraftType: aircraftType || '738',
        rows: rows
    };
}
