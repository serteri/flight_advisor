/**
 * Mock Flight Generator v2
 * 
 * Creates realistic mock flights for BNE-IST and similar long-haul routes.
 * No direct flights exist - all go via Middle East/Asian hubs.
 */

// Hub mapping based on airline
const AIRLINE_HUBS: Record<string, { hub: string; hubCity: string }> = {
    'TK': { hub: 'IST', hubCity: 'Istanbul' },  // TK actually operates FROM IST, so this needs special handling
    'QR': { hub: 'DOH', hubCity: 'Doha' },
    'SQ': { hub: 'SIN', hubCity: 'Singapore' },
    'EK': { hub: 'DXB', hubCity: 'Dubai' },
    'EY': { hub: 'AUH', hubCity: 'Abu Dhabi' },
    'CZ': { hub: 'CAN', hubCity: 'Guangzhou' },
    'MU': { hub: 'PVG', hubCity: 'Shanghai' },
    'LH': { hub: 'FRA', hubCity: 'Frankfurt' },
    'BA': { hub: 'LHR', hubCity: 'London' },
    'MH': { hub: 'KUL', hubCity: 'Kuala Lumpur' },
    'CX': { hub: 'HKG', hubCity: 'Hong Kong' },
    'JQ': { hub: 'SIN', hubCity: 'Singapore' },
};

const AIRLINE_NAMES: Record<string, string> = {
    'TK': 'Turkish Airlines',
    'QR': 'Qatar Airways',
    'SQ': 'Singapore Airlines',
    'EK': 'Emirates',
    'EY': 'Etihad Airways',
    'CZ': 'China Southern',
    'MU': 'China Eastern',
    'LH': 'Lufthansa',
    'BA': 'British Airways',
    'MH': 'Malaysia Airlines',
    'CX': 'Cathay Pacific',
    'JQ': 'Jetstar',
};

export const generateMockFlights = (from: string, to: string, date: string) => {
    // Base templates for different carrier profiles
    const templates = [
        // Premium carriers - fastest, most expensive
        { carrier: 'SQ', basePrice: 29000, leg1Duration: 8 * 60, layover: 3 * 60, leg2Duration: 12 * 60, quality: 'high', baggage: 30 },
        { carrier: 'QR', basePrice: 34000, leg1Duration: 14 * 60, layover: 2 * 60 + 30, leg2Duration: 5 * 60, quality: 'high', baggage: 30 },
        { carrier: 'EK', basePrice: 41000, leg1Duration: 14 * 60 + 20, layover: 2 * 60, leg2Duration: 5 * 60 + 10, quality: 'high', baggage: 35 },
        { carrier: 'EY', basePrice: 31000, leg1Duration: 14 * 60 + 30, layover: 3 * 60, leg2Duration: 4 * 60 + 30, quality: 'high', baggage: 30 },

        // Mid-tier - longer but cheaper
        { carrier: 'CZ', basePrice: 20000, leg1Duration: 9 * 60, layover: 7 * 60, leg2Duration: 12 * 60, quality: 'medium', baggage: 46 },
        { carrier: 'MU', basePrice: 21000, leg1Duration: 10 * 60, layover: 5 * 60, leg2Duration: 11 * 60, quality: 'medium', baggage: 46 },
        { carrier: 'MH', basePrice: 26000, leg1Duration: 8 * 60, layover: 4 * 60, leg2Duration: 11 * 60, quality: 'medium', baggage: 30 },
        { carrier: 'CX', basePrice: 38000, leg1Duration: 9 * 60, layover: 3 * 60, leg2Duration: 12 * 60, quality: 'high', baggage: 30 },

        // European hub - longer route
        { carrier: 'LH', basePrice: 32000, leg1Duration: 22 * 60, layover: 2 * 60, leg2Duration: 3 * 60, quality: 'medium', baggage: 23 },

        // LCC - cheapest but worst
        { carrier: 'JQ', basePrice: 18000, leg1Duration: 8 * 60, layover: 8 * 60, leg2Duration: 13 * 60, quality: 'low', baggage: 0 },
    ];

    const flights: any[] = [];
    let idCounter = 1;

    // Generate 2-3 variations for each template
    templates.forEach(t => {
        // Morning departure
        flights.push(createFlight(idCounter++, t, from, to, date, '08:00', 0, 'Standard'));

        // Evening departure - slightly more expensive
        flights.push(createFlight(idCounter++, t, from, to, date, '18:00', t.basePrice * 0.1, 'Flex'));

        // Mid-day saver for premium airlines
        if (['SQ', 'QR', 'EK', 'EY'].includes(t.carrier)) {
            flights.push(createFlight(idCounter++, t, from, to, date, '12:00', -t.basePrice * 0.15, 'Saver'));
        }
    });

    return flights;
};

