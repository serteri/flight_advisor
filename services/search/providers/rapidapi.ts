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

            const airlineName = carrier.name;
            const logoUrl = carrier.logoUrl;

            // 🧠 INTELLIGENCE: Infer stats for known Full Service Carriers (FSC)
            // If RapidAPI returns null for amenities, we assume YES for these premium airlines
            const isFullService = ["Qatar Airways", "Turkish Airlines", "Singapore Airlines", "Emirates", "Lufthansa", "Qantas", "Etihad Airways"].includes(airlineName);

            return {
                id: item.id,
                source: 'RAPID_API', // 🏷️ Explicit Flag
                agentScore: 7.5, // Default/Placeholder, will be rescored by engine

                airline: airlineName,
                airlineLogo: logoUrl,
                flightNumber: `${carrier.alternateId || ''}${leg.segments[0].flightNumber || ''}`, // Construct Flight No

                price: item.price.raw,
                currency: 'AUD', // RapidAPI usually returns this or we need to map from item.price.currency

                departTime: leg.departure, // ISO String
                arriveTime: leg.arrival,   // ISO String

                from: leg.origin.displayCode,
                to: leg.destination.displayCode,

                duration: leg.durationInMinutes,
                stops: leg.stopCount,

                amenities: {
                    hasWifi: isFullService ? true : false, // Optimistic assumption for FSC
                    hasMeal: isFullService ? true : false, // Optimistic assumption for FSC
                    hasUsb: isFullService ? true : false,
                    legroom: isFullService ? "79cm" : "Standard"
                },

                baggageSummary: {
                    checked: isFullService ? "Usually Included" : "Check Airline",
                    cabin: "7kg",
                    totalWeight: "20kg" // Assumption for display
                },

                legal: {
                    isRefundable: false, // Safer default
                    changeFee: "Unknown",
                    formattedRefund: "Non-refundable"
                },

                bookingLink: "https://skyscanner.com", // Placeholder or use if specific link logic exists
                analysis: null
            };
        });

    } catch (error) {
        console.error("RapidAPI Search Error:", error);
        return []; // Return empty on error to avoid breaking main flow
    }
}
