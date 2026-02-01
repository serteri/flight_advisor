import axios, { AxiosInstance } from "axios";
// @ts-ignore
import Amadeus from "amadeus";

const AM_HOST = process.env.AMADEUS_HOST === "production"
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

    // Get Seat Map
    async getSeatMap(flightOfferId: string): Promise<any> {
        const token = await getToken();
        const client = amadeusClient(token);

        try {
            // Note: SeatMap usually requires POST with the flight offer
            // But Amadeus also has a GET for just display based on flight-orderId or simplified params.
            // Actually, 'shopping/seatmaps' creates a POST request with the offer.
            // Getting seatmap WITHOUT booking is tricky.
            // We will try GET /v1/shopping/seatmaps with flight-orderId if available, OR
            // POST /v1/shopping/seatmaps with the offer object.
            // For now, let's implement the POST version assuming we have the flight offer JSON.
            return null; // TODO: Needs complex implementation passing the full offer object.
        } catch (error) {
            console.error("[Amadeus] Seat map failed:", error);
            return null;
        }
    }

    // ... existing code ...

    async getNearestAirport(latitude: number, longitude: number) {
        // ... existing implementation ...
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

    // NEW: Seat Map Integration
    // Since SeatMap requires fully formatted flight offer, we will add a helper
    // to search -> get offer -> get seatmap.
    async getRealSeatMap(flightParams: any) {
        // 1. Search for the flight again to get a fresh 'offer' object
        const offers = await this.searchFlights({
            originLocationCode: flightParams.origin,
            destinationLocationCode: flightParams.destination,
            departureDate: flightParams.date,
            adults: 1,
            currencyCode: flightParams.currency || "USD"
        });

        const validOffer = offers?.find((o: any) =>
            o.itineraries?.[0]?.segments?.some((s: any) =>
                s.carrierCode === flightParams.airlineCode && s.number === flightParams.flightNumber
            )
        );

        if (!validOffer) return null;

        // 2. Call SeatMap API using this offer
        const token = await getToken();
        const client = amadeusClient(token);

        try {
            const res = await client.post("/v1/shopping/seatmaps", {
                data: [validOffer]
            });
            return res.data.data?.[0] || null;
        } catch (e) {
            console.log("SeatMap API Error (likely not authorized or no data):", e);
            return null;
        }
    }

}
// ... existing code ...
export default amadeus;

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
    hostname: process.env.AMADEUS_HOST === "production" ? "production" : "test",
});

// Default export for routes that use amadeus SDK directly
export default amadeus;