function createFlight(
    id: number,
    template: any,
    from: string,
    to: string,
    date: string,
    departureTime: string,
    priceAdj: number,
    fareType: string
) {
    const hub = AIRLINE_HUBS[template.carrier] || { hub: 'DXB', hubCity: 'Dubai' };
    const airlineName = AIRLINE_NAMES[template.carrier] || template.carrier;

    // Calculate times
    const [depHour, depMin] = departureTime.split(':').map(Number);
    const depMinutes = depHour * 60 + depMin;

    // First leg arrival
    const leg1ArrMinutes = depMinutes + template.leg1Duration;
    const leg1ArrHour = Math.floor(leg1ArrMinutes / 60) % 24;
    const leg1ArrMin = leg1ArrMinutes % 60;

    // Second leg departure (after layover)
    const leg2DepMinutes = leg1ArrMinutes + template.layover;
    const leg2DepHour = Math.floor(leg2DepMinutes / 60) % 24;
    const leg2DepMin = leg2DepMinutes % 60;

    // Final arrival
    const finalArrMinutes = leg2DepMinutes + template.leg2Duration;
    const finalArrHour = Math.floor(finalArrMinutes / 60) % 24;
    const finalArrMin = finalArrMinutes % 60;

    // Calculate days offset
    const daysOffset = Math.floor(finalArrMinutes / (24 * 60));

    const formatTime = (h: number, m: number) =>
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const totalDuration = template.leg1Duration + template.layover + template.leg2Duration;
    const price = Math.floor(template.basePrice + priceAdj);

    const isSaver = fareType === 'Saver';
    const isFlex = fareType === 'Flex';

    // Create Amadeus-compatible format
    const segment1 = {
        departure: {
            iataCode: from,
            at: `${date}T${formatTime(depHour, depMin)}:00`
        },
        arrival: {
            iataCode: hub.hub,
            at: `${date}T${formatTime(leg1ArrHour, leg1ArrMin)}:00`
        },
        carrierCode: template.carrier,
        number: String(100 + id),
        duration: `PT${Math.floor(template.leg1Duration / 60)}H${template.leg1Duration % 60}M`,
        id: `${id}-1`,
        operating: { carrierCode: template.carrier }
    };

    // Determine next day date if needed
    const leg2Date = daysOffset > 0 ? addDays(date, Math.floor(leg2DepMinutes / (24 * 60))) : date;
    const finalDate = daysOffset > 0 ? addDays(date, daysOffset) : date;

    const segment2 = {
        departure: {
            iataCode: hub.hub,
            at: `${leg2Date}T${formatTime(leg2DepHour, leg2DepMin)}:00`
        },
        arrival: {
            iataCode: to,
            at: `${finalDate}T${formatTime(finalArrHour, finalArrMin)}:00`
        },
        carrierCode: template.carrier,
        number: String(200 + id),
        duration: `PT${Math.floor(template.leg2Duration / 60)}H${template.leg2Duration % 60}M`,
        id: `${id}-2`,
        operating: { carrierCode: template.carrier }
    };

    return {
        type: 'flight-offer',
        id: String(id),
        source: 'MOCK',
        itineraries: [{
            duration: `PT${Math.floor(totalDuration / 60)}H${totalDuration % 60}M`,
            segments: [segment1, segment2]
        }],
        price: {
            currency: 'TRY',
            total: String(price),
            grandTotal: String(price)
        },
        validatingAirlineCodes: [template.carrier],
        pricingOptions: {
            fareType: ['PUBLISHED'],
            includedCheckedBagsOnly: true
        },
        travelerPricings: [{
            travelerId: '1',
            fareOption: 'STANDARD',
            travelerType: 'ADULT',
            price: { currency: 'TRY', total: String(price) },
            fareDetailsBySegment: [
                {
                    segmentId: `${id}-1`,
                    cabin: 'ECONOMY',
                    fareBasis: isSaver ? 'YOWUS' : (isFlex ? 'YFLXAU' : 'YOW'),
                    brandedFare: isSaver ? 'ECONOMY_LIGHT' : (isFlex ? 'ECONOMY_FLEX' : 'ECONOMY'),
                    class: 'Y',
                    includedCheckedBags: {
                        quantity: template.baggage > 23 ? 2 : (template.baggage === 0 ? 0 : 1),
                        weight: template.baggage,
                        weightUnit: 'KG'
                    }
                },
                {
                    segmentId: `${id}-2`,
                    cabin: 'ECONOMY',
                    fareBasis: isSaver ? 'YOWUS' : (isFlex ? 'YFLXAU' : 'YOW'),
                    brandedFare: isSaver ? 'ECONOMY_LIGHT' : (isFlex ? 'ECONOMY_FLEX' : 'ECONOMY'),
                    class: 'Y',
                    includedCheckedBags: {
                        quantity: template.baggage > 23 ? 2 : (template.baggage === 0 ? 0 : 1),
                        weight: template.baggage,
                        weightUnit: 'KG'
                    }
                }
            ]
        }],
        // Extra metadata
        dictionaries: {
            carriers: { [template.carrier]: airlineName }
        }
    };
}

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}
