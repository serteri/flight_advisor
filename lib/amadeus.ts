import axios, { AxiosInstance } from "axios";
// @ts-ignore
import Amadeus from "amadeus";

const AM_HOST = process.env.AMADEUS_ENV === "LIVE"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

let cachedToken: { access_token: string; expires_at: number } | null = null;

// Type definitions
export interface FlightSearchParams {
    originLocationCode: string;
    destinationLocationCode: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
    currencyCode?: string;
}

export interface CitySearchResult {
    iataCode: string;
    name: string;
    address?: {
        cityName?: string;
        countryName?: string;
    };
    subType?: "CITY" | "AIRPORT";
}

function amadeusClient(token?: string): AxiosInstance {
    return axios.create({
        baseURL: AM_HOST,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        timeout: 25_000,
    });
}

async function getToken(): Promise<string> {
    const now = Date.now();
    if (cachedToken && now < cachedToken.expires_at - 30_000) return cachedToken.access_token;

    const res = await axios.post(`${AM_HOST}/v1/security/oauth2/token`,
        new URLSearchParams({
            grant_type: "client_credentials",
            client_id: process.env.AMADEUS_API_KEY!,
            client_secret: process.env.AMADEUS_API_SECRET!,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    cachedToken = {
        access_token: res.data.access_token,
        expires_at: Date.now() + res.data.expires_in * 1000,
    };
    return cachedToken.access_token;
}

// Search flights using REST API
export async function searchFlights(params: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    children?: number;      // 2-11 yaş arası çocuk sayısı
    infants?: number;       // 0-2 yaş arası bebek sayısı
    travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
    currency?: string;      // Curreny code (e.g. TRY, USD, EUR)
}) {
    const token = await getToken();
    const client = amadeusClient(token);

    const query: Record<string, string> = {
        originLocationCode: params.origin,
        destinationLocationCode: params.destination,
        departureDate: params.departureDate,
        adults: String(params.adults ?? 1),
        currencyCode: params.currency || "TRY",
        max: "250",
        nonStop: "false",
    };

    // Optional parameters
    if (params.returnDate) query.returnDate = params.returnDate;
    if (params.travelClass) query.travelClass = params.travelClass;
    if (params.children && params.children > 0) query.children = String(params.children);
    if (params.infants && params.infants > 0) query.infants = String(params.infants);

    const res = await client.get("/v2/shopping/flight-offers", { params: query });
    return res.data;
}

// Search cities/airports
async function searchCity(keyword: string): Promise<CitySearchResult[]> {
    const token = await getToken();
    const client = amadeusClient(token);

    try {
        const res = await client.get("/v1/reference-data/locations", {
            params: {
                keyword: keyword,
                subType: "CITY,AIRPORT",
                "page[limit]": 10,
            }
        });
        return res.data.data || [];
    } catch (error) {
        console.error("[Amadeus] City search failed:", error);
        return [];
    }
}

// Get all airports for a city code
async function getCityAirports(cityCode: string): Promise<string[]> {
    const token = await getToken();
    const client = amadeusClient(token);

    try {
        const res = await client.get("/v1/reference-data/locations", {
            params: {
                keyword: cityCode,
                subType: "AIRPORT",
                "page[limit]": 10,
            }
        });

        const airports = res.data.data || [];
        const codes = airports.map((a: any) => a.iataCode);

        // If no airports found, return the original code (might be an airport itself)
        return codes.length > 0 ? codes : [cityCode];
    } catch (error) {
        console.error("[Amadeus] Get city airports failed:", error);
        return [cityCode];
    }
}

// Wrapper function to search flights with FlightSearchParams
async function searchFlightsWithParams(params: FlightSearchParams): Promise<any[]> {
    const token = await getToken();
    const client = amadeusClient(token);

    try {
        const query = {
            originLocationCode: params.originLocationCode,
            destinationLocationCode: params.destinationLocationCode,
            departureDate: params.departureDate,
            ...(params.returnDate ? { returnDate: params.returnDate } : {}),
            adults: String(params.adults ?? 1),
            ...(params.travelClass ? { travelClass: params.travelClass } : {}),
            currencyCode: params.currencyCode || "TRY",
            max: "250",
            nonStop: "false",
        };

        const res = await client.get("/v2/shopping/flight-offers", { params: query });
        return res.data.data || [];
    } catch (error) {
        console.error("[Amadeus] Flight search failed:", error);
        return [];
    }
}

// Client wrapper that provides all methods
class AmadeusClientWrapper {
    async searchCity(keyword: string) {
        return searchCity(keyword);
    }

    async searchCitiesOnly(keyword: string): Promise<CitySearchResult[]> {
        const token = await getToken();
        const client = amadeusClient(token);

        try {
            const res = await client.get("/v1/reference-data/locations", {
                params: {
                    keyword: keyword,
                    subType: "CITY",
                    "page[limit]": 10,
                }
            });
            return res.data.data || [];
        } catch (error) {
            console.error("[Amadeus] Cities only search failed:", error);
            return [];
        }
    }

    async searchFlights(params: FlightSearchParams) {
        return searchFlightsWithParams(params);
    }

    async getCityAirports(cityCode: string) {
        return getCityAirports(cityCode);
    }

    async getNearestAirport(latitude: number, longitude: number) {
        const token = await getToken();
        const client = amadeusClient(token);

        try {
            const res = await client.get("/v1/reference-data/locations/airports", {
                params: {
                    latitude,
                    longitude,
                    radius: 500,
                    "page[limit]": 1,
                }
            });
            return res.data.data?.[0] || null;
        } catch (error) {
            console.error("[Amadeus] Nearest airport search failed:", error);
            return null;
        }
    }
}

// Singleton instance
let clientInstance: AmadeusClientWrapper | null = null;

export function getAmadeusClient(): AmadeusClientWrapper {
    if (!clientInstance) {
        clientInstance = new AmadeusClientWrapper();
    }
    return clientInstance;
}

// Create Amadeus SDK instance for direct SDK usage
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_API_KEY,
    clientSecret: process.env.AMADEUS_API_SECRET,
    hostname: process.env.AMADEUS_ENV === "LIVE" ? "production" : "test",
});

// Default export for routes that use amadeus SDK directly
export default amadeus;