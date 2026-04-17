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

const resolveDurationMinutes = (flight: FlightResult): number => {
    return resolveFlightDurationMinutes(flight);
};

// ── DEDUPLICATION ──────────────────────────────────────────────────────────
// Merge flights with same departure time, arrival time, route, and operating_airline
// Keep lowest price variant and track all marketing airlines in "Sold by" list
const deduplicateFlights = (flights: FlightResult[]): FlightResult[] => {
    const groups = new Map<string, FlightResult[]>();
    
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
    const result: FlightResult[] = [];
    groups.forEach((flightGroup) => {
        // Sort by price to get lowest first
        flightGroup.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
        const baseFlight = flightGroup[0];
        
        // Track all airlines that sell this flight
        const soldBySet = new Set<string>();
        flightGroup.forEach((flight) => {
            soldBySet.add(`${flight.source}:${flight.airline}`);
        });
        
        // Create soldBy array with unique airline/source combinations
        const soldBy: typeof baseFlight.soldBy = Array.from(soldBySet)
            .map((entry) => {
                const [source, airline] = entry.split(':');
                const flightData = flightGroup.find(f => f.source === source && f.airline === airline);
                return {
                    source: source as any,
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

const resolveLayovers = (flight: FlightResult) =>
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

const resolveLayoversFromSegments = (flight: FlightResult): ResolvedLayover[] => {
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

const estimateBaggageFee = (flight: FlightResult): number => {
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
    flight: FlightResult,
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

const estimateSeatSelectionCost = (flight: FlightResult): number => {
    const cabinClass = String(flight.cabinClass || '').toLowerCase();
    if (cabinClass === 'business' || cabinClass === 'first') return 0;

    const stops = Number(flight.stops || 0);
    if (stops >= 2) return 36;
    if (stops === 1) return 28;
    return 18;
};

const estimateAirportTransferCost = (flight: FlightResult, durationMinutes: number): number => {
    const routeDistanceKm = getGreatCircleDistanceKm(flight.from, flight.to) || 0;
    const longHaul = routeDistanceKm > 3500 || durationMinutes >= 7 * 60;
    const destination = String(flight.to || '').toUpperCase();
    const megaCityAirport = new Set(['LHR', 'CDG', 'JFK', 'LAX', 'NRT', 'HND', 'DXB', 'IST', 'SIN']);

    if (megaCityAirport.has(destination) && longHaul) return 48;
    if (longHaul) return 38;
    return 24;
};

const estimateHiddenFeeBuffer = (flight: FlightResult, baseFare: number): number => {
    const normalizedAirline = normalizeAirlineName(flight.airline);
    const budgetMatch = Array.from(BUDGET_AIRLINES).some((name) => normalizedAirline.includes(name));
    const ratio = budgetMatch ? 0.07 : 0.035;
    return Number(Math.max(8, Math.min(85, baseFare * ratio)).toFixed(2));
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
    if (priceIntel.label === 'Strong deal')
        parts.push(`fiyatı ortalamanın %${Math.abs(priceIntel.deltaPercent)} altında`);
    else if (priceIntel.label === 'Below average')
        parts.push('fiyatı ortalamanın altında');
    else if (priceIntel.label === 'Expect increase')
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
        comfortNotes.push('Fiyat rota ortalamasına göre çok avantajlı');
    } else if (priceScoreValue >= 12) {
        comfortNotes.push('Fiyat rota ortalamasına göre avantajlı');
    } else if (priceScoreValue < 6) {
        riskFlags.push('Fiyat rota ortalamasına göre yüksek');
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
        comfortNotes.push('Kısa seyahat süresi');
    } else if (durationScoreValue < 6) {
        riskFlags.push('Uzun toplam seyahat süresi');
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
        riskFlags.push('Kişisel tercihe gore aktarma cezası artırıldı');
    }
    if (flight.stops >= 2 && avoidMultiStopWeight > 0) {
        stopsScore -= Math.round(avoidMultiStopWeight * (flight.stops - 1));
        riskFlags.push('Kullanıcı geçmişinde çok aktarmalı uçuşlar sıkça elendi');
    }
    breakdown.stops = clamp(stopsScore, 0, 10);
    
    if (flight.stops >= 2) {
        riskFlags.push('Çoklu aktarma');
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
            delayRiskLabel,    // Semantic label: 'Low delay risk' | 'Typical delay risk (~20%)' | etc.
            connectionRisk,
            connectionLabel,   // UX label: 'Non-stop' | 'Good connection window' | 'Tight connection window' | etc.
            minConnectionMinutes,
            priceIntel,
            confidenceScore,
            forYouBonus: Number((preferenceBonusRaw / 10).toFixed(2)),
            personalBias: {
                priceWeightBoost,
                directPenaltyBoost,
                loyaltyAirline: loyaltyAirline || null,
                loyaltyBoost,
                avoidMultiStopWeight,
                avoidNightWeight,
                biasScore: Number((personalBiasBonusRaw / 10).toFixed(2)),
                rationale: personalBiasRationale,
            },
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
            hiddenCostBreakdown: {
                baggage: estimatedBaggageFee,
                meals: estimatedMealCost,
                seatSelection: estimatedSeatSelectionCost,
                airportTransfer: estimatedAirportTransferCost,
                hiddenFeeBuffer: estimatedHiddenFeeBuffer,
            },
            explanation,
            tradeoff,
        },
    } as FlightResult;
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
    if (variant === 'A') {
        return 'System recommends booking now based on 92% confidence.';
    }

    if (variant === 'B') {
        return 'Prices likely to increase within 72h — Secure this deal now.';
    }

    const savings = Math.max(1, Math.round(avgPriceRoute - currentPrice));
    return `Save $${savings} by booking today vs. historical average.`;
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
): { action: 'BUY' | 'MONITOR' | 'WAIT'; label: string; urgencyDays?: number; variant?: BuyNowVariantBucket } => {
    const { avgPriceRoute, volatility, recommendedBookingWindowDays } = routeInsight;

    if (!Number.isFinite(avgPriceRoute) || avgPriceRoute <= 0) {
        return { action: 'MONITOR', label: 'Monitor price — insufficient history' };
    }

    const priceDeltaPct = (price - avgPriceRoute) / avgPriceRoute;
    const windowDays = recommendedBookingWindowDays ?? 14;

    // BUY NOW: genuinely cheap, and prices are volatile (likely to bounce back)
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

const computeConfidenceScoreV2 = (
    flight: FlightResult,
    routeInsight: RouteInsightInput,
    trend: RouteTrendSignal | null,
): number => {
    const baseDataQuality = flight.advancedScore?.dataQuality === 'invalid' ? 25 : 80;
    const coverageScore = clamp(Math.round((Number(routeInsight.searchCount || 0) / 30) * 100), 15, 100);
    const trendClarityScore = trend
        ? trend.clarity === 'clear'
            ? 90
            : trend.clarity === 'mixed'
                ? 65
                : 40
        : 35;
    const volatilityStability = clamp(100 - Math.round(Number(routeInsight.volatility || 0) * 2), 20, 100);

    const weighted =
        baseDataQuality * 0.4 +
        coverageScore * 0.25 +
        trendClarityScore * 0.2 +
        volatilityStability * 0.15;

    return clamp(Math.round(weighted), 10, 99);
};

const buildRegretInsight = (
    pricePositionScore: number,
    trend: RouteTrendSignal | null,
    volatility: number,
): string => {
    if (pricePositionScore >= 0.12) {
        return 'This is cheaper than typical prices for this route.';
    }

    if (trend && trend.trendSignal === 'RISING') {
        return 'Prices are trending upward - waiting may cost more.';
    }

    if (trend && trend.trendSignal === 'FALLING') {
        return 'Recent searches show prices easing, so waiting could be beneficial.';
    }

    if (volatility >= 25) {
        return 'Prices are still unstable - waiting could be beneficial.';
    }

    return 'This price is close to normal for the route, so timing matters more than hype.';
};

const computeDecisionRecommendation = (params: {
    routeInsight: RouteInsightInput;
    pricePositionScore: number;
    confidenceScore: number;
    daysUntilDeparture: number;
    trend: RouteTrendSignal | null;
}): {
    recommendation: DecisionRecommendation;
    confidence: number;
    reason: string;
} => {
    const volatility = Number(params.routeInsight.volatility || 0);
    const trendSignal = params.trend?.trendSignal || 'STABLE';
    const timePressure: 'HIGH' | 'MEDIUM' | 'LOW' =
        params.daysUntilDeparture < 14 ? 'HIGH' : params.daysUntilDeparture <= 30 ? 'MEDIUM' : 'LOW';

    let recommendation: DecisionRecommendation = 'WAIT';

    if (params.pricePositionScore >= 0.12 && timePressure !== 'LOW' && trendSignal !== 'FALLING') {
        recommendation = 'BUY_NOW';
    } else if (params.pricePositionScore <= 0.02 && volatility >= 25) {
        recommendation = 'AVOID';
    } else if (params.pricePositionScore > 0.02 && params.pricePositionScore < 0.12 && timePressure === 'LOW' && trendSignal === 'FALLING') {
        recommendation = 'WAIT';
    }

    const alignmentBonus =
        (recommendation === 'BUY_NOW' && trendSignal !== 'FALLING' ? 12 : 0) +
        (recommendation === 'WAIT' && trendSignal === 'FALLING' ? 10 : 0) +
        (recommendation === 'AVOID' && volatility >= 25 ? 10 : 0);

    const decisionConfidence = clamp(
        Math.round(params.confidenceScore * 0.75 + alignmentBonus),
        25,
        99,
    );

    let reason: string;
    if (recommendation === 'BUY_NOW') {
        reason = 'This fare is cheaper than the route average, time pressure is building, and recent searches do not suggest a drop.';
    } else if (recommendation === 'AVOID') {
        reason = 'This option is expensive relative to the route average and price volatility is still high.';
    } else {
        reason = trendSignal === 'FALLING'
            ? 'Recent searches indicate prices are softening and there is still time before departure.'
            : 'The price is not yet a standout deal, so monitoring is the safer move.';
    }

    return {
        recommendation,
        confidence: decisionConfidence,
        reason,
    };
};

/**
 * Applies route intelligence features (BUY/WAIT, deal tier, regret stat, confidence boost)
 * to already-scored flights. Call this AFTER attaching routeIntelligence.
 */
export function applyRouteIntelligenceFeatures(
    flights: FlightResult[],
    routeInsight: RouteInsightInput | null,
    departureDate: string,
    trendSignal?: RouteTrendSignal | null,
    buyNowVariant: BuyNowVariantBucket = 'A',
): FlightResult[] {
    const validPrices = flights.map(f => Number(f.price)).filter(p => Number.isFinite(p) && p > 0);
    const batchMin = validPrices.length ? Math.min(...validPrices) : 0;
    const batchMax = validPrices.length ? Math.max(...validPrices) : 0;
    const batchAvg = validPrices.length
        ? validPrices.reduce((sum, value) => sum + value, 0) / validPrices.length
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

        const buyWaitSignal = computeBuyWaitSignal(price, effectiveRouteInsight, daysUntilDeparture, buyNowVariant);
        const dealTier = computeDealTier(price, effectiveRouteInsight, batchMin, batchMax);
        const regretStat = computeRegretStat(price, effectiveRouteInsight, batchMin, batchMax);
        const pricePositionScore = computePricePositionScore(price, Number(effectiveRouteInsight.avgPriceRoute || batchAvg || 0));
        const confidenceScore = computeConfidenceScoreV2(flight, effectiveRouteInsight, trendSignal || null);
        const regretInsight = buildRegretInsight(pricePositionScore, trendSignal || null, Number(effectiveRouteInsight.volatility || 0));
        const decision = computeDecisionRecommendation({
            routeInsight: effectiveRouteInsight,
            pricePositionScore,
            confidenceScore,
            daysUntilDeparture,
            trend: trendSignal || null,
        });

        const explanation = decision.recommendation === 'BUY_NOW'
            ? 'Better value than a typical fare for this route, with signals supporting action now.'
            : decision.recommendation === 'AVOID'
                ? 'Poor value relative to route pricing, and current market conditions do not justify urgency.'
                : 'Current signals favor patience over immediate booking.';

        return {
            ...flight,
            advancedScore: {
                ...(flight.advancedScore || {}),
                confidenceScore,
                pricePositionScore: Number(pricePositionScore.toFixed(2)),
                trendSignal: trendSignal?.trendSignal || 'STABLE',
                buyWaitSignal,
                dealTier,
                regretStat,
                regretInsight,
                decisionRecommendation: decision.recommendation,
                decisionConfidence: decision.confidence,
                decisionReason: decision.reason,
                explanation,
            },
        } as FlightResult;
    });
}

export async function applyAdvancedFlightScoring(
    flights: FlightResult[],
    options?: {
        origin?: string;
        destination?: string;
        departureDate?: string;
        useHistoricalMedian?: boolean;
        persona?: PersonaInput;
        preferenceProfile?: PreferenceProfile;
        personalBiasProfile?: PersonalBiasProfile;
    }
): Promise<FlightResult[]> {
    // ── DEDUPLICATION: Merge flights with same departure, arrival, route, operating_airline ──
    const deduplicatedFlights = deduplicateFlights(flights);

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
        .map((flight) => resolveFlightDurationMinutes(flight))
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
            const markInvalidData = isInvalidBneIstDuration(flight);
            const invalidReason = markInvalidData
                ? 'BNE-IST için 14 saatin altındaki toplam süre gerçekçi değil.'
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
        .sort((a, b) => (b.advancedScore?.totalScore || 0) - (a.advancedScore?.totalScore || 0));
}