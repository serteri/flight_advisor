import { FlightResult } from '@/types/hybridFlight';
import { getMedianPriceForRouteDate, isInvalidBneIstDuration, resolveFlightDurationMinutes, toMinutes } from '@/lib/search/flightSearchRecordStore';
import { hasIncludedMeal } from '@/lib/meal-utils';

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

// ── Intelligence Layer v2 ─────────────────────────────────────────────────
type PersonaKey = 'balanced' | 'business' | 'budget' | 'family';
type PersonaInput = 'comfort' | 'business' | 'budget' | 'family' | 'balanced';
type PreferenceProfile = {
    prefersDirect: boolean;
    prefersNight: boolean;
    preferredDepartureWindow: 'morning' | 'evening' | 'none';
    sampleSize: number;
};

const PERSONA_WEIGHTS: Record<PersonaKey, ScoreBreakdown> = {
    balanced: { priceValue: 0.20, duration: 0.15, stops: 0.10, connection: 0.10, selfTransfer: 0.10, baggage: 0.10, reliability: 0.10, aircraft: 0.05, amenities: 0.05, airportIndex: 0.05 },
    business: { priceValue: 0.10, duration: 0.22, stops: 0.10, connection: 0.12, selfTransfer: 0.08, baggage: 0.06, reliability: 0.14, aircraft: 0.05, amenities: 0.10, airportIndex: 0.03 },
    budget:   { priceValue: 0.56, duration: 0.10, stops: 0.08, connection: 0.06, selfTransfer: 0.05, baggage: 0.05, reliability: 0.04, aircraft: 0.02, amenities: 0.01, airportIndex: 0.03 },
    family:   { priceValue: 0.16, duration: 0.14, stops: 0.08, connection: 0.18, selfTransfer: 0.10, baggage: 0.20, reliability: 0.07, aircraft: 0.02, amenities: 0.03, airportIndex: 0.02 },
};

const BREAKDOWN_MAXES: ScoreBreakdown = {
    priceValue: 20, duration: 15, stops: 10, connection: 10, selfTransfer: 10,
    baggage: 10, reliability: 10, aircraft: 5, amenities: 5, airportIndex: 5,
};
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

const getDelayProbabilityFromReliability = (reliabilityScore: number): number => {
    if (reliabilityScore >= 9) return 8;
    if (reliabilityScore >= 8) return 12;
    if (reliabilityScore >= 7) return 18;
    if (reliabilityScore >= 6) return 24;
    if (reliabilityScore >= 5) return 30;
    return 38;
};

const computePriceIntel = (
    price: number,
    referencePrice: number,
    referenceSource: string,
): { label: 'Good Deal' | 'Below Average' | 'Fair Price' | 'Wait' | 'Likely to Increase'; deltaPercent: number; source: string } => {
    if (!Number.isFinite(referencePrice) || referencePrice <= 0 || !Number.isFinite(price) || price <= 0) {
        return { label: 'Fair Price', deltaPercent: 0, source: referenceSource };
    }
    const delta = (price - referencePrice) / referencePrice;
    const deltaPercent = Math.round(delta * 100);
    if (delta <= -0.20) return { label: 'Good Deal',             deltaPercent, source: referenceSource };
    if (delta <= -0.05) return { label: 'Below Average',         deltaPercent, source: referenceSource };
    if (delta <=  0.05) return { label: 'Fair Price',            deltaPercent, source: referenceSource };
    if (delta <=  0.20) return { label: 'Wait',                  deltaPercent, source: referenceSource };
    return               { label: 'Likely to Increase', deltaPercent, source: referenceSource };
};

const computeConfidenceScore = (flight: FlightResult): number => {
    let score = 0;
    if (Number.isFinite(flight.price) && flight.price > 0) score += 25;
    if (resolveAircraftCode(flight).length >= 3) score += 15;
    if (Number(flight.policies?.baggageKg) > 0 || flight.baggage) score += 20;
    const dep = String(flight.departTime || '');
    const arr = String(flight.arriveTime || '');
    const hasTz = (v: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v.trim());
    if (dep && arr && hasTz(dep) && hasTz(arr)) score += 20;
    else if (dep && arr) score += 10;
    if (flight.meal !== undefined || flight.amenities?.hasMeal !== undefined) score += 10;
    if (flight.stops === 0 || (Array.isArray(flight.layovers) && flight.layovers.length > 0)) score += 10;
    return Math.min(100, score);
};

const computePersonaScore = (breakdown: ScoreBreakdown, persona: PersonaKey = 'balanced'): number => {
    const weights = PERSONA_WEIGHTS[persona] ?? PERSONA_WEIGHTS.balanced;
    let total = 0;
    for (const key of Object.keys(weights) as (keyof ScoreBreakdown)[]) {
        total += (breakdown[key] / (BREAKDOWN_MAXES[key] || 1)) * weights[key];
    }
    return Number((total * 10).toFixed(1));
};

