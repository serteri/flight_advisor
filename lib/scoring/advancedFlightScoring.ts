import { normalizeSource } from '@/lib/utils';
import { getMedianPriceForRouteDate, isInvalidBneIstDuration, resolveFlightDurationMinutes, toMinutes } from '@/lib/search/flightSearchRecordStore';
import { hasIncludedMeal } from '@/lib/meal-utils';
import type { UnifiedFlight, ScoredFlight, FlightScore } from '@/types/unifiedFlight';

type ScoringFlight = Omit<UnifiedFlight, 'baggage' | 'policies'> & {
    departTime: string;
    arriveTime: string;
    soldBy?: Array<{
        source: UnifiedFlight['source'];
        airline: string;
        price: number;
        currency: string;
    }>;
    airlineCode?: string;
    aircraft?: string;
    aircraftAge?: number;
    meal?: unknown;
    amenities?: {
        hasMeal?: boolean;
        hasWifi?: boolean;
        entertainment?: boolean;
    };
    wifi?: unknown;
    entertainment?: unknown;
    baggage?: string;
    canonicalBaggage?: UnifiedFlight['baggage'];
    policies?: {
        baggageKg?: number;
        cabinBagKg?: number;
        refundable?: boolean;
        changeAllowed?: boolean;
        changeFee?: string;
    };
    canonicalPolicies?: UnifiedFlight['policies'];
    tags?: string[];
    score?: number;
};

const toScoringFlight = (unified: UnifiedFlight): ScoringFlight => ({
    ...unified,
    departTime: unified.departureTime,
    arriveTime: unified.arrivalTime,
    baggage: unified.baggage?.included ? 'checked' : '',
    canonicalBaggage: unified.baggage,
    policies: {
        baggageKg: unified.baggage?.checked?.kg,
        cabinBagKg: unified.baggage?.cabin?.kg,
        refundable: unified.policies?.refundable,
        changeAllowed: unified.policies?.changeAllowed,
        changeFee: unified.policies?.changeFee,
    },
    canonicalPolicies: unified.policies,
});

const asUnifiedFlightForMetrics = (flight: ScoringFlight): UnifiedFlight => ({
    ...(flight as unknown as UnifiedFlight),
    baggage: flight.canonicalBaggage,
    policies: flight.canonicalPolicies,
});

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

// ── REAL DATA HIERARCHY: Premium vs Low-Cost ────────────────────────────────
const PREMIUM_AIRLINES = new Set([
    'SINGAPORE AIRLINES',
    'QATAR AIRWAYS',
    'EMIRATES',
    'ANA',
    'ALL NIPPON AIRWAYS',
    'JAPAN AIRLINES',
    'CATHAY PACIFIC',
    'EVA AIR',
    'SWISS',
    'LUFTHANSA',
    'KLM',
]);

const BUDGET_AIRLINES = new Set([
    'RYANAIR',
    'EASYJET',
    'WIZZ AIR',
    'SPIRIT AIRLINES',
    'FRONTIER AIRLINES',
    'AIRASIA',
    'LION AIR',
    'INDIGO',
    'GO FIRST',
]);

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
type PersonaKey = 'comfort' | 'business' | 'budget' | 'family' | 'balanced';
type PersonaInput = 'comfort' | 'business' | 'budget' | 'family' | 'balanced';
type PreferenceProfile = {
    prefersDirect: boolean;
    prefersNight: boolean;
    preferredDepartureWindow: 'morning' | 'evening' | 'none';
    sampleSize: number;
};

type PersonalBiasProfile = {
    priceWeightBoost: number;
    directPenaltyBoost: number;
    loyaltyAirline?: string | null;
    loyaltyBoost: number;
    avoidMultiStopWeight?: number;
    avoidNightWeight?: number;
};

