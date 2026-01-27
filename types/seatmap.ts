export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' | 'USER_SEAT' | 'RECOMMENDED';
export type SeatType = 'WINDOW' | 'MIDDLE' | 'AISLE';
export type CabinClass = 'BUSINESS' | 'ECONOMY' | 'FIRST';

export interface Seat {
    number: string; // "12A"
    status: SeatStatus;
    type: SeatType;
    class: CabinClass;
    price?: number; // Ücretli koltuksa
    features?: string[]; // "Exit Row", "Extra Legroom"
}

export interface SeatRow {
    rowNumber: number;
    seats: Seat[];
    isExitRow: boolean;
    isWing: boolean; // Kanat üstü mü? (Manzara için önemli)
}

export interface AircraftLayout {
    aircraftType: string; // "Boeing 737-800"
    rows: SeatRow[];
}
