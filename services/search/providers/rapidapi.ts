// services/search/providers/rapidApi.ts

export async function searchRapidApi(params: { origin: string, destination: string, date: string, returnDate?: string }) {
    // RapidAPI Key check
    if (!process.env.RAPID_API_KEY) {
        console.warn("RapidAPI Key missing!");
        return [];
    }

    // Using Sky-Scrapper format or similar flight API
    // Note: The params for custom scraper might differ, adapting to generic structure provided by user
    let url = `https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchFlights?originSky=${params.origin}&destinationSky=${params.destination}&date=${params.date}&cabinClass=economy&adults=1&sortBy=best`;

    if (params.returnDate) {
        url += `&returnDate=${params.returnDate}`;
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': process.env.RAPID_API_KEY!,
                'X-RapidAPI-Host': 'sky-scrapper.p.rapidapi.com'
            }
        });

        if (!response.ok) {
            console.error(`RapidAPI Error: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();

        if (!data.data || !data.data.itineraries) return [];

        // MAPPING RapidAPI -> FlightResult
        return data.data.itineraries.map((item: any) => {
            const leg = item.legs[0];
            const carrier = leg.carriers.marketing[0];

            return {
                id: item.id,
                source: 'RAPID_API', // TAG: RapidAPI Source
                airline: carrier.name,
                airlineLogo: carrier.logoUrl,
                airlineCode: carrier.alternateId,
                flightNumber: `${carrier.alternateId || ''} ${leg.segments[0].flightNumber}`, // Construct flight number
                from: leg.origin.displayCode,
                to: leg.destination.displayCode,
                departTime: leg.departure,
                arriveTime: leg.arrival,
                duration: leg.durationInMinutes,
                stops: leg.stopCount,
                price: item.price.raw,
                currency: 'USD', // Often USD from this API
                cabinClass: 'economy',

                // Default details since scraper details are limited
                amenities: { hasWifi: false, hasMeal: true },

                // Original booking link if available and safe
                deepLink: "https://skyscanner.com" // Placeholder or use if specific link logic exists
            };
        });

    } catch (error) {
        console.error("RapidAPI Search Error:", error);
        return []; // Return empty on error to avoid breaking main flow
    }
}
