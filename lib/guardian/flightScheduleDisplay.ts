import type { FlightLegOption } from '../flightData/legs';
import { localWallClock } from '../flightData/legs';

export interface ScheduleSegment {
    origin: string;
    destination: string;
    scheduledDepartureUtc: Date | string | null;
    scheduledArrivalUtc: Date | string | null;
}

const iso = (value: Date | string | null) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Reuse preserved provider metadata; never infer a clock from the lookup date. */
export function airportSchedule(segment: ScheduleSegment, options: FlightLegOption[]) {
    const route = options.filter(o => o.origin?.iata === segment.origin && o.destination?.iata === segment.destination);
    const dep = iso(segment.scheduledDepartureUtc);
    const arr = iso(segment.scheduledArrivalUtc);
    const exact = route.find(o => iso(o.departureUtc) === dep && dep !== null);
    // Multiple occurrences of the same route must not select an arbitrary local time.
    const metadata = exact ?? (route.length === 1 ? route[0] : undefined);
    const wallClock = (utc: string | null, cachedUtc: string | null | undefined, local: string | null | undefined, zone: string | null | undefined) => {
        if (!utc) return null;
        if (iso(cachedUtc ?? null) === utc && local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return local;
        return localWallClock({ utc }, zone);
    };
    return {
        scheduledDepartureLocal: wallClock(dep, metadata?.departureUtc, metadata?.departureLocal, metadata?.origin.timeZone),
        scheduledArrivalLocal: wallClock(arr, metadata?.arrivalUtc, metadata?.arrivalLocal, metadata?.destination.timeZone),
    };
}

export function scheduleTime(local: string | null | undefined, unavailable: string): string {
    return local?.slice(11, 16) || unavailable;
}

export function scheduleDate(local: string | null | undefined, locale: string, unavailable: string): string {
    if (!local) return unavailable;
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })
        .format(new Date(`${local.slice(0, 10)}T00:00:00Z`));
}
