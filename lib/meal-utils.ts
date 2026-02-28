import { FlightResult } from '@/types/hybridFlight';

export type MealStatus = 'included' | 'paid' | 'none' | 'unknown' | 'assumed_included';
export type WifiStatus = 'available' | 'unavailable' | 'unknown' | 'check_with_airline';

const TOP_AIRLINE_KEYWORDS = [
    'SINGAPORE AIRLINES',
    'QATAR AIRWAYS',
    'EMIRATES',
    'TURKISH AIRLINES',
    'LUFTHANSA',
    'KLM',
    'AIR FRANCE',
    'BRITISH AIRWAYS',
    'ANA',
    'ALL NIPPON AIRWAYS',
    'JAPAN AIRLINES',
    'CATHAY PACIFIC',
    'EVA AIR',
    'ETIHAD AIRWAYS',
    'QANTAS',
    'SWISS',
    'DELTA AIR LINES',
    'UNITED AIRLINES',
    'AIR CANADA',
];

const normalizeAirline = (value: unknown): string =>
    String(value || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const isTopAirline = (airline: unknown): boolean => {
    const normalized = normalizeAirline(airline);
    if (!normalized) return false;
    return TOP_AIRLINE_KEYWORDS.some((name) => normalized.includes(name));
};

export const getMealStatus = (flight: Partial<FlightResult> | null | undefined): MealStatus => {
    if (!flight) return 'none';

    const prestigeAirline = isTopAirline(flight.airline);

    if (flight.meal === 'included' || flight.meal === 'paid' || flight.meal === 'none') {
        return flight.meal;
    }

    const amenities = (flight as any).amenities || {};
    const food = typeof amenities.food === 'string' ? amenities.food.toLowerCase() : '';

    if (food === 'included') return 'included';
    if (food === 'paid' || food === 'for_purchase') return 'paid';
    if (food === 'none' || food === 'unavailable') return 'none';

    if (amenities.hasMeal === true || amenities.hasMeals === true) return 'included';
    if (amenities.hasMeal === false || amenities.hasMeals === false) return 'none';

    if (prestigeAirline) {
        return 'assumed_included';
    }

    return 'unknown';
};

export const hasAnyMeal = (flight: Partial<FlightResult> | null | undefined): boolean => {
    const status = getMealStatus(flight);
    return status === 'included' || status === 'paid' || status === 'assumed_included';
};

export const hasIncludedMeal = (flight: Partial<FlightResult> | null | undefined): boolean => {
    const status = getMealStatus(flight);
    return status === 'included' || status === 'assumed_included';
};

export const getWifiStatus = (flight: Partial<FlightResult> | null | undefined): WifiStatus => {
    if (!flight) return 'unknown';

    const prestigeAirline = isTopAirline(flight.airline);
    const amenities = (flight as any).amenities || {};

    if (typeof amenities.hasWifi === 'boolean') {
        return amenities.hasWifi ? 'available' : 'unavailable';
    }

    if (typeof (flight as any).wifi === 'boolean') {
        return (flight as any).wifi ? 'available' : 'unavailable';
    }

    if (prestigeAirline) {
        return 'check_with_airline';
    }

    return 'unknown';
};
