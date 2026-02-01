
import { AircraftLayout, Seat, SeatStatus, Row } from '@/types/seatmap';

export function mapAmadeusToVisualizer(
    amadeusData: any,
    currentUserSeat: string | null // Örn: "24A"
): AircraftLayout {

    // Basic validation
    if (!amadeusData || !amadeusData[0] || !amadeusData[0].decks) {
        // Return empty default layout if data invalid
        return { aircraftType: 'Unknown', rows: [] };
    }

    const rows: Row[] = [];
    const decks = amadeusData[0].decks; // Genelde tek katlıdır (Main Deck)

    // Flattening Amadeus structure: Decks -> Seats -> Coordinates

    // We grouped by Row Number first
    const rowMap = new Map<number, Seat[]>();

    decks.forEach((deck: any) => {
        deck.seats.forEach((seatData: any) => {
            const rowNum = seatData.coordinates.y; // Satır Numarası (Örn: 24)
            const letter = seatData.coordinates.x; // Harf (Örn: A, B, C)
            const seatNumber = seatData.number;    // "24A"

            // --- STATÜ BELİRLEME ---
            let status: SeatStatus = 'OCCUPIED'; // Varsayılan dolu

            if (seatData.travelerPricingStatus === 'AVAILABLE') {
                status = 'AVAILABLE';
            } else if (seatData.travelerPricingStatus === 'BLOCKED') {
                status = 'BLOCKED';
            }

            // 🟣 KULLANICININ YERİ (Özel Statü)
            // Normalize comparison (e.g. 24A vs 24a)
            if (currentUserSeat && seatNumber.toUpperCase() === currentUserSeat.toUpperCase()) {
                status = 'USER_SEAT';
            }

            const seat: Seat = {
                number: seatNumber,
                status: status,
                coordinates: { x: letter, y: rowNum },
                features: seatData.characteristicsCodes || []
            };

            if (!rowMap.has(rowNum)) {
                rowMap.set(rowNum, []);
            }
            rowMap.get(rowNum)?.push(seat);
        });
    });

    // Convert Map to Array and Sort by Row Number
    const sortedRowNumbers = Array.from(rowMap.keys()).sort((a, b) => a - b);

    sortedRowNumbers.forEach(rowNum => {
        const seatsInRow = rowMap.get(rowNum) || [];
        // Sort seats by letter (A, B, C...)
        seatsInRow.sort((a, b) => a.coordinates.x.localeCompare(b.coordinates.x));

        rows.push({
            rowNumber: rowNum,
            seats: seatsInRow
        });
    });

    return {
        aircraftType: amadeusData[0].aircraft?.code || '738',
        rows: rows
    };
}
