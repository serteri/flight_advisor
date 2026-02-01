
export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' | 'USER_SEAT' | 'RECOMMENDED';

export interface SeatCoordinates {
    x: string; // "A", "B", etc. or numeric string depending on raw data
    y: number; // Row number
}

export interface Seat {
    number: string; // "24A"
    status: SeatStatus;
    coordinates: SeatCoordinates;
    price?: {
        amount: number;
        currency: string;
    };
    features?: string[]; // "WINDOW", "AISLE", "EXIT_ROW", "WING", "LEG_SPACE"
    isAisleRight?: boolean; // Visual helper: Is there an aisle to the right of this seat?
    travelerPricingStatus?: string; // Raw Amadeus status
}

export interface Row {
    rowNumber: number;
    seats: Seat[];
    features?: string[]; // "EXIT_ROW" for the whole row
}

export interface Deck {
    deckType: string; // "MAIN", "UPPER"
    rows: Row[];
}

export interface AircraftLayout {
    aircraftType: string; // "738"
    rows: Row[]; // Simplified single deck view for MVP
    decks?: Deck[]; // Full structure
} // 