const PERSONA_WEIGHTS: Record<PersonaKey, ScoreBreakdown> = {
    // Raw weights used in Score = Σ(weight_i × normalized_feature_i), then normalized by total weight.
    comfort:  { priceValue: 0.5, duration: 0.8, stops: 0.6, connection: 0.7, selfTransfer: 0.6, baggage: 0.6, reliability: 0.7, aircraft: 0.5, amenities: 0.8, airportIndex: 0.4 },
    balanced: { priceValue: 0.5, duration: 0.8, stops: 0.6, connection: 0.7, selfTransfer: 0.6, baggage: 0.6, reliability: 0.7, aircraft: 0.5, amenities: 0.8, airportIndex: 0.4 },
    business: { priceValue: 0.4, duration: 0.9, stops: 0.7, connection: 0.8, selfTransfer: 0.7, baggage: 0.5, reliability: 0.8, aircraft: 0.5, amenities: 0.8, airportIndex: 0.3 },
    // User request: Budget => price 1.0, all other features 0.2
    budget:   { priceValue: 1.0, duration: 0.2, stops: 0.2, connection: 0.2, selfTransfer: 0.2, baggage: 0.2, reliability: 0.2, aircraft: 0.2, amenities: 0.2, airportIndex: 0.2 },
    // User request: Family => baggage 0.9, short connection 0.9 (modeled via connection feature), price 0.5, others 0.2
    family:   { priceValue: 0.5, duration: 0.2, stops: 0.2, connection: 0.9, selfTransfer: 0.2, baggage: 0.9, reliability: 0.2, aircraft: 0.2, amenities: 0.2, airportIndex: 0.2 },
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

const resolveDurationMinutes = (flight: ScoringFlight): number => {
    return resolveFlightDurationMinutes(asUnifiedFlightForMetrics(flight));
};

// ── DEDUPLICATION ──────────────────────────────────────────────────────────
// Merge flights with same departure time, arrival time, route, and operating_airline
// Keep lowest price variant and track all marketing airlines in "Sold by" list
const deduplicateFlights = (flights: ScoringFlight[]): ScoringFlight[] => {
    const groups = new Map<string, ScoringFlight[]>();
    
    flights.forEach((flight) => {
        const departTime = String(flight.departTime || '').trim();
        const arriveTime = String(flight.arriveTime || '').trim();
        const route = `${flight.from || ''}|${flight.to || ''}`;
        // Use operating_airline if available, otherwise use marketing airline
        const operatingAirline = String(flight.operatingAirline || flight.airline || '').toUpperCase();
        
        const key = [departTime, arriveTime, route, operatingAirline].join('||');
        
        if (!groups.has(key)) {
            groups.set(key, []);
        }
        groups.get(key)!.push(flight);
    });
    
    // For each group, keep lowest price and track all sold-by airlines
    const result: ScoringFlight[] = [];
    groups.forEach((flightGroup) => {
        // Sort by price to get lowest first
        flightGroup.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        const baseFlight = flightGroup[0];
        
        // Track all airlines that sell this flight
        const soldBySet = new Set<string>();
        flightGroup.forEach((flight) => {
            soldBySet.add(`${normalizeSource(flight.source)}:${flight.airline}`);
        });
        
        // Create soldBy array with unique airline/source combinations
        const soldBy: typeof baseFlight.soldBy = Array.from(soldBySet)
            .map((entry) => {
                const [normalizedSrc, airline] = entry.split(':');
                const flightData = flightGroup.find(f => normalizeSource(f.source) === normalizedSrc && f.airline === airline);
                return {
                    // Preserve original provider identity — flightData.source is already FlightSource.
                    // Fallback to baseFlight.source (also FlightSource), never to the raw normalizedSrc string.
                    source: flightData?.source ?? baseFlight.source,
                    airline,
                    price: flightData?.price || baseFlight.price,
                    currency: flightData?.currency || baseFlight.currency,
                };
            });
        
        // Merge into base flight
        baseFlight.soldBy = soldBy.length > 1 ? soldBy : undefined;
        result.push(baseFlight);
    });
    
    return result;
};

const resolveLayovers = (flight: ScoringFlight) =>
    (flight.layovers || []).map((layover) => ({
        airport: (layover.airport || '').toUpperCase(),
        duration: toMinutes(layover.duration),
    }));

// ── REAL LAYOVER COMPUTATION: next_leg.departure − prev_leg.arrival ────────
type ResolvedLayover = {
    durationMinutes: number;
    airport: string;
    fromAirline: string;
    toAirline: string;
    isSameAirline: boolean;
};

const resolveLayoversFromSegments = (flight: ScoringFlight): ResolvedLayover[] => {
    const segments = Array.isArray(flight.segments) ? flight.segments : [];
    const result: ResolvedLayover[] = [];

    for (let i = 0; i < segments.length - 1; i++) {
        const cur = segments[i] as any;
        const next = segments[i + 1] as any;

        const arrRaw = cur?.arriving_at || cur?.arrival_time || cur?.arrival;
        const depRaw = next?.departing_at || next?.departure_time || next?.departure;
        const airport = String(
            cur?.destination?.iata_code || cur?.destination_airport?.iata_code ||
            cur?.destination || cur?.arrival_airport || ''
        ).toUpperCase();
        const fromAirline = String(
            cur?.operating_carrier?.name || cur?.operating_carrier?.iata_code ||
            cur?.airline || flight.airline || ''
        ).toUpperCase();
        const toAirline = String(
            next?.operating_carrier?.name || next?.operating_carrier?.iata_code ||
            next?.airline || flight.airline || ''
        ).toUpperCase();
        const isSameAirline = fromAirline.length > 0 && fromAirline === toAirline;

        if (arrRaw && depRaw) {
            const arrMs = new Date(arrRaw).getTime();
            const depMs = new Date(depRaw).getTime();
            if (Number.isFinite(arrMs) && Number.isFinite(depMs) && depMs > arrMs) {
                result.push({ durationMinutes: Math.round((depMs - arrMs) / 60000), airport, fromAirline, toAirline, isSameAirline });
                continue;
            }
        }
        // Fallback to pre-computed layover at matching index
        const fallback = (flight.layovers || [])[i];
        if (fallback) {
            result.push({ durationMinutes: toMinutes(fallback.duration), airport: (fallback.airport || airport || '').toUpperCase(), fromAirline, toAirline, isSameAirline });
        }
    }

    // If no segments produced results, fall back entirely to flight.layovers
    if (result.length === 0) {
        return (flight.layovers || []).map((lay) => ({
            durationMinutes: toMinutes(lay.duration),
            airport: (lay.airport || '').toUpperCase(),
            fromAirline: flight.airline.toUpperCase(),
            toAirline: flight.airline.toUpperCase(),
            isSameAirline: true,
        }));
    }

    return result;
};

const hasSelfTransferRisk = (flight: ScoringFlight): boolean => {
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

const resolveAircraftCode = (flight: ScoringFlight): string => {
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

// ── UNIFIED DELAY HEURISTIC — no fake precision numbers ─────────────────────
type DelayHeuristic = {
    label: string;
    category: 'low' | 'medium' | 'high';
};

const resolveDelayHeuristic = (airlineName: string, routeDistanceKm?: number | null): DelayHeuristic => {
    const upper = airlineName.toUpperCase();
    // Long-haul routes (>4000 km) get a stability boost — dedicated ops, fewer weather disruptions
    const isLongHaul = typeof routeDistanceKm === 'number' && routeDistanceKm > 4000;

    // Premium carriers → always low risk
    if (Array.from(PREMIUM_AIRLINES).some((name) => upper.includes(name))) {
        return { label: 'Low delay risk', category: 'low' };
    }

    // Budget carriers → higher risk, but long-haul bumps down one level
    if (Array.from(BUDGET_AIRLINES).some((name) => upper.includes(name))) {
        if (isLongHaul) return { label: 'Typical delay risk (~20%)', category: 'medium' };
        return { label: 'Higher delay risk', category: 'high' };
    }

    // Mid-tier on long-haul → lower risk due to route stability
    if (isLongHaul) return { label: 'Low-moderate delay risk', category: 'low' };

    // Default mid-tier
    return { label: 'Typical delay risk', category: 'medium' };
};

const computePriceIntel = (
    price: number,
    referencePrice: number,
    referenceSource: string,
): { label: 'Strong deal' | 'Below average' | 'Fair price' | 'Monitor price' | 'Expect increase'; deltaPercent: number; absoluteDelta: number; source: string; semanticLabel: string } => {
    if (!Number.isFinite(referencePrice) || referencePrice <= 0 || !Number.isFinite(price) || price <= 0) {
        return { label: 'Fair price', deltaPercent: 0, absoluteDelta: 0, source: referenceSource, semanticLabel: 'Fair price - typical for this route' };
    }
    const delta = (price - referencePrice) / referencePrice;
    const deltaPercent = Math.round(delta * 100);
    // absoluteDelta > 0 means savings vs average; < 0 means premium over average
    const absoluteDelta = Math.round(referencePrice - price);
    
    if (delta <= -0.20) {
        return { 
            label: 'Strong deal', 
            deltaPercent,
            absoluteDelta,
            source: referenceSource,
            semanticLabel: `Strong deal (~${Math.abs(deltaPercent)}% below average)` 
        };
    }
    if (delta <= -0.05) {
        return { 
            label: 'Below average', 
            deltaPercent,
            absoluteDelta,
            source: referenceSource,
            semanticLabel: `Below average (~${Math.abs(deltaPercent)}% discount)`
        };
    }
    if (delta <= 0.05) {
        return { 
            label: 'Fair price', 
            deltaPercent,
            absoluteDelta,
            source: referenceSource,
            semanticLabel: `Fair price - typical for this route`
        };
    }
    if (delta <= 0.20) {
        return { 
            label: 'Monitor price', 
            deltaPercent,
            absoluteDelta,
            source: referenceSource,
            semanticLabel: `Price is rising (~${deltaPercent}% above average)`
        };
    }
    return {
        label: 'Expect increase',
        deltaPercent,
        absoluteDelta,
        source: referenceSource,
        semanticLabel: `Expect price increase (~${deltaPercent}% premium)`
    };
};

const computeConfidenceScore = (flight: ScoringFlight): number => {
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
    let weightedTotal = 0;
    let weightSum = 0;
    for (const key of Object.keys(weights) as (keyof ScoreBreakdown)[]) {
        const max = BREAKDOWN_MAXES[key] || 1;
        const normalizedFeature = clamp(breakdown[key] / max, 0, 1);
        weightedTotal += normalizedFeature * weights[key];
        weightSum += weights[key];
    }
    const normalizedTotal = weightSum > 0 ? weightedTotal / weightSum : 0;
    return Number((normalizedTotal * 10).toFixed(1));
};

const resolvePersona = (persona?: PersonaInput): PersonaKey => {
    if (persona === 'business' || persona === 'budget' || persona === 'family' || persona === 'comfort' || persona === 'balanced') {
        return persona;
    }
    return 'comfort';
};

const resolveDepartureHour = (flight: ScoringFlight): number | null => {
    const raw = String(flight.departTime || '').trim();
    if (!raw) return null;
    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) return null;
    return parsed.getUTCHours();
};

const computePreferenceBonusRaw = (
    flight: ScoringFlight,
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

const ESTIMATED_BAGGAGE_FEE_BY_AIRLINE: Record<string, number> = {
    'RYANAIR': 70,
    'EASYJET': 60,
    'WIZZ AIR': 65,
    'JETSTAR': 75,
    'AIRASIA': 55,
    'SPIRIT AIRLINES': 85,
    'FRONTIER AIRLINES': 80,
    'QANTAS': 45,
    'EMIRATES': 35,
    'QATAR AIRWAYS': 35,
    'SINGAPORE AIRLINES': 40,
    'TURKISH AIRLINES': 45,
};

const normalizeAirlineName = (value?: string): string =>
    String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');

const estimateBaggageFee = (flight: ScoringFlight): number => {
    const checkedKg = Number(flight.policies?.baggageKg || 0);
    const baggageType = String(flight.baggage || '').toLowerCase();
    const hasCheckedBaggage = checkedKg > 0 || baggageType === 'checked';

    if (hasCheckedBaggage) return 0;

    const normalizedAirline = normalizeAirlineName(flight.airline);
    const explicitEstimate = ESTIMATED_BAGGAGE_FEE_BY_AIRLINE[normalizedAirline];
    if (Number.isFinite(explicitEstimate)) return explicitEstimate;

    const budgetMatch = Array.from(BUDGET_AIRLINES).some((name) => normalizedAirline.includes(name));
    if (budgetMatch) return 70;

    const premiumMatch = Array.from(PREMIUM_AIRLINES).some((name) => normalizedAirline.includes(name));
    if (premiumMatch) return 35;

    return 50;
};

const estimateMealCost = (
    flight: ScoringFlight,
    mealIncluded: boolean,
    durationMinutes: number
): number => {
    if (mealIncluded) return 0;

    const cabinClass = String(flight.cabinClass || '').toLowerCase();
    if (cabinClass === 'business' || cabinClass === 'first') {
        return 0;
    }

    if (durationMinutes >= 8 * 60) return 35;
    if (durationMinutes >= 4 * 60) return 22;
    return 12;
};

const estimateSeatSelectionCost = (flight: ScoringFlight): number => {
    const cabinClass = String(flight.cabinClass || '').toLowerCase();
    if (cabinClass === 'business' || cabinClass === 'first') return 0;

    const stops = Number(flight.stops || 0);
    if (stops >= 2) return 36;
    if (stops === 1) return 28;
    return 18;
};

const estimateAirportTransferCost = (flight: ScoringFlight, durationMinutes: number): number => {
    const routeDistanceKm = getGreatCircleDistanceKm(flight.from, flight.to) || 0;
    const longHaul = routeDistanceKm > 3500 || durationMinutes >= 7 * 60;
    const destination = String(flight.to || '').toUpperCase();
    const megaCityAirport = new Set(['LHR', 'CDG', 'JFK', 'LAX', 'NRT', 'HND', 'DXB', 'IST', 'SIN']);

    if (megaCityAirport.has(destination) && longHaul) return 48;
    if (longHaul) return 38;
    return 24;
};

const estimateHiddenFeeBuffer = (flight: ScoringFlight, baseFare: number): number => {
    const normalizedAirline = normalizeAirlineName(flight.airline);
    const budgetMatch = Array.from(BUDGET_AIRLINES).some((name) => normalizedAirline.includes(name));
    const ratio = budgetMatch ? 0.07 : 0.035;
    return Number(Math.max(8, Math.min(85, baseFare * ratio)).toFixed(2));
};

const generateScoreExplanation = (
    flight: ScoringFlight,
    breakdown: ScoreBreakdown,
    comfortNotes: string[],
    priceIntel: { label: string; deltaPercent: number },
    displayScore: number,
    connectionRisk: string,
    minConnectionMinutes: number,
): string => {
    const parts: string[] = [];
    if (flight.stops === 0) parts.push('direct flight');
    if (priceIntel.label === 'Strong deal')
        parts.push(`~${Math.abs(priceIntel.deltaPercent)}% below the route average`);
    else if (priceIntel.label === 'Below average')
        parts.push('below route average price');
    else if (priceIntel.label === 'Expect increase')
        parts.push('price trending upward');
    const bagNote = comfortNotes.find(n => n.toLowerCase().includes('baggage'));
    if (bagNote) parts.push(bagNote.toLowerCase());
    if (comfortNotes.some(n => n.toLowerCase().includes('meal'))) parts.push('meal included');
    if (breakdown.duration >= 13) parts.push('efficient travel time');
    if (connectionRisk === 'critical' && minConnectionMinutes > 0)
        parts.push(`${minConnectionMinutes}min critical connection risk`);
    else if (connectionRisk === 'high' && minConnectionMinutes > 0)
        parts.push(`tight ${minConnectionMinutes}min connection`);
    if (comfortNotes.some(n => n.includes('Top-tier'))) parts.push('top-tier airline reliability');
    if (parts.length === 0) return `Scored ${displayScore.toFixed(1)} — a balanced option across all criteria.`;
    return `Scored ${displayScore.toFixed(1)} for ${parts.slice(0, 3).join(', ')}.`;
};
// ── End Intelligence Layer v2 ─────────────────────────────────────────────

const scoreFlight = (
    flight: ScoringFlight,
    context: {
        avgPrice: number;
        medianPrice: number | null;
        minPrice: number;
        maxPrice: number;
        minDuration: number;
        maxDuration: number;
        expectedRouteDuration: number;
        markInvalidData: boolean;
        invalidReason?: string;
        persona?: PersonaKey;
        preferenceProfile?: PreferenceProfile;
        personalBiasProfile?: PersonalBiasProfile;
    }
): ScoredFlight => {
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

    const priceWeightBoost = clamp(Number(context.personalBiasProfile?.priceWeightBoost || 0), 0, 0.6);
    const directPenaltyBoost = clamp(Number(context.personalBiasProfile?.directPenaltyBoost || 0), 0, 3);
    const loyaltyAirline = normalizeAirlineName(context.personalBiasProfile?.loyaltyAirline || '');
    const loyaltyBoost = clamp(Number(context.personalBiasProfile?.loyaltyBoost || 0), 0, 1);
    const avoidMultiStopWeight = clamp(Number(context.personalBiasProfile?.avoidMultiStopWeight || 0), 0, 3);
    const avoidNightWeight = clamp(Number(context.personalBiasProfile?.avoidNightWeight || 0), 0, 2);
    const flightAirline = normalizeAirlineName(flight.airline || '');
    const loyaltyMatched = Boolean(loyaltyAirline && flightAirline && flightAirline.includes(loyaltyAirline));

    const price = Number(flight.price);
    const validPrice = Number.isFinite(price) && price > 0 ? price : context.avgPrice;

    const durationMinutes = resolveDurationMinutes(flight);
    const expectedRouteDuration = Math.max(1, context.expectedRouteDuration || durationMinutes || 1);

    // ── RELATIVE PRICE SCORING ────────────────────────────────────────────────
    // Score based on min/max of current results: (max - price) / (max - min) * 20
    let priceScoreValue = 10; // default
    if (context.maxPrice > context.minPrice) {
        const relativePriceRatio = (context.maxPrice - validPrice) / (context.maxPrice - context.minPrice);
        priceScoreValue = clamp(relativePriceRatio * 20, 0, 20);
    } else if (context.minPrice > 0) {
        // All prices are the same
        priceScoreValue = 10;
    }
    const personalizedPriceScore = clamp(priceScoreValue * (1 + priceWeightBoost), 0, 20);
    breakdown.priceValue = Math.round(personalizedPriceScore);

    // Set comfort notes based on relative price score
    if (priceScoreValue >= 16) {
        comfortNotes.push('Price is significantly below the route average');
    } else if (priceScoreValue >= 12) {
        comfortNotes.push('Price is below the route average');
    } else if (priceScoreValue < 6) {
        riskFlags.push('Price is above the route average');
    }

    // ── RELATIVE DURATION SCORING ─────────────────────────────────────────────
    // Score based on min/max of current results
    let durationScoreValue = 15; // default max
    if (context.maxDuration > context.minDuration) {
        // Invert: shorter is better, so (max - duration) / (max - min) * 15
        const relativeDurationRatio = (context.maxDuration - durationMinutes) / (context.maxDuration - context.minDuration);
        durationScoreValue = clamp(relativeDurationRatio * 15, 0, 15);
    } else if (durationMinutes > 0) {
        // All durations are the same
        durationScoreValue = 15;
    }
    breakdown.duration = Math.round(durationScoreValue);

    if (durationScoreValue >= 13) {
        comfortNotes.push('Short travel time');
    } else if (durationScoreValue < 6) {
        riskFlags.push('Long total travel time');
    }

    // ── REFERENCE PRICE FOR INTEL (separate from relative scoring) ──────────────
    const referencePrice =
        typeof context.medianPrice === 'number' && context.medianPrice > 0
            ? context.medianPrice
            : context.avgPrice;
    const priceReferenceSource =
        typeof context.medianPrice === 'number' && context.medianPrice > 0
            ? 'historicalMedian'
            : 'liveAverage';

    // ── UPDATED STOPS PENALTY ─────────────────────────────────────────────────
    // 0 stops: 1.0 multiplier -> 10
    // 1 stop: 0.7 multiplier -> 7
    // 2+ stops: 0.4 multiplier -> 4
    const baseStopsScore = 10;
    const stopsMultiplier = flight.stops <= 0 ? 1.0 : flight.stops === 1 ? 0.7 : 0.4;
    let stopsScore = Math.round(baseStopsScore * stopsMultiplier);
    if (flight.stops > 0 && directPenaltyBoost > 0) {
        stopsScore -= Math.round(directPenaltyBoost * Math.max(1, flight.stops));
        riskFlags.push('Connection penalty applied based on your preferences');
    }
    if (flight.stops >= 2 && avoidMultiStopWeight > 0) {
        stopsScore -= Math.round(avoidMultiStopWeight * (flight.stops - 1));
        riskFlags.push('Multi-stop flights frequently avoided in your history');
    }
    breakdown.stops = clamp(stopsScore, 0, 10);

    if (flight.stops >= 2) {
        riskFlags.push('Multiple connections');
    }

    // ── CONNECTION RISK: computed from real segment timestamps ──────────────
    breakdown.connection = 10;
    const resolvedLayovers = resolveLayoversFromSegments(flight);
    const connectionUxLabels: string[] = [];

    resolvedLayovers.forEach((lay) => {
        if (lay.durationMinutes <= 0) return;

        // Base risk from actual layover duration
        let riskLevel: 'high' | 'medium' | 'low' =
            lay.durationMinutes < 60 ? 'high' :
            lay.durationMinutes < 90 ? 'medium' : 'low';

        // Same-airline bonus: one level reduction (airline can protect the connection)
        if (lay.isSameAirline) {
            if (riskLevel === 'high')   riskLevel = 'medium';
            else if (riskLevel === 'medium') riskLevel = 'low';
        }

        if (riskLevel === 'high') {
            breakdown.connection -= 6;
            riskFlags.push('Critical connection — may miss flight');
            connectionUxLabels.push('Critical connection — may miss flight');
        } else if (riskLevel === 'medium') {
            breakdown.connection -= 3;
            riskFlags.push('Tight connection window');
            connectionUxLabels.push('Tight connection window');
        } else {
            // Long layover still slightly penalised for user discomfort
            if (lay.durationMinutes > 300) {
                breakdown.connection -= 1;
                riskFlags.push('Very long layover (> 5 h)');
                connectionUxLabels.push('Long layover (> 5 h)');
            } else {
                connectionUxLabels.push('Good connection window');
            }
        }
    });

    breakdown.connection = clamp(breakdown.connection, 0, 10);
    if (flight.stops > 0 && directPenaltyBoost > 0) {
        breakdown.connection = clamp(breakdown.connection - Math.min(4, Math.round(directPenaltyBoost)), 0, 10);
    }
    const connectionLabel =
        flight.stops === 0 ? 'Non-stop'
        : connectionUxLabels[0] ?? 'Good connection window';

    const layoverDurations = resolvedLayovers.filter(l => l.durationMinutes > 0).map(l => l.durationMinutes);
    const minConnectionMinutes = layoverDurations.length > 0 ? Math.min(...layoverDurations) : -1;
    const connectionRisk: 'low' | 'medium' | 'high' | 'critical' =
        flight.stops === 0       ? 'low' :
        minConnectionMinutes < 0 ? 'low' :
        minConnectionMinutes < 60  ? 'high' :
        minConnectionMinutes < 90  ? 'medium' : 'low';

    // Cache simple layovers for airport-index lookup below
    const layovers = resolvedLayovers;

    const selfTransfer = hasSelfTransferRisk(flight);
    breakdown.selfTransfer = selfTransfer ? 0 : 10;
    if (selfTransfer) {
        riskFlags.push('Self-transfer required');
    }

    const checkedBaggage = Number(flight.policies?.baggageKg || 0);
    const cabinBaggage = Number(flight.policies?.cabinBagKg || 0);
    const baggageType = String(flight.baggage || '').toLowerCase();
    const hasCheckedByType = baggageType === 'checked';

    if (checkedBaggage >= 20) {
        breakdown.baggage = 10;
        comfortNotes.push('20kg+ checked baggage included');
    } else if (checkedBaggage >= 15) {
        breakdown.baggage = 9;
        comfortNotes.push('Checked baggage included');
    } else if (checkedBaggage > 0) {
        breakdown.baggage = 7;
        comfortNotes.push('Limited checked baggage');
    } else if (hasCheckedByType) {
        breakdown.baggage = 8;
        comfortNotes.push('Checked baggage included (weight info limited)');
    } else if (checkedBaggage <= 0 && cabinBaggage > 0) {
        breakdown.baggage = 5;
        riskFlags.push('Cabin baggage only');
    } else {
        breakdown.baggage = 4;
        riskFlags.push('No checked baggage included');
    }

    const reliability = resolveReliability(flight.airline);
    breakdown.reliability = clamp(reliability.score, 0, 10);
    if (reliability.isTopAirline) {
        comfortNotes.push('Top-tier airline reputation');
    } else {
        riskFlags.push('Outside top-30 airlines');
    }
    if (breakdown.reliability >= 8) {
        comfortNotes.push('Strong on-time departure record');
    } else if (breakdown.reliability <= 6) {
        riskFlags.push('Below-average on-time reliability');
    }

    // ── DELAY HEURISTIC: airline hierarchy + route-length bonus, no fake % ─────
    const routeDistanceKm = getGreatCircleDistanceKm(flight.from, flight.to);
    const delayHeuristic = resolveDelayHeuristic(flight.airline, routeDistanceKm);
    const delayRiskLabel = delayHeuristic.label;
    // Keep delayProbability as internal proxy for downstream consumers (no UI display)
    const delayProbability = delayHeuristic.category === 'low' ? 10 : delayHeuristic.category === 'medium' ? 18 : 28;

    const aircraftCode = resolveAircraftCode(flight);
    const aircraftAge = flight.aircraftAge || AIRCRAFT_AGE[aircraftCode] || 12;
    let aircraftScore = 2;
    if (aircraftCode.includes('A35') || aircraftCode.includes('B78')) {
        aircraftScore += 3;
        comfortNotes.push('Next-gen aircraft (A350/787 family)');
    }
    if (aircraftAge >= 20) {
        aircraftScore -= 2;
        riskFlags.push('Older aircraft');
    }
    breakdown.aircraft = clamp(aircraftScore, 0, 5);

    const mealIncluded = hasIncludedMeal(flight as any);

    let amenitiesScore = 0;
    if (flight.amenities?.hasWifi || flight.wifi) {
        amenitiesScore += 2;
        comfortNotes.push('WiFi available');
    }
    if (flight.amenities?.entertainment || flight.entertainment) {
        amenitiesScore += 1.5;
        comfortNotes.push('In-flight entertainment available');
    }
    if (mealIncluded) {
        amenitiesScore += 1.5;
        comfortNotes.push('Meal service included');
    }
    breakdown.amenities = clamp(Math.round(amenitiesScore), 0, 5);

    let airportIndex = 5;
    resolvedLayovers.forEach((lay) => {
        if (!lay.airport) return;
        if (EASY_AIRPORTS.has(lay.airport)) airportIndex += 1;
        if (HARD_AIRPORTS.has(lay.airport))  airportIndex -= 2;
    });
    breakdown.airportIndex = clamp(airportIndex, 0, 5);

    const baseTotalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);
    const preferenceBonusRaw = computePreferenceBonusRaw(flight, context.preferenceProfile);
    const priceBiasBonusRaw = clamp((breakdown.priceValue / BREAKDOWN_MAXES.priceValue) * (priceWeightBoost * 10), 0, 3);
    const directBiasBonusRaw = flight.stops === 0 ? clamp(directPenaltyBoost * 0.8, 0, 2.5) : 0;
    const loyaltyBoostRaw = loyaltyMatched ? clamp(loyaltyBoost * 10, 0, 8) : 0;
    const departureHour = resolveDepartureHour(flight);
    const isNightFlight = departureHour !== null && (departureHour >= 22 || departureHour < 6);
    const nightPenaltyRaw = isNightFlight ? clamp(avoidNightWeight * 2.2, 0, 4) : 0;

    const referenceForPenalty = referencePrice > 0 ? referencePrice : context.avgPrice;
    const priceDeviationPct = referenceForPenalty > 0 ? (validPrice - referenceForPenalty) / referenceForPenalty : 0;
    const priceDeviationPenalty = clamp(Math.max(0, priceDeviationPct) * 15, 0, 8);

    const durationRatio = expectedRouteDuration > 0 ? durationMinutes / expectedRouteDuration : 1;
    const durationPenalty = clamp(Math.max(0, durationRatio - 1) * 6, 0, 8);

    const multiStopPenalty = flight.stops >= 2 ? clamp((flight.stops - 1) * 2.5, 0, 8) : 0;

    const personalBiasBonusRaw = clamp(Number((priceBiasBonusRaw + directBiasBonusRaw + loyaltyBoostRaw).toFixed(2)), 0, 10);
    const strongPenalty = priceDeviationPenalty + durationPenalty + multiStopPenalty + nightPenaltyRaw;
    const rawScore = clamp(Number((baseTotalScore + preferenceBonusRaw + personalBiasBonusRaw - strongPenalty).toFixed(2)), 0, 100);
    const normalizedRaw = clamp(rawScore / 100, 0, 1);
    // Power curve expands score separation and avoids clustered 9.x scores.
    const separatedScore = Math.pow(normalizedRaw, 1.35) * 100;
    const totalScore = clamp(Number(separatedScore.toFixed(2)), 0, 100);
    const displayScore = Number((totalScore / 10).toFixed(1));

    let valueTag = 'Balanced Option';
    const resolvedPersona = resolvePersona(context.persona as PersonaInput);
    const personaScore = computePersonaScore(breakdown, resolvedPersona);
    const priceIntel = computePriceIntel(validPrice, referencePrice, priceReferenceSource);
    const confidenceScore = computeConfidenceScore(flight);
    const finalRiskFlags = Array.from(new Set([
        ...riskFlags,
        ...(context.markInvalidData ? ['Data Error', context.invalidReason || 'Unrealistic duration detected.'] : []),
    ]));
    const finalComfortNotes = Array.from(new Set(comfortNotes));
    const explanation = context.markInvalidData
        ? undefined
        : generateScoreExplanation(flight, breakdown, finalComfortNotes, priceIntel, displayScore, connectionRisk, minConnectionMinutes);
    const tradeoff = {
        price: clamp(Math.round((breakdown.priceValue / BREAKDOWN_MAXES.priceValue) * 100), 0, 100),
        time: clamp(Math.round((breakdown.duration / BREAKDOWN_MAXES.duration) * 100), 0, 100),
        comfort: clamp(
            Math.round(
                (
                    (breakdown.baggage / BREAKDOWN_MAXES.baggage) +
                    (breakdown.amenities / BREAKDOWN_MAXES.amenities) +
                    (breakdown.aircraft / BREAKDOWN_MAXES.aircraft)
                ) / 3 * 100
            ),
            0,
            100
        ),
    };

    const estimatedBaggageFee = estimateBaggageFee(flight);
    const estimatedMealCost = estimateMealCost(flight, mealIncluded, durationMinutes);
    const estimatedSeatSelectionCost = estimateSeatSelectionCost(flight);
    const estimatedAirportTransferCost = estimateAirportTransferCost(flight, durationMinutes);
    const estimatedHiddenFeeBuffer = estimateHiddenFeeBuffer(flight, validPrice);
    const estimatedTotalCost = Number(
        (
            validPrice +
            estimatedBaggageFee +
            estimatedMealCost +
            estimatedSeatSelectionCost +
            estimatedAirportTransferCost +
            estimatedHiddenFeeBuffer
        ).toFixed(2)
    );
    const personalBiasRationale: string[] = [];
    if (priceWeightBoost > 0) personalBiasRationale.push('price_weight_boost');
    if (directPenaltyBoost > 0) personalBiasRationale.push('direct_preference_penalty');
    if (loyaltyMatched) personalBiasRationale.push('loyalty_match_boost');
    if (avoidMultiStopWeight > 0) personalBiasRationale.push('negative_learning_multi_stop');
    if (avoidNightWeight > 0) personalBiasRationale.push('negative_learning_night');

    if (breakdown.priceValue >= 16 && totalScore >= 75) {
        valueTag = 'Best Value';
    } else if (breakdown.amenities >= 4 && breakdown.duration >= 12) {
        valueTag = 'Most Comfortable';
    } else if (breakdown.reliability >= 8 && breakdown.connection >= 8) {
        valueTag = 'Lowest Risk';
    }

    const score: FlightScore = {
        composite: displayScore,
        confidence: confidenceScore,
        breakdown: {
            priceScore: breakdown.priceValue,
            durationScore: breakdown.duration,
            stopScore: breakdown.stops,
            connectionScore: breakdown.connection,
            selfTransferScore: breakdown.selfTransfer,
            airlineScore: breakdown.aircraft,
            baggageScore: breakdown.baggage,
            reliabilityScore: breakdown.reliability,
            amenitiesScore: breakdown.amenities,
            airportIndexScore: breakdown.airportIndex,
        },
        priceIntel,
        riskFlags: finalRiskFlags,
        comfortNotes: finalComfortNotes,
        explanation,
        tags: flight.tags || [],
        estimatedTotalCost: {
            currency: String(flight.currency || 'AUD').toUpperCase(),
            baseFare: Number(validPrice.toFixed(2)),
            estimatedBaggageFee,
            estimatedMealCost,
            estimatedSeatSelectionCost,
            estimatedAirportTransferCost,
            estimatedHiddenFeeBuffer,
            total: estimatedTotalCost,
        },
    };

    const {
        departTime: _departTime,
        arriveTime: _arriveTime,
        baggage: _legacyBaggage,
        policies: _legacyPolicies,
        canonicalBaggage,
        canonicalPolicies,
        ...rest
    } = flight;

    return {
        ...(rest as UnifiedFlight),
        duration: durationMinutes,
        baggage: canonicalBaggage,
        policies: canonicalPolicies,
        score,
    };
};

// ── FLIGHT INTELLIGENCE PHASE 1 ──────────────────────────────────────────

type RouteInsightInput = {
    avgPriceRoute: number;
    volatility: number;
    searchCount?: number;
    rollingAvgPrice?: number;
    recommendedBookingWindowDays?: number | null;
    observedMinPrice?: number;
    observedMaxPrice?: number;
};

type RouteTrendSignal = {
    trendSignal: 'RISING' | 'FALLING' | 'STABLE';
    changePercent: number;
    sampleSize: number;
    lastPrice: number | null;
    prevPrice: number | null;
    olderPrice: number | null;
    clarity: 'clear' | 'mixed' | 'weak';
};

type DecisionRecommendation = 'BUY_NOW' | 'WAIT' | 'AVOID';

type BuyNowVariantBucket = 'A' | 'B' | 'C';

const buildBuyNowLabelByVariant = (
    variant: BuyNowVariantBucket,
    avgPriceRoute: number,
    currentPrice: number,
): string => {
    const savings = Math.max(1, Math.round(avgPriceRoute - currentPrice));
    const pct = Math.round(((avgPriceRoute - currentPrice) / avgPriceRoute) * 100);

    if (variant === 'A') {
        return `Book within 24–48h — this fare is ~${pct}% below the route average.`;
    }

    if (variant === 'B') {
        return `Prices are likely to rise from here. Lock in this fare now.`;
    }

    return `Save ~$${savings} vs. the route average by booking today.`;
};

/**
 * BUY vs WAIT Engine
 * Uses route-level data to decide: BUY NOW / MONITOR / WAIT
 */
const computeBuyWaitSignal = (
    price: number,
    routeInsight: RouteInsightInput,
    daysUntilDeparture: number,
    buyNowVariant: BuyNowVariantBucket = 'A',
    flightProfile?: { stops: number; totalDurationMinutes: number; averageDurationMinutes: number },
): { action: 'BUY' | 'MONITOR' | 'WAIT'; label: string; urgencyDays?: number; variant?: BuyNowVariantBucket } => {
    const { avgPriceRoute, volatility, recommendedBookingWindowDays } = routeInsight;

    if (!Number.isFinite(avgPriceRoute) || avgPriceRoute <= 0) {
        return { action: 'MONITOR', label: 'Monitor price — insufficient history' };
    }

    const priceDeltaPct = (price - avgPriceRoute) / avgPriceRoute;
    const windowDays = recommendedBookingWindowDays ?? 14;
    const stops = Math.max(0, Number(flightProfile?.stops || 0));
    const totalDurationMinutes = Math.max(0, Number(flightProfile?.totalDurationMinutes || 0));
    const averageDurationMinutes = Math.max(1, Number(flightProfile?.averageDurationMinutes || totalDurationMinutes || 1));

    // LOW PRICE but poor quality itinerary: warn user instead of instant BUY
    if (priceDeltaPct <= -0.12 && stops >= 2 && totalDurationMinutes >= 20 * 60) {
        return {
            action: 'MONITOR',
            label: 'Low fare but caution: 2+ stops and ~20h+ total travel time can cause fatigue and disruption risk.',
        };
    }

    const durationBeatsRouteAverage = totalDurationMinutes > 0 && totalDurationMinutes <= Math.round(averageDurationMinutes * 0.9);

    // RARE DEAL: cheap AND meaningfully faster than route average duration
    if (priceDeltaPct <= -0.15 && durationBeatsRouteAverage) {
        const savings = Math.max(1, Math.round(avgPriceRoute - price));
        return {
            action: 'BUY',
            label: `Rare Deal: save ~$${savings} with a faster-than-average itinerary.`,
            urgencyDays: Math.max(2, Math.round(daysUntilDeparture * 0.15)),
            variant: buyNowVariant,
        };
    }

    // BUY NOW: genuinely cheap
    if (priceDeltaPct <= -0.15) {
        return {
            action: 'BUY',
            label: buildBuyNowLabelByVariant(buyNowVariant, avgPriceRoute, price),
            urgencyDays: Math.max(2, Math.round(daysUntilDeparture * 0.15)),
            variant: buyNowVariant,
        };
    }

    // BUY NOW: price is at or below average AND we're inside the recommended booking window
    if (priceDeltaPct <= 0.0 && daysUntilDeparture <= windowDays) {
        return {
            action: 'BUY',
            label: buildBuyNowLabelByVariant(buyNowVariant, avgPriceRoute, price),
            urgencyDays: daysUntilDeparture,
            variant: buyNowVariant,
        };
    }

    // WAIT: overpriced, enough time to wait, and volatility is high enough for a drop
    if (priceDeltaPct >= 0.15 && daysUntilDeparture >= 7 && volatility >= 20) {
        return {
            action: 'WAIT',
            label: `Wait — price is above average; may drop in the next week`,
        };
    }

    // WAIT: considerably overpriced and lots of time left
    if (priceDeltaPct >= 0.25 && daysUntilDeparture >= 14) {
        return {
            action: 'WAIT',
            label: `Wait — price is ${Math.round(priceDeltaPct * 100)}% above typical; better deals expected`,
        };
    }

    // MONITOR: fair price, price movement is plausible
    const monitorLabel =
        volatility >= 30
            ? `Monitor price — volatile route, price may shift`
            : priceDeltaPct < 0
                ? `Monitor price — slightly below average, stable`
                : `Monitor price — typical for this route`;

    return { action: 'MONITOR', label: monitorLabel };
};

/**
 * Real Deal Detection (tier-based, no fake % discounts)
 * RARE_DEAL = top 5% cheapest | GOOD_DEAL = top 20% | NORMAL | EXPENSIVE
 */
const computeDealTier = (
    price: number,
    routeInsight: RouteInsightInput,
    batchMinPrice: number,
    batchMaxPrice: number,
): 'RARE_DEAL' | 'GOOD_DEAL' | 'NORMAL' | 'EXPENSIVE' => {
    const minP = (routeInsight.observedMinPrice ?? batchMinPrice);
    const maxP = (routeInsight.observedMaxPrice ?? batchMaxPrice);
    const avgP = routeInsight.avgPriceRoute;

    if (!Number.isFinite(maxP) || !Number.isFinite(minP) || maxP <= minP) {
        // Fall back to batch-relative tier
        if (!Number.isFinite(batchMaxPrice) || batchMaxPrice <= batchMinPrice) return 'NORMAL';
        const batchRank = (batchMaxPrice - price) / (batchMaxPrice - batchMinPrice);
        if (batchRank >= 0.90) return 'RARE_DEAL';
        if (batchRank >= 0.70) return 'GOOD_DEAL';
        if (batchRank >= 0.30) return 'NORMAL';
        return 'EXPENSIVE';
    }

    // percentileRank: 1.0 = cheapest possible, 0 = most expensive
    const rank = clamp((maxP - price) / (maxP - minP), 0, 1);

    if (rank >= 0.95) return 'RARE_DEAL';
    if (rank >= 0.80) return 'GOOD_DEAL';
    if (rank >= 0.35) return 'NORMAL';
    return 'EXPENSIVE';
};

/**
 * Regret Minimization — psychological price framing
 * Returns how many % of historical prices were lower ("X% of travelers paid less")
 */
const computeRegretStat = (
    price: number,
    routeInsight: RouteInsightInput,
    batchMinPrice: number,
    batchMaxPrice: number,
): { cheaperThan: number; label: string } => {
    const minP = routeInsight.observedMinPrice ?? batchMinPrice;
    const maxP = routeInsight.observedMaxPrice ?? batchMaxPrice;

    if (!Number.isFinite(maxP) || !Number.isFinite(minP) || maxP <= minP) {
        return { cheaperThan: 50, label: 'Typical price for this route' };
    }

    // cheaperThan = % of historical prices below this price (lower = better deal)
    const cheaperThan = clamp(Math.round(((price - minP) / (maxP - minP)) * 100), 0, 100);

    let label: string;
    if (cheaperThan <= 5) {
        label = `You're within the cheapest 5% of prices seen for this route`;
    } else if (cheaperThan <= 12) {
        label = `Only ${cheaperThan}% of travelers paid less than this`;
    } else if (cheaperThan <= 25) {
        label = `You're within the cheapest ${cheaperThan}% of prices for this route`;
    } else if (cheaperThan <= 50) {
        label = `Below most prices seen on this route`;
    } else if (cheaperThan <= 70) {
        label = `A typical price for this route`;
    } else {
        label = `${100 - cheaperThan}% of travelers found cheaper options`;
    }

    return { cheaperThan, label };
};

const computePricePositionScore = (price: number, avgPrice: number): number => {
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(avgPrice) || avgPrice <= 0) {
        return 0.5;
    }

    return clamp(1 - (price / avgPrice), 0, 1);
};

const buildRegretInsight = (
    pricePositionScore: number,
    trend: RouteTrendSignal | null,
    volatility: number,
    priceDeltaPct?: number,
): string => {
    if (pricePositionScore >= 0.12) {
        const pct = priceDeltaPct !== undefined ? Math.round(Math.abs(priceDeltaPct) * 100) : Math.round(pricePositionScore * 100);
        return `This fare is ~${pct}% below the typical price for this route.`;
    }

    if (trend && trend.trendSignal === 'RISING') {
        return 'Recent searches show prices trending upward — waiting may cost more, not less.';
    }

    if (trend && trend.trendSignal === 'FALLING') {
        return 'Recent searches show a downward trend over the last 3 days — waiting could save you money.';
    }

    if (volatility >= 25) {
        return 'Prices on this route are volatile and have swung significantly — timing your booking matters.';
    }

    if (priceDeltaPct !== undefined && priceDeltaPct >= 0.10) {
        const pct = Math.round(priceDeltaPct * 100);
        return `This fare is ~${pct}% above the route average — consider other options in this search.`;
    }

    return 'This price is close to the route average — no strong timing signal right now.';
};

const computeDecisionRecommendation = (params: {
    routeInsight: RouteInsightInput;
    pricePositionScore: number;
    priceDeltaPct: number;
    confidenceScore: number;
    daysUntilDeparture: number;
    trend: RouteTrendSignal | null;
    dealTier: 'RARE_DEAL' | 'GOOD_DEAL' | 'NORMAL' | 'EXPENSIVE';
}): {
    recommendation: DecisionRecommendation;
    confidence: number;
    reason: string;
} => {
    const volatility = Number(params.routeInsight.volatility || 0);
    const trendSignal = params.trend?.trendSignal || 'STABLE';
    const daysLeft = params.daysUntilDeparture;
    const delta = params.priceDeltaPct; // negative = cheaper than avg, positive = more expensive
    const { dealTier } = params;

    let recommendation: DecisionRecommendation;

    // AVOID: price meaningfully above average and not trending down
    if (delta >= 0.12 && trendSignal !== 'FALLING') {
        recommendation = 'AVOID';
    } else if (dealTier === 'EXPENSIVE' && delta >= 0.05) {
        recommendation = 'AVOID';
    }
    // BUY_NOW: clearly below average with no signal of further drop
    else if (delta <= -0.08 && trendSignal !== 'FALLING') {
        recommendation = 'BUY_NOW';
    }
    // BUY_NOW: rare deal regardless of trend
    else if (dealTier === 'RARE_DEAL' && trendSignal !== 'FALLING') {
        recommendation = 'BUY_NOW';
    }
    // BUY_NOW: last-moment window — price at/near average, departure imminent
    else if (daysLeft <= 10 && delta <= 0.04 && trendSignal !== 'RISING') {
        recommendation = 'BUY_NOW';
    }
    // Default: WAIT — price unclear or trend favors waiting
    else {
        recommendation = 'WAIT';
    }

    const alignmentBonus =
        (recommendation === 'BUY_NOW' && (trendSignal === 'RISING' || trendSignal === 'STABLE') ? 12 : 0) +
        (recommendation === 'WAIT' && trendSignal === 'FALLING' ? 10 : 0) +
        (recommendation === 'AVOID' && (volatility >= 18 || trendSignal === 'RISING') ? 10 : 0) +
        (dealTier === 'RARE_DEAL' && recommendation === 'BUY_NOW' ? 8 : 0) +
        (dealTier === 'EXPENSIVE' && recommendation === 'AVOID' ? 8 : 0);

    const decisionConfidence = clamp(
        Math.round(params.confidenceScore * 0.75 + alignmentBonus),
        25,
        99,
    );

    const pctDiff = Math.round(Math.abs(delta) * 100);

    let reason: string;
    if (recommendation === 'BUY_NOW') {
        if (dealTier === 'RARE_DEAL') {
            reason = `This is among the cheapest fares seen on this route — a rare deal that won't last long.`;
        } else if (delta <= -0.15) {
            reason = `This fare is ~${pctDiff}% below the route average. Given current trends, prices are more likely to rise than fall from here.`;
        } else if (daysLeft <= 10) {
            reason = `With only ${daysLeft} days to departure, fares on this route typically rise. This price is at or below average — booking now avoids last-minute surges.`;
        } else {
            reason = `This fare is below the route average and the trend doesn't suggest further drops. Booking now is the lower-risk move.`;
        }
    } else if (recommendation === 'AVOID') {
        if (delta >= 0.25) {
            reason = `At ~${pctDiff}% above the route average, this fare is significantly overpriced. Better-value options are available in this search.`;
        } else if (trendSignal === 'RISING') {
            reason = `This fare started above average and prices on this route are trending upward — a combination that rarely improves.`;
        } else {
            reason = `This option is priced above what's typical for this route. Other flights in this search offer stronger value for the same trip.`;
        }
    } else {
        if (trendSignal === 'FALLING') {
            reason = `Prices on this route are trending down. Waiting ${daysLeft > 7 ? '2–4 days' : '1–2 days'} and checking again could yield a lower fare.`;
        } else if (volatility >= 20) {
            reason = `This route shows price volatility — fares have been shifting recently. Tracking this flight and rechecking in 2–3 days is worth doing.`;
        } else {
            reason = `The price is close to the route average with no strong signal either way. Monitoring for a few days before committing is a reasonable approach.`;
        }
    }

    return { recommendation, confidence: decisionConfidence, reason };
};

/**
 * Applies route intelligence features (BUY/WAIT, deal tier, regret stat, confidence boost)
 * to already-scored flights. Call this AFTER attaching routeIntelligence.
 */
export function applyRouteIntelligenceFeatures(
    flights: ScoredFlight[],
    routeInsight: RouteInsightInput | null,
    departureDate: string,
    trendSignal?: RouteTrendSignal | null,
    buyNowVariant: BuyNowVariantBucket = 'A',
): ScoredFlight[] {
    const validPrices = flights.map(f => Number(f.price)).filter(p => Number.isFinite(p) && p > 0);
    const batchMin = validPrices.length ? Math.min(...validPrices) : 0;
    const batchMax = validPrices.length ? Math.max(...validPrices) : 0;
    const batchAvg = validPrices.length
        ? validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length
        : 0;
    const validDurations = flights
        .map((flight) => resolveFlightDurationMinutes(flight))
        .filter((duration) => Number.isFinite(duration) && duration > 0);
    const averageDurationMinutes = validDurations.length
        ? Math.round(validDurations.reduce((sum, value) => sum + value, 0) / validDurations.length)
        : 0;

    const effectiveRouteInsight: RouteInsightInput = routeInsight || {
        avgPriceRoute: batchAvg,
        volatility: 22,
        searchCount: 0,
        rollingAvgPrice: batchAvg,
        observedMinPrice: batchMin,
        observedMaxPrice: batchMax,
    };

    const now = Date.now();
    const depMs = new Date(departureDate).getTime();
    const daysUntilDeparture = Number.isFinite(depMs)
        ? Math.max(0, Math.round((depMs - now) / 86_400_000))
        : 30;

    return flights.map((flight) => {
        const price = Number(flight.price);
        if (!Number.isFinite(price) || price <= 0) return flight;

        const resolvedDurationMinutes = resolveFlightDurationMinutes(flight);
        const buyWaitSignal = computeBuyWaitSignal(
            price,
            effectiveRouteInsight,
            daysUntilDeparture,
            buyNowVariant,
            {
                stops: Number(flight.stops || 0),
                totalDurationMinutes: resolvedDurationMinutes,
                averageDurationMinutes,
            }
        );
        const dealTier = computeDealTier(price, effectiveRouteInsight, batchMin, batchMax);
        const regretStat = computeRegretStat(price, effectiveRouteInsight, batchMin, batchMax);
        const avgForDelta = Number(effectiveRouteInsight.avgPriceRoute || batchAvg || price);
        const priceDeltaPct = avgForDelta > 0 ? (price - avgForDelta) / avgForDelta : 0;
        const pricePositionScore = computePricePositionScore(price, avgForDelta);
        const confidenceScore = Number(flight.score?.confidence || 50);
        const regretInsight = buildRegretInsight(pricePositionScore, trendSignal || null, Number(effectiveRouteInsight.volatility || 0), priceDeltaPct);
        const decision = computeDecisionRecommendation({
            routeInsight: effectiveRouteInsight,
            pricePositionScore,
            priceDeltaPct,
            confidenceScore,
            daysUntilDeparture,
            trend: trendSignal || null,
            dealTier,
        });

        const explanation = decision.reason;

        return {
            ...flight,
            score: {
                ...flight.score,
                confidence: confidenceScore,
                trendSignal: trendSignal?.trendSignal || 'STABLE',
                buyWaitSignal,
                decisionRecommendation: decision.recommendation,
                decisionConfidence: decision.confidence,
                decisionReason: decision.reason,
                routeIntelligence: {
                    avgPriceRoute: effectiveRouteInsight.avgPriceRoute,
                    volatility: effectiveRouteInsight.volatility,
                    searchCount: effectiveRouteInsight.searchCount,
                    rollingAvgPrice: effectiveRouteInsight.rollingAvgPrice,
                    recommendedBookingWindowDays: effectiveRouteInsight.recommendedBookingWindowDays,
                    observedMinPrice: effectiveRouteInsight.observedMinPrice,
                    observedMaxPrice: effectiveRouteInsight.observedMaxPrice,
                },
            },
        };
    });
}

export async function applyAdvancedFlightScoring(
    flights: UnifiedFlight[],
    options?: {
        origin?: string;
        destination?: string;
        departureDate?: string;
        useHistoricalMedian?: boolean;
        persona?: PersonaInput;
        preferenceProfile?: PreferenceProfile;
        personalBiasProfile?: PersonalBiasProfile;
    }
): Promise<ScoredFlight[]> {
    const scoringFlights = flights.map(toScoringFlight);

    // ── DEDUPLICATION: Merge flights with same departure, arrival, route, operating_airline ──
    const deduplicatedFlights = deduplicateFlights(scoringFlights);

    const validPrices = deduplicatedFlights
        .map((flight) => Number(flight.price))
        .filter((price) => Number.isFinite(price) && price > 0);
    const avgPrice = validPrices.length
        ? validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length
        : 0;

    const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
    const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;

    // Calculate duration range for relative scoring
    const validDurations = deduplicatedFlights
        .map((flight) => resolveFlightDurationMinutes(asUnifiedFlightForMetrics(flight)))
        .filter((duration) => duration > 0);
    const minDuration = validDurations.length ? Math.min(...validDurations) : 0;
    const maxDuration = validDurations.length ? Math.max(...validDurations) : 0;

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

    return deduplicatedFlights
        .map((flight) => {
            const markInvalidData = isInvalidBneIstDuration(asUnifiedFlightForMetrics(flight));
            const invalidReason = markInvalidData
                ? 'Total duration under 14h for BNE-IST is not realistic.'
                : undefined;

            return scoreFlight(flight, {
                avgPrice,
                medianPrice,
                minPrice,
                maxPrice,
                minDuration,
                maxDuration,
                expectedRouteDuration,
                markInvalidData,
                invalidReason,
                persona: resolvePersona(options?.persona),
                preferenceProfile: options?.preferenceProfile,
                personalBiasProfile: options?.personalBiasProfile,
            });
        })
        .sort((a, b) => (b.score?.composite || 0) - (a.score?.composite || 0));
}

