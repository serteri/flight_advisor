import { FlightResult } from '@/types/hybridFlight';
import { getMedianPriceForRouteDate, isInvalidBneIstDuration, resolveFlightDurationMinutes, toMinutes } from '@/lib/search/flightSearchRecordStore';

// @ts-ignore
import airports from 'airports';

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

const TOP_AIRLINES = new Set([
    'SINGAPORE AIRLINES',
    'QATAR AIRWAYS',
    'EMIRATES',
    'ANA',
    'ALL NIPPON AIRWAYS',
    'JAPAN AIRLINES',
    'CATHAY PACIFIC',
    'EVA AIR',
    'HONG KONG AIRLINES',
    'HONG KONG AIRWAYS',
    'LUFTHANSA',
    'SWISS',
    'AUSTRIAN AIRLINES',
    'KLM',
    'AIR FRANCE',
    'TURKISH AIRLINES',
    'QANTAS',
    'ETIHAD AIRWAYS',
    'BRITISH AIRWAYS',
    'VIRGIN ATLANTIC',
    'AIR NEW ZEALAND',
    'DELTA AIR LINES',
    'DELTA',
    'UNITED AIRLINES',
    'AMERICAN AIRLINES',
    'KOREAN AIR',
    'ASIANA AIRLINES',
    'FINNAIR',
    'IBERIA',
    'AIR CANADA',
]);

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const EARTH_RADIUS_KM = 6371;
const CRUISE_SPEED_KMH = 850;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const getAirportCoords = (iataCode?: string): { lat: number; lon: number } | null => {
    if (!iataCode) return null;
    const code = iataCode.toUpperCase();
    const airport = (airports as any[]).find((item: any) => item?.iata === code);
    if (!airport) return null;

    const lat = Number(airport.lat);
    const lon = Number(airport.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon };
};

const getGreatCircleDistanceKm = (origin?: string, destination?: string): number | null => {
    const from = getAirportCoords(origin);
    const to = getAirportCoords(destination);
    if (!from || !to) return null;

    const dLat = toRadians(to.lat - from.lat);
    const dLon = toRadians(to.lon - from.lon);
    const fromLat = toRadians(from.lat);
    const toLat = toRadians(to.lat);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(fromLat) * Math.cos(toLat);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
};

const getExpectedRouteDurationMinutes = (origin?: string, destination?: string): number => {
    const distanceKm = getGreatCircleDistanceKm(origin, destination);
    if (!distanceKm || !Number.isFinite(distanceKm) || distanceKm <= 0) {
        return 0;
    }
    return Math.max(60, Math.round((distanceKm / CRUISE_SPEED_KMH) * 60));
};

