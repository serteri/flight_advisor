
import axios from 'axios';

// SERVICES/API.TS - INTEGRATION LAYER

// AMADEUS API (Price & Ticket Check)
export async function checkAmadeusPrice(pnr: string): Promise<{ price: number, currency: string }> {
    try {
        // 1. Get Token (OAuth2)
        // In prod, cache this token!
        const auth = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token',
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: process.env.AMADEUS_CLIENT_ID || '',
                client_secret: process.env.AMADEUS_CLIENT_SECRET || ''
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const token = auth.data.access_token;

        // 2. Query Ticket
        const pnrData = await axios.get(`https://test.api.amadeus.com/v1/booking/flight-orders/${pnr}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // 3. Re-price the itinerary
        // This is complex in reality, verifying the same segments. 
        // Simplified: We assume we call flight-offers-search with the same parameters
        // For this SaaS Engine code, we'll return a mocked "live" price based on the response structure
        // because we don't have the full flight-offers body construction logic here yet.
        // But this IS where the real HTTP call happens.

        // MOCK REAL HTTP RESPONSE FOR NOW TO PREVENT RUNTIME ERROR WITHOUT CREDS
        // console.log("Real API Call to Amadeus for", pnr);
        return { price: 1150.00, currency: 'AUD' };

    } catch (error) {
        console.error("Amadeus API Error:", error);
        return { price: 0, currency: 'AUD' };
    }
}

// FLIGHTAWARE API (Delay Check)
export async function checkFlightAwareStatus(flightNumber: string, date: string) {
    try {
        // carrier + number e.g. TK1984
        // const response = await axios.get(`https://aeroapi.flightaware.com/aeroapi/flights/${flightNumber}`, {
        //   headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY }
        // });

        // const flight = response.data.flights[0];
        // const delaySeconds = flight ? (flight.actual_on - flight.scheduled_on) : 0;

        // Mocking for safety
        return {
            delayMinutes: 45, // Simulating a delay
            reason: 'TECHNICAL'
        };
    } catch (error) {
        console.error("FlightAware API Error:", error);
        return { delayMinutes: 0, reason: 'UNKNOWN' };
    }
}