const resolvePersona = (persona?: PersonaInput): PersonaKey => {
    if (persona === 'business' || persona === 'budget' || persona === 'family' || persona === 'balanced') {
        return persona;
    }
    return 'balanced';
};

const resolveDepartureHour = (flight: FlightResult): number | null => {
    const raw = String(flight.departTime || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) return null;
    return parsed.getUTCHours();
};

const computePreferenceBonusRaw = (
    flight: FlightResult,
    profile?: PreferenceProfile
): number => {
    if (!profile || profile.sampleSize < 3) return 0;

    let bonus = 0;
    const departureHour = resolveDepartureHour(flight);

    if (profile.prefersDirect && flight.stops === 0) {
        bonus += 2;
    }

    if (profile.prefersNight && departureHour !== null && (departureHour >= 18 || departureHour < 6)) {
        bonus += 1.5;
    }

    if (profile.preferredDepartureWindow === 'morning' && departureHour !== null && departureHour >= 5 && departureHour < 12) {
        bonus += 1.5;
    }

    if (profile.preferredDepartureWindow === 'evening' && departureHour !== null && (departureHour >= 18 || departureHour < 1)) {
        bonus += 1.5;
    }

    return clamp(Number(bonus.toFixed(2)), 0, 5);
};

const generateScoreExplanation = (
    flight: FlightResult,
    breakdown: ScoreBreakdown,
    comfortNotes: string[],
    priceIntel: { label: string; deltaPercent: number },
    displayScore: number,
    connectionRisk: string,
    minConnectionMinutes: number,
): string => {
    const parts: string[] = [];
    if (flight.stops === 0) parts.push('direkt uçuş');
    if (priceIntel.label === 'Good Deal')
        parts.push(`fiyatı ortalamanın %${Math.abs(priceIntel.deltaPercent)} altında`);
    else if (priceIntel.label === 'Below Average')
        parts.push('fiyatı ortalamanın altında');
    else if (priceIntel.label === 'Likely to Increase')
        parts.push('fiyatı yükselme eğiliminde');
    const bagNote = comfortNotes.find(n => n.toLowerCase().includes('bagaj'));
    if (bagNote) parts.push(bagNote.replace(/^Check-in/, 'check-in').toLowerCase());
    if (comfortNotes.some(n => n.toLowerCase().includes('yemek'))) parts.push('yemek servisi dahil');
    if (breakdown.duration >= 13) parts.push('kısa seyahat süresi');
    if (connectionRisk === 'critical' && minConnectionMinutes > 0)
        parts.push(`${minConnectionMinutes}dk kritik aktarma riski`);
    else if (connectionRisk === 'high' && minConnectionMinutes > 0)
        parts.push(`${minConnectionMinutes}dk'lık sıkı aktarma`);
    if (comfortNotes.some(n => n.includes('Top-tier'))) parts.push('üst düzey havayolu güvenilirliği');
    if (parts.length === 0) return `Bu uçuş dengeli profiliyle ${displayScore.toFixed(1)} puan aldı.`;
    return `Bu uçuş ${parts.slice(0, 3).join(', ')} nedeniyle ${displayScore.toFixed(1)} puan aldı.`;
};
// ── End Intelligence Layer v2 ─────────────────────────────────────────────