const resolveDurationMinutes = (flight: FlightResult): number => {
    return resolveFlightDurationMinutes(flight);
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

const resolveReliability = (airlineName: string): { score: number; isTopAirline: boolean } => {
    const upper = airlineName.toUpperCase();
    const isTopAirline = Array.from(TOP_AIRLINES).some((name) => upper.includes(name));

    const direct = RELIABILITY_BY_AIRLINE[upper];
    if (direct) {
        const boosted = isTopAirline ? 10 : Math.max(0, Math.round(direct) - 2);
        return { score: boosted, isTopAirline };
    }

    const matchedKey = Object.keys(RELIABILITY_BY_AIRLINE).find((name) =>
        upper.includes(name)
    );
    if (matchedKey) {
        const base = RELIABILITY_BY_AIRLINE[matchedKey];
        const boosted = isTopAirline ? 10 : Math.max(0, Math.round(base) - 2);
        return { score: boosted, isTopAirline };
    }

    const fallback = isTopAirline ? 10 : 5;
    return { score: fallback, isTopAirline };
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
        medianPrice: number | null;
        expectedRouteDuration: number;
        markInvalidData: boolean;
        invalidReason?: string;
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
    const expectedRouteDuration = Math.max(1, context.expectedRouteDuration || durationMinutes || 1);

    const referencePrice =
        typeof context.medianPrice === 'number' && context.medianPrice > 0
            ? context.medianPrice
            : context.avgPrice;
    const priceReferenceSource =
        typeof context.medianPrice === 'number' && context.medianPrice > 0
            ? 'historicalMedian'
            : 'liveAverage';
    const priceDelta = referencePrice > 0 ? (validPrice - referencePrice) / referencePrice : 0;
    if (priceDelta <= -0.2) {
        breakdown.priceValue = 20;
        comfortNotes.push('Fiyat rota ortalamasına göre çok avantajlı');
    } else if (priceDelta >= 0.3) {
        breakdown.priceValue = 4;
        riskFlags.push('Fiyat rota ortalamasına göre yüksek');
    } else {
        breakdown.priceValue = clamp(Math.round(20 - Math.max(0, priceDelta) * 40 + Math.max(0, -priceDelta) * 30), 0, 20);
    }

    const durationRatio = durationMinutes > 0 ? durationMinutes / expectedRouteDuration : 2;
    if (durationRatio <= 1) {
        breakdown.duration = 15;
    } else if (durationRatio <= 1.25) {
        breakdown.duration = clamp(Math.round(15 - (durationRatio - 1) * 20), 10, 15);
    } else {
        const penalty = Math.min(10, Math.round((durationRatio - 1.25) * 20) + 4);
        breakdown.duration = clamp(15 - penalty, 0, 15);
        riskFlags.push('Uzun toplam seyahat süresi');
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

    const reliability = resolveReliability(flight.airline);
    breakdown.reliability = clamp(reliability.score, 0, 10);
    if (reliability.isTopAirline) {
        comfortNotes.push('Top-tier havayolu itibarı');
    } else {
        riskFlags.push('Top-30 havayolu dışında');
    }
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
            priceReference: {
                source: priceReferenceSource,
                amount: Number.isFinite(referencePrice) ? referencePrice : 0,
            },
            breakdown,
            riskFlags: Array.from(new Set([
                ...riskFlags,
                ...(context.markInvalidData ? ['Veri Hatası', context.invalidReason || 'Gerçekçi olmayan süre tespit edildi.'] : []),
            ])),
            comfortNotes: Array.from(new Set(comfortNotes)),
            valueTag: context.markInvalidData ? 'Veri Hatası' : valueTag,
            dataQuality: context.markInvalidData ? 'invalid' : 'valid',
            dataErrorReason: context.markInvalidData ? context.invalidReason : undefined,
        },
    } as FlightResult;
};

export async function applyAdvancedFlightScoring(
    flights: FlightResult[],
    options?: {
        origin?: string;
        destination?: string;
        departureDate?: string;
        useHistoricalMedian?: boolean;
    }
): Promise<FlightResult[]> {
    const validPrices = flights
        .map((flight) => Number(flight.price))
        .filter((price) => Number.isFinite(price) && price > 0);
    const avgPrice = validPrices.length
        ? validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length
        : 0;

    const expectedRouteDuration = getExpectedRouteDurationMinutes(options?.origin, options?.destination);

    let medianPrice: number | null = null;
    if (
        options?.useHistoricalMedian &&
        options?.origin &&
        options?.destination &&
        options?.departureDate
    ) {
        try {
            medianPrice = await getMedianPriceForRouteDate(
                options.origin,
                options.destination,
                options.departureDate
            );
        } catch (error) {
            console.warn('[ADVANCED_SCORING] median lookup failed:', error);
        }
    }

    return flights
        .map((flight) => {
            const markInvalidData = isInvalidBneIstDuration(flight);
            const invalidReason = markInvalidData
                ? 'BNE-IST için 14 saatin altındaki toplam süre gerçekçi değil.'
                : undefined;

            return scoreFlight(flight, {
                avgPrice,
                medianPrice,
                expectedRouteDuration,
                markInvalidData,
                invalidReason,
            });
        })
        .sort((a, b) => (b.advancedScore?.totalScore || 0) - (a.advancedScore?.totalScore || 0));
}