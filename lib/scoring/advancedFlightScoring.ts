import { FlightResult } from '@/types/hybridFlight';

type ScoreBreakdown = {
    priceValue: number;
    duration: number;
    stops: number;
    connection: number;
    selfTransfer: number;
    baggage: number;
    reliability: number;
    aircraft: number;
    amenities: number;
    airportIndex: number;
};

const RELIABILITY_BY_AIRLINE: Record<string, number> = {
    'SINGAPORE AIRLINES': 9.3,
    'QATAR AIRWAYS': 8.9,
    'EMIRATES': 8.7,
    'TURKISH AIRLINES': 7.6,
    'LUFTHANSA': 7.4,
    'KLM': 7.8,
    'AIR FRANCE': 7.1,
    'BRITISH AIRWAYS': 6.8,
    'UNITED AIRLINES': 6.7,
    'AMERICAN AIRLINES': 6.4,
};

const AIRCRAFT_AGE: Record<string, number> = {
    A359: 4,
    A35K: 2,
    B789: 6,
    B78X: 4,
    A388: 16,
    B744: 26,
    B763: 24,
};

const EASY_AIRPORTS = new Set(['SIN', 'DOH', 'DXB', 'IST', 'AMS', 'MUC', 'ZRH', 'CPH']);
const HARD_AIRPORTS = new Set(['CDG', 'LHR', 'LGW', 'JFK', 'EWR', 'FRA']);

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const toMinutes = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        const isoMatch = trimmed.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
        if (isoMatch) {
            const hours = parseInt(isoMatch[1] || '0', 10);
            const mins = parseInt(isoMatch[2] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const hoursMinsMatch = trimmed.match(/(\d+)\s*h\s*(\d+)?\s*m?/i);
        if (hoursMinsMatch) {
            const hours = parseInt(hoursMinsMatch[1] || '0', 10);
            const mins = parseInt(hoursMinsMatch[2] || '0', 10);
            return Math.max(0, hours * 60 + mins);
        }

        const minsOnlyMatch = trimmed.match(/(\d+)\s*m(in)?/i);
        if (minsOnlyMatch) {
            return Math.max(0, parseInt(minsOnlyMatch[1], 10));
        }

        const asNumber = parseFloat(trimmed);
        if (Number.isFinite(asNumber)) {
            return Math.max(0, asNumber);
        }
    }

    return 0;
};

const resolveDurationMinutes = (flight: FlightResult): number => {
    const base = toMinutes(flight.duration);
    if (base > 0) return base;

    const dep = new Date(flight.departTime).getTime();
    const arr = new Date(flight.arriveTime).getTime();
    if (Number.isFinite(dep) && Number.isFinite(arr) && arr > dep) {
        return Math.round((arr - dep) / 60000);
    }

    return 0;
};

const resolveLayovers = (flight: FlightResult) =>
    (flight.layovers || []).map((layover) => ({
        airport: (layover.airport || '').toUpperCase(),
        duration: toMinutes(layover.duration),
    }));

const hasSelfTransferRisk = (flight: FlightResult): boolean => {
    const segments = Array.isArray(flight.segments) ? flight.segments : [];
    if (segments.length < 2) return false;

    const hasExplicitSelfTransfer = segments.some((segment: any) =>
        Boolean(segment?.self_transfer || segment?.selfTransfer || segment?.virtual_interlining)
    );
    if (hasExplicitSelfTransfer) return true;

    const pnrSet = new Set(
        segments
            .map((segment: any) => segment?.pnr || segment?.booking_reference || segment?.bookingReference)
            .filter(Boolean)
    );
    if (pnrSet.size > 1) return true;

    for (let index = 0; index < segments.length - 1; index++) {
        const current = segments[index] as any;
        const next = segments[index + 1] as any;

        const arrTerminal = (current?.arrival_terminal || current?.arrivalTerminal || '').toString().toUpperCase();
        const depTerminal = (next?.departure_terminal || next?.departureTerminal || '').toString().toUpperCase();
        if (arrTerminal && depTerminal && arrTerminal !== depTerminal) {
            return true;
        }
    }

    return false;
};

