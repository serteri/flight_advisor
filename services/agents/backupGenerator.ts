// services/agents/backupGenerator.ts
/**
 * 🛡️ Backup Generator (Canavar #7 - Elite)
 * 
 * LEGAL CONTEXT:
 * When a flight is cancelled, passengers have TWO rights under IATA:
 * 1. Involuntary Refund - Full money back
 * 2. Endorsement (Duty of Care) - Airline must get you there ASAP
 * 
 * This module empowers passengers with DATA to demand endorsement to 
 * competitor airlines instead of waiting 18 hours for the next available flight.
 */

export interface AlternativeFlight {
    // Flight Details
    carrier: string;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    arrivalTime: string;
    duration: number; // minutes

    // Availability
    availableSeats: number;
    cabinClass: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

    // Timing
    departureOffset: number; // minutes from original flight time
    timeAdvantage: number;   // hours saved vs original airline's next flight

    // Endorsement Info
    isEndorseable: boolean;
    endorsementNote?: string; // "Same alliance - easy endorsement"
    estimatedWaitTime?: string; // "Counter staff can process in 10 mins"

    // Booking
    officialBookingLink?: string;
    price?: number; // For reference (you won't pay - endorsed ticket)
}

export interface BackupGeneratorResult {
    hasAlternatives: boolean;
    alternatives: AlternativeFlight[];
    originalNextFlight?: {
        departureTime: string;
        hoursDelay: number;
    };
    recommendation: string;
    endorsementStrategy: string; // What to say at counter
}

/**
 * Finds alternative flights when original is cancelled
 * Uses Amadeus SeatMap + RapidAPI to find open seats on competitor flights
 */
export async function generateBackupOptions(
    cancelledFlight: {
        origin: string;
        destination: string;
        originalDepartureTime: string;
        carrier: string;
        cabinClass: string;
    },
    searchWindowHours: number = 24
): Promise<BackupGeneratorResult> {

    const originalTime = new Date(cancelledFlight.originalDepartureTime);
    const searchStart = new Date();
    const searchEnd = new Date(originalTime.getTime() + searchWindowHours * 60 * 60 * 1000);

    // 1. Query alternative flights within time window
    // In production: Call Amadeus Flight Low-Fare Search or RapidAPI
    const alternatives = await findAlternativeFlights(
        cancelledFlight.origin,
        cancelledFlight.destination,
        searchStart,
        searchEnd,
        cancelledFlight.cabinClass
    );

    // 2. Filter for endorseable flights (alliance partners or duty of care eligible)
    const endorseable = alternatives.filter(alt =>
        isEndorseableCarrier(cancelledFlight.carrier, alt.carrier)
    );

    // 3. Get original airline's next available flight
    const originalAirlineNext = alternatives.find(alt =>
        alt.carrier === cancelledFlight.carrier
    );

    const hoursDelay = originalAirlineNext
        ? Math.round((new Date(originalAirlineNext.departureTime).getTime() - originalTime.getTime()) / (1000 * 60 * 60))
        : 24;

    // 4. Calculate time advantage for each alternative
    const rankedAlternatives = endorseable
        .map(alt => ({
            ...alt,
            timeAdvantage: hoursDelay - (alt.departureOffset / 60)
        }))
        .sort((a, b) => a.departureOffset - b.departureOffset) // Soonest first
        .slice(0, 5); // Top 5 options

    // 5. Generate endorsement strategy
    const bestOption = rankedAlternatives[0];
    const endorsementStrategy = bestOption
        ? generateEndorsementScript(cancelledFlight.carrier, bestOption, hoursDelay)
        : "No suitable alternatives found. Request full refund under involuntary cancellation rights.";

    return {
        hasAlternatives: rankedAlternatives.length > 0,
        alternatives: rankedAlternatives,
        originalNextFlight: originalAirlineNext ? {
            departureTime: originalAirlineNext.departureTime,
            hoursDelay
        } : undefined,
        recommendation: bestOption
            ? `✈️ ${bestOption.carrier}${bestOption.flightNumber} departs in ${Math.round(bestOption.departureOffset / 60)}h - ${Math.round(bestOption.timeAdvantage)}h earlier!`
            : "Request involuntary refund and book alternative yourself.",
        endorsementStrategy
    };
}

/**
 * Checks if carrier B can accept endorsed ticket from carrier A
 */
function isEndorseableCarrier(originalCarrier: string, alternativeCarrier: string): boolean {
    // Alliance mapping
    const starAlliance = ['TK', 'LH', 'UA', 'AC', 'SQ', 'NH', 'OZ', 'TG'];
    const oneWorld = ['QF', 'AA', 'BA', 'CX', 'IB', 'JL', 'QR', 'AY'];
    const skyTeam = ['AF', 'KL', 'DL', 'AZ', 'AM', 'KE', 'VS', 'SV'];

    const isSameAlliance =
        (starAlliance.includes(originalCarrier) && starAlliance.includes(alternativeCarrier)) ||
        (oneWorld.includes(originalCarrier) && oneWorld.includes(alternativeCarrier)) ||
        (skyTeam.includes(originalCarrier) && skyTeam.includes(alternativeCarrier));

    // Same alliance = easy endorsement
    // Different alliance = possible under "duty of care" but requires supervisor approval
    return isSameAlliance;
}

