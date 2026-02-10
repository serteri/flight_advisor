import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';

export async function searchDuffel(params: HybridSearchParams): Promise<FlightResult[]> {
    // In a real implementation, we would call the Duffel API here.
    // For now, we'll return mock data that looks like Duffel's NDC content.

    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API latency

    // Mock Data with V3 Premium Fields
    const mockFlights: FlightResult[] = [
        {
            id: 'duffel_1',
            source: 'duffel',
            airline: 'Turkish Airlines',
            flightNumber: 'TK1984',
            from: params.origin,
            to: params.destination,
            departTime: `${params.date}T10:30:00`,
            arriveTime: `${params.date}T22:30:00`,
            duration: 720, // 12h
            stops: 0,
            price: 1250, // Reasonable price
            currency: 'USD',
            cabinClass: params.cabin || 'economy',
            // V3 Data
            amenities: {
                hasWifi: true,
                hasPower: true,
                hasMeal: true,
                seatType: "Standard Economy (79cm)"
            },
            baggageSummary: {
                checked: "2x23kg",
                cabin: "8kg",
                totalWeight: "46"
            },
            legal: {
                refundStatus: "İade Edilebilir (Cezalı)",
                changeStatus: "Değişim: 50 USD",
                formattedRefund: "⚠️ Kısmi İade",
                formattedChange: "Değişim: $50",
                isRefundable: true,
                isChangeable: true
            },
            bookingLink: 'https://turkishallergies.com/book'
        },
        {
            id: 'duffel_2',
            source: 'duffel',
            airline: 'Singapore Airlines', // The expensive one user complained about
            flightNumber: 'SQ232',
            from: params.origin,
            to: params.destination,
            departTime: `${params.date}T14:00:00`,
            arriveTime: `${params.date}T06:00:00`, // Next day
            duration: 960, // 16h
            stops: 1,
            price: 6445, // Expensive! Should trigger Price Massacre
            currency: 'USD',
            cabinClass: 'economy',
            // V3 Data
            amenities: {
                hasWifi: true,
                hasPower: true,
                hasMeal: true,
                seatType: "Premium Economy-ish"
            },
            baggageSummary: {
                checked: "2x23kg",
                cabin: "7kg",
                totalWeight: "46"
            },
            legal: {
                refundStatus: "Tam İade",
                changeStatus: "Ücretsiz",
                formattedRefund: "✅ Tam İade",
                formattedChange: "✅ Ücretsiz Değişim",
                isRefundable: true,
                isChangeable: true
            },
            bookingLink: 'https://singaporeair.com/book'
        },
        {
            id: 'duffel_3', // "Hacker" Fare to test penalties
            source: 'duffel',
            airline: 'Pegasus',
            flightNumber: 'PC123',
            from: params.origin,
            to: params.destination,
            departTime: `${params.date}T06:00:00`,
            arriveTime: `${params.date}T18:00:00`,
            duration: 720,
            stops: 1,
            price: 450, // Cheap but...
            currency: 'USD',
            cabinClass: 'economy',
            // V3 Data
            amenities: {
                hasWifi: false,
                hasPower: false,
                hasMeal: false,
                seatType: "Tight (72cm)"
            },
            baggageSummary: {
                checked: "0",
                cabin: "4kg",
                totalWeight: "0"
            },
            legal: {
                refundStatus: "İade Yok",
                changeStatus: "Değişim Yok",
                formattedRefund: "❌ İade Yok",
                formattedChange: "❌ Değişim Yok",
                isRefundable: false, // Penalty!
                isChangeable: false
            },
            bookingLink: 'https://flypgs.com'
        }
    ];
    return mockFlights;
}
