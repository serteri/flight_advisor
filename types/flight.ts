export type FlightResult = {
  id: string;
  source: "duffel" | "kiwi" | "travelpayouts";
  airline: string;
  flightNumber: string;
  aircraft?: string;
  from: string;
  to: string;
  departTime: string;
  arriveTime: string;
  duration: number;
  stops: number;
  price: number;
  currency: string;
  cabinClass: "economy" | "premium" | "business" | "first";
  baggage?: "none" | "cabin" | "checked";
  fareType?: "basic" | "standard" | "flex";
  bookingLink?: string;
};

export type FlightAnalysis = {
    flightId: string,
    score: number,
    pros: string[],
    cons: string[],
    stressMap: any, // Simplified for now
    recommendationText: string,
    decisionTriangle: any // Simplified for now
}

export type EnrichedFlightResult = FlightResult & {
    seatComfortScore?: number;
    wifi?: boolean;
    delayRisk?: "low" | "medium" | "high";
    rarityScore?: number;
    score?: number;
}