import { AircraftLayout, SeatRow, Seat } from '@/types/seatmap';

export function generateMockSeatMap(): AircraftLayout {
    const rows: SeatRow[] = [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F']; // 3-3 Düzeni

    for (let i = 1; i <= 30; i++) {
        const seats: Seat[] = letters.map((letter, idx) => {
            let status: any = Math.random() > 0.3 ? 'OCCUPIED' : 'AVAILABLE';

            // SENARYO: KULLANICININ YERİ (24A) VE YANI (24B)
            if (i === 24 && letter === 'A') status = 'USER_SEAT'; // Bizim yerimiz
            if (i === 24 && letter === 'B') status = 'OCCUPIED'; // Kötü komşu

            // SENARYO: FIRSAT (15. Sıra Boş)
            if (i === 15) status = 'RECOMMENDED'; // Buraya kaç!

            return {
                number: `${i}${letter}`,
                status: status,
                type: (idx === 0 || idx === 5) ? 'WINDOW' : (idx === 2 || idx === 3) ? 'AISLE' : 'MIDDLE',
                class: i < 5 ? 'BUSINESS' : 'ECONOMY'
            };
        });

        rows.push({
            rowNumber: i,
            seats,
            isExitRow: i === 12 || i === 13,
            isWing: i >= 10 && i <= 20
        });
    }

    return { aircraftType: 'Boeing 737-800 (Narrow Body)', rows };
}
