// services/agents/seatSpy.ts

export interface PoorManBusinessResult {
    bonus: number;
    alert: string;
}

export function findPoorMansBusiness(seatData: any[]): PoorManBusinessResult | null {
    // Amadeus verisinde aynı sıradaki (row) koltukları grupla
    // Eğer yan yana 3 koltuk "AVAILABLE" ise true dön

    const hasThreeInARow = seatData.some(row => {
        // Örn: [A, B, C] koltuklarının üçü de boş mu?
        const availableSeats = row.seats ? row.seats.filter((s: any) => s.status === "AVAILABLE") : [];

        // Check for consecutive seats
        if (availableSeats.length >= 3) {
            // Look for 3 adjacent seats (e.g., A-B-C or D-E-F)
            const seatLetters = availableSeats.map((s: any) => s.number || s.designation);

            // Simple adjacency check: if we have ABC, DEF, etc.
            for (let i = 0; i < seatLetters.length - 2; i++) {
                const first = seatLetters[i].charCodeAt(0);
                const second = seatLetters[i + 1].charCodeAt(0);
                const third = seatLetters[i + 2].charCodeAt(0);

                if (second === first + 1 && third === second + 1) {
                    return {
                        bonus: 0.5,
                        alert: "POOR MAN'S BUSINESS: Bu uçuşta yan yana 3 boş koltuk yakalama şansın yüksek!"
                    };
                }
            }
        }

        return false;
    });

    return hasThreeInARow ? {
        bonus: 0.5,
        alert: "POOR MAN'S BUSINESS: Bu uçuşta yan yana 3 boş koltuk yakalama şansın yüksek!"
    } : null;
}

// Analyze entire seatmap for comfort opportunities
export function analyzeSeatMapComfort(seatMapData: any): {
    poorMansBusiness: PoorManBusinessResult | null;
    emptyRows: number;
    totalOccupancy: number;
} {
    const decks = seatMapData.decks || [];
    let emptyRowCount = 0;
    let totalSeats = 0;
    let occupiedSeats = 0;

    // Group seats by row
    const rowMap = new Map<number, any[]>();

    decks.forEach((deck: any) => {
        (deck.seats || []).forEach((seat: any) => {
            const rowNum = seat.coordinates?.y || parseInt(seat.number);
            if (!rowMap.has(rowNum)) {
                rowMap.set(rowNum, []);
            }
            rowMap.get(rowNum)!.push(seat);

            totalSeats++;
            if (seat.travelerPricingStatus === 'OCCUPIED') {
                occupiedSeats++;
            }
        });
    });

    // Convert to array format for findPoorMansBusiness
    const rows = Array.from(rowMap.entries()).map(([rowNum, seats]) => ({
        row: rowNum,
        seats: seats
    }));

    const poorManResult = findPoorMansBusiness(rows);
    const occupancyRate = totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0;

    return {
        poorMansBusiness: poorManResult,
        emptyRows: emptyRowCount,
        totalOccupancy: Math.round(occupancyRate)
    };
}
