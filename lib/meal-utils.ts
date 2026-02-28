import { FlightResult } from '@/types/hybridFlight';

export const hasIncludedMeal = (flight: Partial<FlightResult> | null | undefined): boolean => {
    if (!flight) return false;

    if (flight.meal === 'included') return true;
    if (flight.meal === 'paid' || flight.meal === 'none') return false;

    const amenities = (flight as any).amenities || {};
    return Boolean(amenities.hasMeal || amenities.hasMeals || amenities.food === 'included');
};