/**
 * Generates script for passenger to use at counter
 */
function generateEndorsementScript(
    originalCarrier: string,
    alternative: AlternativeFlight,
    originalDelayHours: number
): string {
    return `
ENDORSEMENT REQUEST SCRIPT (Use at Check-in Counter):

"Good morning/afternoon. My flight ${originalCarrier} was cancelled. 
I understand I have two options under IATA regulations:

1. Full involuntary refund
2. Endorsement to get me to my destination ASAP

I've researched and found ${alternative.carrier} flight ${alternative.flightNumber} 
departing in ${Math.round(alternative.departureOffset / 60)} hours with ${alternative.availableSeats} available seats.

Your next ${originalCarrier} flight is ${originalDelayHours} hours away. 
I formally request endorsement to ${alternative.carrier}${alternative.flightNumber} 
under your Duty of Care obligation.

${alternative.endorsementNote || 'This is within the same alliance and should be processed immediately.'}

If this is not possible, I will take the involuntary refund and book this flight myself, 
then pursue compensation for the denied endorsement."

🎯 KEY POINTS:
- Be polite but firm
- Use the word "involuntary refund" (magic phrase)
- Mention "Duty of Care" (legal obligation)
- Show them the alternative flight details on your phone
- If they refuse, ask for supervisor
  `.trim();
}

/**
 * Mock function - In production, calls Amadeus/RapidAPI
 */
async function findAlternativeFlights(
    origin: string,
    destination: string,
    startTime: Date,
    endTime: Date,
    cabinClass: string
): Promise<AlternativeFlight[]> {
    // Production: Call actual API
    // For now, return mock data with realistic alternatives

    const mockAlternatives: AlternativeFlight[] = [
        {
            carrier: 'QF',
            flightNumber: '52',
            origin,
            destination,
            departureTime: new Date(startTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            arrivalTime: new Date(startTime.getTime() + 16 * 60 * 60 * 1000).toISOString(),
            duration: 840,
            availableSeats: 4,
            cabinClass: 'ECONOMY',
            departureOffset: 120, // 2 hours from now
            timeAdvantage: 16, // 16 hours earlier than original airline's next flight
            isEndorseable: true,
            endorsementNote: "Same OneWorld alliance - counter staff can process immediately",
            estimatedWaitTime: "10-15 minutes"
        },
        {
            carrier: 'VA',
            flightNumber: 'VA7',
            origin,
            destination,
            departureTime: new Date(startTime.getTime() + 4 * 60 * 60 * 1000).toISOString(),
            arrivalTime: new Date(startTime.getTime() + 18 * 60 * 60 * 1000).toISOString(),
            duration: 840,
            availableSeats: 12,
            cabinClass: 'ECONOMY',
            departureOffset: 240, // 4 hours from now
            timeAdvantage: 14,
            isEndorseable: false, // Different alliance - requires supervisor
            endorsementNote: "Not same alliance - request supervisor for duty of care endorsement"
        }
    ];

    return mockAlternatives;
}

/**
 * Multi-language support for endorsement script
 */
export function getEndorsementScriptTranslation(
    language: 'tr' | 'en' | 'de',
    data: { carrier: string; flightNumber: string; delayHours: number; alternativeCarrier: string }
): string {
    const scripts = {
        tr: `
İYİ SABAHLAR/İYİ GÜNLER. ${data.carrier} uçuşum iptal oldu.
IATA düzenlemeleri gereği iki hakkım olduğunu biliyorum:

1. Tam geri ödeme (involuntary refund)
2. Beni hedefe en kısa sürede ulaştırmanız (endorsement/Duty of Care)

Araştırdım ve ${data.alternativeCarrier} ${data.flightNumber} uçuşunda ${data.delayHours} saat önce 
hareket eden boş koltuklar buldum. 

Biletimi bu uçuşa aktarmanızı (endorse) talep ediyorum.
Reddederseniz, tam geri ödeme alıp kendim rezervasyon yapacağım ve tazminat için başvuracağım.
    `.trim(),

        en: `
GOOD MORNING/AFTERNOON. My ${data.carrier} flight was cancelled.
I understand I have two rights under IATA:

1. Full involuntary refund
2. Endorsement to get me there ASAP (Duty of Care)

I found ${data.alternativeCarrier} ${data.flightNumber} departing ${data.delayHours} hours earlier 
with available seats.

I formally request endorsement to this flight.
If denied, I'll take involuntary refund and pursue compensation.
    `.trim(),

        de: `
GUTEN MORGEN/TAG. Mein ${data.carrier} Flug wurde storniert.
Ich habe zwei Rechte gemäß IATA:

1. Vollständige Rückerstattung (involuntary refund)
2. Endorsement zum nächsten verfügbaren Flug (Duty of Care)

Ich habe ${data.alternativeCarrier} ${data.flightNumber} gefunden, ${data.delayHours} Stunden früher.

Ich fordere formell Endorsement zu diesem Flug.
    `.trim()
    };

    return scripts[language];
}
