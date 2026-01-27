"use server";

import { searchFlights, type FlightOffer } from "@/lib/flightApi";

export async function searchFlightsAction(formData: FormData) {
    const from = (formData.get("from") as string)?.trim().toUpperCase();
    const to = (formData.get("to") as string)?.trim().toUpperCase();
    const departureDate = formData.get("departureDate") as string;
    const returnDate = formData.get("returnDate") as string;
    const cabin = formData.get("cabin") as string;

    if (!from || !to || !departureDate) {
        return { error: "Missing required fields" };
    }

    // Validate city/airport codes (3 letters, alphabetic)
    if (!/^[A-Z]{3}$/.test(from)) {
        return { error: `Invalid origin code "${from}". Please select a city from the autocomplete.` };
    }
    if (!/^[A-Z]{3}$/.test(to)) {
        return { error: `Invalid destination code "${to}". Please select a city from the autocomplete.` };
    }

    try {
        // searchFlights now handles city → airports mapping automatically
        const offers = await searchFlights(
            from,
            to,
            departureDate,
            returnDate || undefined,
            cabin as any,
            15 // Show top 15 results (more options from multiple airports)
        );

        if (offers.length === 0) {
            return { error: "No flights found for this route. Please try different dates or cities." };
        }

        console.log(`[search-flights] Found ${offers.length} flight offers`);

        return {
            success: true,
            offers,
            route: { from, to, departureDate, returnDate, cabin }
        };
    } catch (error) {
        console.error('[search-flights] Search failed:', error);
        return { error: "Failed to search flights. Please try again." };
    }
}
