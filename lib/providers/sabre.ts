/**
 * Sabre BFM (Bargain Finder Max) provider — server-side only.
 * OAuth 2.0 client_credentials + OTA_AirLowFareSearchRQ search.
 */

import type { HybridSearchParams } from '@/types/hybridFlight';

// ── Auth ──────────────────────────────────────────────────────────────────────

interface TokenCache {
    token: string;
    expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

export class SabreAuthError extends Error {
    constructor(msg: string) { super(msg); this.name = 'SabreAuthError'; }
}

export class SabreSearchError extends Error {
    constructor(msg: string) { super(msg); this.name = 'SabreSearchError'; }
}

async function getSabreToken(): Promise<string> {
    const now = Date.now();
    if (_tokenCache && _tokenCache.expiresAt > now + 30_000) {
        return _tokenCache.token;
    }

    const clientId = process.env.SABRE_CLIENT_ID;
    const clientSecret = process.env.SABRE_CLIENT_SECRET;
    const baseUrl = process.env.SABRE_BASE_URL || 'https://api-cert.platform.sabre.com';

    if (!clientId || !clientSecret) {
        throw new SabreAuthError('SABRE_CLIENT_ID and SABRE_CLIENT_SECRET are required');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch(`${baseUrl}/v2/auth/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new SabreAuthError(`Sabre auth failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const token: string = data.access_token;
    const expiresIn: number = data.expires_in ?? 3600;

    _tokenCache = { token, expiresAt: now + expiresIn * 1000 };
    return token;
}

// ── Cabin mapping ─────────────────────────────────────────────────────────────

function toCabinCode(cabin: HybridSearchParams['cabin']): string {
    switch (cabin) {
        case 'premium':  return 'S';
        case 'business': return 'C';
        case 'first':    return 'F';
        default:         return 'Y'; // economy
    }
}

// ── Search ────────────────────────────────────────────────────────────────────

export async function searchSabreFlights(params: HybridSearchParams): Promise<any[]> {
    const baseUrl = process.env.SABRE_BASE_URL || 'https://api-cert.platform.sabre.com';

    const token = await getSabreToken();

    const cabinCode = toCabinCode(params.cabin);
    const adults = Math.max(1, params.adults ?? 1);

    const requestBody = {
        OTA_AirLowFareSearchRQ: {
            Version: '4.3.0',
            DirectFlightsOnly: false,
            AvailableFlightsOnly: true,
            OriginDestinationInformation: [
                {
                    RPH: '1',
                    DepartureDateTime: `${params.date}T00:00:00`,
                    OriginLocation: { LocationCode: params.origin.toUpperCase() },
                    DestinationLocation: { LocationCode: params.destination.toUpperCase() },
                    TPA_Extensions: {
                        SegmentType: { Code: 'O' },
                    },
                },
            ],
            TravelPreferences: {
                MaxStopsQuantity: 3,
                CabinPref: [{ Cabin: cabinCode, PreferLevel: 'Preferred' }],
                TPA_Extensions: {
                    NumTrips: { Number: 50 },
                },
            },
            TravelerInfoSummary: {
                SeatsRequested: [adults],
                AirTravelerAvail: [
                    {
                        PassengerTypeQuantity: [
                            { Code: 'ADT', Quantity: adults },
                        ],
                    },
                ],
                PriceRequestInformation: {
                    CurrencyCode: params.currency || 'USD',
                    TPA_Extensions: {
                        BrandedFareIndicators: {
                            ReturnBrandAncillaries: true,
                            SingleBrandedFare: true,
                        },
                    },
                },
            },
            TPA_Extensions: {
                IntelliSellTransaction: {
                    RequestType: { Name: '50ITINS' },
                },
            },
        },
    };

    const res = await fetch(`${baseUrl}/v3/offers/shop`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new SabreSearchError(`Sabre search failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = await res.json();

    const itineraries: any[] =
        data?.OTA_AirLowFareSearchRS?.PricedItineraries?.PricedItinerary ?? [];

    return itineraries;
}
