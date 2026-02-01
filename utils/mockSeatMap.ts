
import { AircraftLayout, Seat, SeatStatus } from '@/types/seatmap';

export function getMockAircraftLayout(aircraftType: string, userSeat: string | null): AircraftLayout {
    const rows: any[] = [];

    // Geniş gövde mi?
    const isWideBody = ['77W', '777', '350', '330', '787'].includes(aircraftType);

    // 3-4-3 veya 3-3 düzenine göre harfler
    const letters = isWideBody
        ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K']
        : ['A', 'B', 'C', 'D', 'E', 'F'];

    const rowCount = isWideBody ? 50 : 30;

    for (let i = 1; i <= rowCount; i++) {
        const rowSeats: Seat[] = [];

        letters.forEach(letter => {
            const seatNum = `${i}${letter}`;

            // Deterministic pseudo-random status logic to avoid Hydration Error
            // Use a simple hash of row + letter to determine status
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
                coordinates: { x: letter, y: i }, // Added coordinates to satisfy type definition if needed, though visualizer doesn't strictly use it now.
                price: undefined
            });
        });

        // Not: Artık buraya splice(AISLE) eklemiyoruz! 
        // Visualizer bunu halledecek.

        rows.push({ rowNumber: i, seats: rowSeats });
    }

    return {
        aircraftType: aircraftType || '77W', // Default to 77W for demo if undefined
        rows: rows
    };
}
