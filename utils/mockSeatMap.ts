
import { AircraftLayout, Seat, SeatStatus } from '@/types/seatmap';

export function getMockAircraftLayout(aircraftType: string, userSeat: string | null): AircraftLayout {
    const rows: any[] = [];

    // Airline Layout Configuration Map
    // Mock logic: randomly assign a specific layout style for variety, or could use airline code if passed
    // Common 777 configs: 3-3-3 (Comfort) vs 3-4-3 (High Density)

    // Default to High Density 3-4-3 for 777
    let config = {
        letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K'],
        type: 'WIDE_3_4_3'
    };

    if (['320', '738', '737', '321'].includes(aircraftType)) {
        config = {
            letters: ['A', 'B', 'C', 'D', 'E', 'F'],
            type: 'NARROW_3_3'
        };
    } else {
        // For Widebodies, simulate variety. 
        // Real world: THY 777 is 3-3-3. Emirates is 3-4-3.
        const useComfortLayout = aircraftType.includes('77') && Math.random() > 0.5;

        // Deterministic toggle based on aircraft length to avoid hydration issues
        if (aircraftType === '77W') {
            config = {
                letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K'], // 3-3-3 standard: ABC-DEF-GHK usually? Or ABC-DEG-HJK? Let's use standard.
                type: 'WIDE_3_3_3'
            };
        }
    }

    const rowCount = config.type.startsWith('WIDE') ? 50 : 30;

    for (let i = 1; i <= rowCount; i++) {
        const rowSeats: Seat[] = [];

        config.letters.forEach(letter => {
            const seatNum = `${i}${letter}`;

            const seatId = i * 100 + letter.charCodeAt(0);
            const isOccupiedMath = (seatId % 7 === 0) || (seatId % 3 === 0 && i % 2 !== 0);
            let status: SeatStatus = isOccupiedMath ? 'OCCUPIED' : 'AVAILABLE';

            // Kullanıcının Koltuğu
            if (userSeat && seatNum === userSeat) {
                status = 'USER_SEAT';
            }

            // 15. Sıra (Öneri)
            if (i === 15 && status === 'AVAILABLE') {
                status = 'RECOMMENDED';
            }

            rowSeats.push({
                number: seatNum,
                status: status,
                coordinates: { x: letter, y: i },
                price: undefined
            });
        });

        rows.push({ rowNumber: i, seats: rowSeats });
    }

    return {
        aircraftType: aircraftType || '77W',
        rows: rows
    };
}
