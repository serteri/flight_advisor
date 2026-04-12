const DEFAULT_AIRLINE_LOGO = '/airlines/default.png';

type SegmentLogoLike = {
    airlineLogo?: unknown;
    carrierCode?: unknown;
    marketingAirline?: unknown;
    airlineCode?: unknown;
} | null | undefined;

type FlightLogoLike = {
    airlineLogo?: unknown;
    logo?: unknown;
    airlineCode?: unknown;
    carrierCode?: unknown;
    carrier?: unknown;
    marketingAirlineCode?: unknown;
    segments?: SegmentLogoLike[] | null;
} | null | undefined;

const normalizeLogoValue = (value: unknown): string => String(value || '').trim();

export const extractAirlineCode = (flight: FlightLogoLike): string => {
    const firstSegment = Array.isArray(flight?.segments) ? flight?.segments[0] : undefined;
    const candidates = [
        flight?.airlineCode,
        flight?.carrierCode,
        flight?.carrier,
        flight?.marketingAirlineCode,
        firstSegment?.carrierCode,
        firstSegment?.marketingAirline,
        firstSegment?.airlineCode,
    ];

    for (const value of candidates) {
        const normalized = normalizeLogoValue(value).toUpperCase();
        if (/^[A-Z0-9]{2,3}$/.test(normalized)) {
            return normalized;
        }
    }

    return '';
};

const toGstaticLogo = (airlineCode: string): string =>
    airlineCode ? `https://www.gstatic.com/flights/airline_logos/70px/${airlineCode}.png` : '';

export const getAirlineLogoCandidates = (flight: FlightLogoLike): string[] => {
    const firstSegment = Array.isArray(flight?.segments) ? flight?.segments[0] : undefined;
    const candidates = [
        flight?.airlineLogo,
        flight?.logo,
        firstSegment?.airlineLogo,
        toGstaticLogo(extractAirlineCode(flight)),
        DEFAULT_AIRLINE_LOGO,
    ]
        .map(normalizeLogoValue)
        .filter(Boolean);

    return Array.from(new Set(candidates));
};

export { DEFAULT_AIRLINE_LOGO };