const scoreFlight = (
    flight: FlightResult,
    context: {
        avgPrice: number;
        medianPrice: number | null;
        expectedRouteDuration: number;
        markInvalidData: boolean;
        invalidReason?: string;
        persona?: PersonaKey;
        preferenceProfile?: PreferenceProfile;
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
    } else if (priceDelta <= -0.1) {
        // 10% - 20% indirim bandı: 11..19 puan
        const discountRatio = Math.min(1, Math.max(0, ((-priceDelta) - 0.1) / 0.1));
        breakdown.priceValue = clamp(Math.round(11 + discountRatio * 8), 11, 19);
        comfortNotes.push('Fiyat rota ortalamasına göre avantajlı');
    } else if (priceDelta < 0) {
        // 0% - 10% indirim bandı: en fazla 10 puan
        const discountRatio = Math.min(1, Math.max(0, (-priceDelta) / 0.1));
        breakdown.priceValue = clamp(Math.round(6 + discountRatio * 4), 6, 10);
    } else if (priceDelta >= 0.3) {
        breakdown.priceValue = 4;
        riskFlags.push('Fiyat rota ortalamasına göre yüksek');
    } else {
        breakdown.priceValue = clamp(Math.round(10 - priceDelta * 20), 0, 10);
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
        if (layover.duration > 0) {
            if (layover.duration < 45) {
                breakdown.connection -= 6;
                riskFlags.push('Kritik Bağlantı Riski');
            } else if (layover.duration < 75) {
                breakdown.connection -= 3;
                riskFlags.push('Sıkı Aktarma Riski');
            } else if (layover.duration > 300) {
                breakdown.connection -= 2;
                riskFlags.push('Uzun aktarma beklemesi');
            }
        }
    });
    breakdown.connection = clamp(breakdown.connection, 0, 10);

    const layoverDurations = layovers.filter(l => l.duration > 0).map(l => l.duration);
    const minConnectionMinutes = layoverDurations.length > 0 ? Math.min(...layoverDurations) : -1;
    const connectionRisk: 'low' | 'medium' | 'high' | 'critical' =
        flight.stops === 0       ? 'low' :
        minConnectionMinutes < 0 ? 'low' :
        minConnectionMinutes < 45  ? 'critical' :
        minConnectionMinutes < 75  ? 'high' :
        minConnectionMinutes < 120 ? 'medium' : 'low';

    const selfTransfer = hasSelfTransferRisk(flight);
    breakdown.selfTransfer = selfTransfer ? 0 : 10;
    if (selfTransfer) {
        riskFlags.push('Kendi Transferin');
    }

    const checkedBaggage = Number(flight.policies?.baggageKg || 0);
    const cabinBaggage = Number(flight.policies?.cabinBagKg || 0);
    const baggageType = String(flight.baggage || '').toLowerCase();
    const hasCheckedByType = baggageType === 'checked';

    if (checkedBaggage >= 20) {
        breakdown.baggage = 10;
        comfortNotes.push('20kg+ check-in bagaj dahil');
    } else if (checkedBaggage >= 15) {
        breakdown.baggage = 9;
        comfortNotes.push('Check-in bagaj dahil');
    } else if (checkedBaggage > 0) {
        breakdown.baggage = 7;
        comfortNotes.push('Sınırlı check-in bagaj');
    } else if (hasCheckedByType) {
        breakdown.baggage = 8;
        comfortNotes.push('Check-in bagaj dahil (ağırlık bilgisi sınırlı)');
    } else if (checkedBaggage <= 0 && cabinBaggage > 0) {
        breakdown.baggage = 5;
        riskFlags.push('Sadece kabin bagajı');
    } else {
        breakdown.baggage = 4;
        riskFlags.push('Check-in bagaj dahil değil');
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

    const delayProbability = getDelayProbabilityFromReliability(reliability.score);

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

    const mealIncluded = hasIncludedMeal(flight);

    let amenitiesScore = 0;
    if (flight.amenities?.hasWifi || flight.wifi) {
        amenitiesScore += 2;
        comfortNotes.push('WiFi mevcut');
    }
    if (flight.amenities?.entertainment || flight.entertainment) {
        amenitiesScore += 1.5;
        comfortNotes.push('IFE eğlence sistemi mevcut');
    }
    if (mealIncluded) {
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

    const baseTotalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const preferenceBonusRaw = computePreferenceBonusRaw(flight, context.preferenceProfile);
    const totalScore = clamp(Number((baseTotalScore + preferenceBonusRaw).toFixed(2)), 0, 100);
    const displayScore = Number((totalScore / 10).toFixed(1));

    let valueTag = 'Dengeli Seçenek';
    const resolvedPersona = resolvePersona(context.persona as PersonaInput);
    const personaScore = computePersonaScore(breakdown, resolvedPersona);
    const priceIntel = computePriceIntel(validPrice, referencePrice, priceReferenceSource);
    const confidenceScore = computeConfidenceScore(flight);
    const finalRiskFlags = Array.from(new Set([
        ...riskFlags,
        ...(context.markInvalidData ? ['Veri Hatası', context.invalidReason || 'Gerçekçi olmayan süre tespit edildi.'] : []),
    ]));
    const finalComfortNotes = Array.from(new Set(comfortNotes));
    const explanation = context.markInvalidData
        ? undefined
        : generateScoreExplanation(flight, breakdown, finalComfortNotes, priceIntel, displayScore, connectionRisk, minConnectionMinutes);

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
            riskFlags: finalRiskFlags,
            comfortNotes: finalComfortNotes,
            valueTag: context.markInvalidData ? 'Veri Hatası' : valueTag,
            dataQuality: context.markInvalidData ? 'invalid' : 'valid',
            dataErrorReason: context.markInvalidData ? context.invalidReason : undefined,
            personaScore,
            persona: resolvedPersona,
            delayProbability,
            connectionRisk,
            minConnectionMinutes,
            priceIntel,
            confidenceScore,
            forYouBonus: Number((preferenceBonusRaw / 10).toFixed(2)),
            explanation,
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
        persona?: PersonaInput;
        preferenceProfile?: PreferenceProfile;
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
                persona: resolvePersona(options?.persona),
                preferenceProfile: options?.preferenceProfile,
            });
        })
        .sort((a, b) => (b.advancedScore?.totalScore || 0) - (a.advancedScore?.totalScore || 0));
}