const resolveReliability = (airlineName: string): number => {
    const upper = airlineName.toUpperCase();
    const direct = RELIABILITY_BY_AIRLINE[upper];
    if (direct) return direct;

    const matchedKey = Object.keys(RELIABILITY_BY_AIRLINE).find((name) =>
        upper.includes(name)
    );
    if (matchedKey) {
        return RELIABILITY_BY_AIRLINE[matchedKey];
    }

    return 7;
};

const resolveAircraftCode = (flight: FlightResult): string => {
    const direct = (flight.aircraft || '').toUpperCase();
    if (direct) return direct;

    const firstSeg = (flight.segments || [])[0] as any;
    const segAircraft =
        firstSeg?.aircraft ||
        firstSeg?.aircraft_type ||
        firstSeg?.equipment ||
        firstSeg?.operating_aircraft;

    return (segAircraft || '').toString().toUpperCase();
};

const scoreFlight = (
    flight: FlightResult,
    context: {
        avgPrice: number;
        fastestDuration: number;
    }
) => {
    const breakdown: ScoreBreakdown = {
        priceValue: 0,
        duration: 0,
        stops: 0,
        connection: 0,
        selfTransfer: 0,
        baggage: 0,
        reliability: 0,
        aircraft: 0,
        amenities: 0,
        airportIndex: 0,
    };

    const riskFlags: string[] = [];
    const comfortNotes: string[] = [];

    const price = Number(flight.price);
    const validPrice = Number.isFinite(price) && price > 0 ? price : context.avgPrice;

    const durationMinutes = resolveDurationMinutes(flight);
    const fastestDuration = Math.max(1, context.fastestDuration);

    const priceDelta = context.avgPrice > 0 ? (validPrice - context.avgPrice) / context.avgPrice : 0;
    if (priceDelta <= -0.2) {
        breakdown.priceValue = 20;
        comfortNotes.push('Fiyat rota ortalamasına göre çok avantajlı');
    } else if (priceDelta >= 0.3) {
        breakdown.priceValue = 4;
        riskFlags.push('Fiyat rota ortalamasına göre yüksek');
    } else {
        breakdown.priceValue = clamp(Math.round(20 - Math.max(0, priceDelta) * 40 + Math.max(0, -priceDelta) * 30), 0, 20);
    }

    const durationPenaltyRatio = durationMinutes > 0 ? (durationMinutes - fastestDuration) / fastestDuration : 1;
    if (durationPenaltyRatio >= 0.25) {
        const penalty = Math.min(10, Math.round((durationPenaltyRatio - 0.25) * 20) + 4);
        breakdown.duration = clamp(15 - penalty, 0, 15);
        riskFlags.push('Uzun toplam seyahat süresi');
    } else {
        breakdown.duration = clamp(15 - Math.round(Math.max(0, durationPenaltyRatio) * 8), 0, 15);
    }

    breakdown.stops = flight.stops <= 0 ? 10 : flight.stops === 1 ? 8 : 4;
    if (flight.stops >= 2) {
        riskFlags.push('Çoklu aktarma');
    }

    breakdown.connection = 10;
    const layovers = resolveLayovers(flight);
    layovers.forEach((layover) => {
        if (layover.duration > 0 && layover.duration < 45) {
            breakdown.connection -= 4;
            riskFlags.push('Kısa Aktarma Riski');
        } else if (layover.duration > 300) {
            breakdown.connection -= 3;
            riskFlags.push('Uzun aktarma beklemesi');
        }
    });
    breakdown.connection = clamp(breakdown.connection, 0, 10);

    const selfTransfer = hasSelfTransferRisk(flight);
    breakdown.selfTransfer = selfTransfer ? 0 : 10;
    if (selfTransfer) {
        riskFlags.push('Kendi Transferin');
    }

    const checkedBaggage = Number(flight.policies?.baggageKg || 0);
    const cabinBaggage = Number(flight.policies?.cabinBagKg || 0);
    if (checkedBaggage >= 23) {
        breakdown.baggage = 10;
        comfortNotes.push('23kg+ check-in bagaj dahil');
    } else if (checkedBaggage <= 0 && cabinBaggage > 0) {
        breakdown.baggage = 5;
        riskFlags.push('Sadece kabin bagajı');
    } else {
        breakdown.baggage = checkedBaggage > 0 ? 7 : 4;
    }

    breakdown.reliability = clamp(Math.round(resolveReliability(flight.airline)), 0, 10);
    if (breakdown.reliability >= 8) {
        comfortNotes.push('Havayolu zamanında kalkış performansı güçlü');
    } else if (breakdown.reliability <= 6) {
        riskFlags.push('On-time güvenilirliği düşük');
    }

    const aircraftCode = resolveAircraftCode(flight);
    const aircraftAge = flight.aircraftAge || AIRCRAFT_AGE[aircraftCode] || 12;
    let aircraftScore = 2;
    if (aircraftCode.includes('A35') || aircraftCode.includes('B78')) {
        aircraftScore += 3;
        comfortNotes.push('Yeni nesil uçak (A350/787 ailesi)');
    }
    if (aircraftAge >= 20) {
        aircraftScore -= 2;
        riskFlags.push('Eski Uçak');
    }
    breakdown.aircraft = clamp(aircraftScore, 0, 5);

    let amenitiesScore = 0;
    if (flight.amenities?.hasWifi || flight.wifi) {
        amenitiesScore += 2;
        comfortNotes.push('WiFi mevcut');
    }
    if (flight.amenities?.entertainment || flight.entertainment) {
        amenitiesScore += 1.5;
        comfortNotes.push('IFE eğlence sistemi mevcut');
    }
    if (flight.amenities?.hasMeal || flight.meal === 'included') {
        amenitiesScore += 1.5;
        comfortNotes.push('Yemek servisi dahil');
    }
    breakdown.amenities = clamp(Math.round(amenitiesScore), 0, 5);

    let airportIndex = 5;
    layovers.forEach((layover) => {
        if (!layover.airport) return;
        if (EASY_AIRPORTS.has(layover.airport)) {
            airportIndex += 1;
        }
        if (HARD_AIRPORTS.has(layover.airport)) {
            airportIndex -= 2;
        }
    });
    breakdown.airportIndex = clamp(airportIndex, 0, 5);

    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const displayScore = Number((totalScore / 10).toFixed(1));

    let valueTag = 'Dengeli Seçenek';
    if (breakdown.priceValue >= 16 && totalScore >= 75) {
        valueTag = 'En İyi Fiyat/Performans';
    } else if (breakdown.amenities >= 4 && breakdown.duration >= 12) {
        valueTag = 'En Konforlu Seçenek';
    } else if (breakdown.reliability >= 8 && breakdown.connection >= 8) {
        valueTag = 'Düşük Riskli Seçenek';
    }

    return {
        ...flight,
        duration: durationMinutes,
        agentScore: displayScore,
        advancedScore: {
            totalScore,
            displayScore,
            breakdown,
            riskFlags: Array.from(new Set(riskFlags)),
            comfortNotes: Array.from(new Set(comfortNotes)),
            valueTag,
        },
    } as FlightResult;
};

export function applyAdvancedFlightScoring(flights: FlightResult[]): FlightResult[] {
    const validPrices = flights
        .map((flight) => Number(flight.price))
        .filter((price) => Number.isFinite(price) && price > 0);
    const avgPrice = validPrices.length
        ? validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length
        : 0;

    const durations = flights
        .map(resolveDurationMinutes)
        .filter((duration) => Number.isFinite(duration) && duration > 0);
    const fastestDuration = durations.length ? Math.min(...durations) : 1;

    return flights
        .map((flight) =>
            scoreFlight(flight, {
                avgPrice,
                fastestDuration,
            })
        )
        .sort((a, b) => (b.advancedScore?.totalScore || 0) - (a.advancedScore?.totalScore || 0));
}