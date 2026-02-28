import { FlightResult } from '@/types/hybridFlight';

export type MealStatus = 'included' | 'paid' | 'none';

export const getMealStatus = (flight: Partial<FlightResult> | null | undefined): MealStatus => {
    if (!flight) return 'none';

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

    return 'none';
};

export const hasAnyMeal = (flight: Partial<FlightResult> | null | undefined): boolean => {
    const status = getMealStatus(flight);
    return status === 'included' || status === 'paid';
};

export const hasIncludedMeal = (flight: Partial<FlightResult> | null | undefined): boolean => {
    return getMealStatus(flight) === 'included';
};
