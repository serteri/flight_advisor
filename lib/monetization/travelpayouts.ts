/**
 * Travelpayouts Monetization Layer
 *
 * Travelpayouts is NOT part of the search or intelligence pipeline.
 * Its only role is generating affiliate outbound links shown to the user
 * as "Search booking options" — clearly labeled as external navigation.
 *
 * Never import this file from:
 *   - search providers
 *   - scoring / ranking
 *   - deduplication
 *   - confidence model
 *   - alert engine
 */

export function buildTravelpayoutsLink(params: {
    origin: string;
    destination: string;
    date: string;
    currency?: string;
}): string {
    const marker = process.env.TRAVELPAYOUTS_MARKER!;
    const base = 'https://www.aviasales.com/search';

    const qs = new URLSearchParams({
        origin: params.origin.toUpperCase().slice(0, 3),
        destination: params.destination.toUpperCase().slice(0, 3),
        departure_at: params.date.includes('T') ? params.date.split('T')[0] : params.date,
        currency: params.currency || 'USD',
        marker,
        utm_source: 'flightguardian',
    });

    return `${base}?${qs.toString()}`;
}

/**
 * Builds a tracked AirHelp claim link for post-EU261-trigger use.
 * Only call this after the EU261 engine confirms eligibility.
 */
export function buildAirHelpLink(): string {
    const marker = process.env.TRAVELPAYOUTS_MARKER || '701049';
    return `https://tp.media/r?marker=${marker}&trs=197987&p=323&u=${encodeURIComponent('https://www.airhelp.com/en/')}`;
}
