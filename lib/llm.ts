import { GoogleGenerativeAI } from "@google/generative-ai";
import { type FlightOffer } from "./flightApi";

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export interface ScoredFlight {
    flight: FlightOffer;
    score: number;
    explanation: string;
}

export async function evaluateFlightDeals(
    origin: string,
    destination: string,
    flights: FlightOffer[]
): Promise<ScoredFlight | null> {
    if (!genAI) {
        console.warn("[LLM] No Google API Key found. Returning cheapest flight.");
        return flights.length > 0 ? { flight: flights[0], score: 5, explanation: "Cheapest option selected (LLM disabled)." } : null;
    }

    if (flights.length === 0) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `
You are an expert flight deal analyst. Evaluate these flight options for a trip from ${origin} to ${destination}.
Select the BEST flight based on a balance of price, duration, and stops. 
- Lower price is better, but not at the cost of unreasonable duration.
- Direct flights are preferred.
- Short layovers are good, very long layovers (>12h) are bad.

Flights:
${flights.map((f, i) => `
Option ${i + 1}:
- Price: ${f.price} ${f.currency}
- Airline: ${f.carrier}
- Duration: ${Math.floor((f.duration || 0) / 60)}h ${(f.duration || 0) % 60}m
- Stops: ${f.stops}
- Itinerary: ${f.itinerary?.join(", ")}
`).join("\n")}

Respond ONLY with a JSON object in this format:
{
  "bestOptionIndex": number (1-based index),
  "score": number (1-10 quality score),
  "explanation": "Short, concise reason why this wins."
}
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean markdown code blocks if present
        const jsonText = responseText.replace(/```json|```/g, "").trim();
        const analysis = JSON.parse(jsonText);

        const bestIndex = analysis.bestOptionIndex - 1;
        if (bestIndex < 0 || bestIndex >= flights.length) {
            throw new Error("Invalid index returned by LLM");
        }

        return {
            flight: flights[bestIndex],
            score: analysis.score,
            explanation: analysis.explanation
        };

    } catch (error) {
        console.error("[LLM] Scoring failed:", error);
        // Fallback to cheapest
        return { flight: flights[0], score: 5, explanation: "Fallback to cheapest due to scoring error." };
    }
}
