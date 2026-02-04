
import { MonitoredTrip, GuardianAlert } from '@prisma/client';

export type AlertType = 'PRICE_DROP' | 'DISRUPTION_MONEY' | 'UPGRADE_OPPORTUNITY' | 'SEAT_ALERT' | 'SCHEDULE_CHANGE' | 'AMENITY_COMPENSATION';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'MONEY';

// --- TYPES AND CONFIGURATION ---

export interface RealTimeFlightData {
    status: 'SCHEDULED' | 'DELAYED' | 'CANCELLED' | 'LANDED';
    delayMinutes: number;
    delayReasonCode: string; // 'WEATHER', 'TECHNICAL', 'STRIKE' etc.
    currentPrice: number;
    businessUpgradePrice: number | null;
    seatMap: {
        userSeat: string; // '24A'
        neighborSeatStatus: 'OCCUPIED' | 'EMPTY';
        betterSeatsAvailable: string[]; // ['12F', '15A', '15B', '15C']
    };
    scheduleChange?: {
        newDeparture: string;
        newArrival: string;
    };
}

// Airline Cancellation/Change Policy
export interface TicketRules {
    cancellationFee: number;
    changeFee: number;
    isRefundable: boolean;
}

// ---------------------------------------------------------
// HELPER: Convert our internal AlertType to Prisma Enum
// ---------------------------------------------------------
// Prisma Enum: PRICE_DROP, DISRUPTION_MONEY, UPGRADE_OPPORTUNITY, SEAT_ALERT, SCHEDULE_CHANGE, AMENITY_COMPENSATION
// We need to return objects compatible with the Prisma Alert creation, 
// BUT the return type doesn't have to be the full Prisma Model, just the creation data.

interface AlertResult {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    actionLabel?: string;
    potentialValue?: string;
}


// =========================================================
// 1. PRICE DROP ARBITRAGE (Money Saving) 💰
// =========================================================
export function checkPriceDropArbitrage(
    trip: MonitoredTrip,
    currentPrice: number,
    ticketRules: TicketRules
): AlertResult | null {

    const originalPrice = trip.originalPrice; // Correct Field
    const potentialRefund = originalPrice - ticketRules.cancellationFee;
    const newTicketCost = currentPrice;

    // NET PROFIT CALCULATION
    const netProfit = potentialRefund - newTicketCost;

    // Only diff > 50 AUD is worth the hassle
    if (netProfit > 50) {
        return {
            type: 'PRICE_DROP',
            severity: 'MONEY',
            title: '📉 Price Arbitrage Detected!',
            message: `Flight price dropped. If you cancel your ticket (Fee: ${ticketRules.cancellationFee}) and rebook, you make a NET profit of ${netProfit} ${trip.currency}.`,
            actionLabel: 'Start Swap',
            potentialValue: `${netProfit} ${trip.currency}`,
        };
    }
    return null;
}

// =========================================================
// 2. SEAT SPY (Comfort) 💺
// =========================================================
export function checkSeatAlert(
    trip: MonitoredTrip,
    seatData: RealTimeFlightData['seatMap']
): AlertResult | null {

    // Scenario A: Neighbor sat down!
    if (seatData.neighborSeatStatus === 'OCCUPIED') {
        // Check for "Poor Man's Business Class"
        const poorMansBusiness = checkTripleEmptySeats(seatData.betterSeatsAvailable);

        if (poorMansBusiness) {
            return {
                type: 'SEAT_ALERT',
                severity: 'INFO',
                title: '🛋️ Better Seats Available',
                message: `Your neighbor seat (next to ${seatData.userSeat}) is now occupied. However, row ${poorMansBusiness} is completely empty. Move there to lie down!`,
                actionLabel: 'Change Seat',
            };
        }
    }
    return null;
}

// =========================================================
// 3. DISRUPTION HUNTER PRO (EU261 Rules) ⚖️
// =========================================================
export function checkDisruptionPro(
    trip: MonitoredTrip,
    flightData: RealTimeFlightData
): AlertResult | null {

    // Eligible reasons for EU261
    const eligibleReasons = ['TECHNICAL', 'CREW_LIMIT', 'STRIKE', 'AIRLINE_OPERATIONS'];
    const isEligible = eligibleReasons.includes(flightData.delayReasonCode);

    if (flightData.delayMinutes > 180 && isEligible) {
        return {
            type: 'DISRUPTION_MONEY',
            severity: 'MONEY',
            title: '💰 Confirmed Compensation Rights',
            message: `Delay > 3 hours due to "Operational" reasons. Under EU Regulations, you are entitled to 600€ cash compensation.`,
            actionLabel: 'Open Claim File',
            potentialValue: '600€',
        };
    }
    return null;
}

// =========================================================
// 4. UPGRADE SNIPER (Business Class) 🥂
// =========================================================
export function checkUpgradeAvailability(
    trip: MonitoredTrip,
    flightData?: RealTimeFlightData // Optional
): AlertResult | null {

    const upgradePrice = flightData?.businessUpgradePrice || 250;
    const target = trip.targetUpgradePrice || 300; // Now exists in Schema

    if (upgradePrice <= target) {
        return {
            type: 'UPGRADE_OPPORTUNITY',
            severity: 'MONEY',
            title: '🥂 Business Upgrade Deal',
            message: `Business Class upgrade available for ${upgradePrice} ${trip.currency} (Target: ${target}).`,
            actionLabel: 'Upgrade Now',
            potentialValue: 'Business Class',
        };
    }

    return null;
}


// Helper Function
function checkTripleEmptySeats(availableSeats: string[]): string | null {
    const rows = new Set(availableSeats.map(s => s.replace(/\D/g, '')));

    for (const row of Array.from(rows)) {
        if (
            availableSeats.includes(`${row}A`) &&
            availableSeats.includes(`${row}B`) &&
            availableSeats.includes(`${row}C`)
        ) {
            return `${row} (A-B-C)`;
        }
        if (
            availableSeats.includes(`${row}D`) &&
            availableSeats.includes(`${row}E`) &&
            availableSeats.includes(`${row}F`)
        ) {
            return `${row} (D-E-F)`;
        }
    }
    return null;
}
