// lib/guardian/airlineActions.ts
//
// Official airline pages a notification may link to. Built ONLY from URLs already
// present in lib/airlineClaimPortals.ts; nothing is invented. Those pages are
// support / feedback / booking-management pages (the file does not hold per-airline
// "manage booking" or "flight status" deep links, except British Airways), so the
// link is labelled for what it is. An airline without a verified URL gets no link:
// the guidance text then names the airline and its app instead.

import { getAirlineClaimPortal } from '@/lib/airlineClaimPortals';

export interface AirlineActions {
    airlineName: string | null;
    /** Verified manage-booking page, only where the existing data says so. */
    manageBookingUrl: string | null;
    /** Verified official support/contact page. */
    supportUrl: string | null;
    supportLabel: string | null;
}

const MANAGE_BOOKING = /managebooking|manage-booking/i;

export function airlineActions(airlineCode: string | null | undefined, providerName?: string | null): AirlineActions {
    const portal = getAirlineClaimPortal(airlineCode);
    if (!portal) return { airlineName: providerName?.trim() || null, manageBookingUrl: null, supportUrl: null, supportLabel: null };
    const isManage = MANAGE_BOOKING.test(portal.url);
    return {
        airlineName: portal.name,
        manageBookingUrl: isManage ? portal.url : null,
        supportUrl: portal.url,
        supportLabel: isManage ? `Manage booking with ${portal.name}` : `Open ${portal.name} support`,
    };
}
