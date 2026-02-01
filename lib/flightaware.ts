
const BASE_URL = 'https://aeroapi.flightaware.com/aeroapi';

export interface FlightStatus {
    ident: string;          // Uçuş Kodu (Örn: THY59)
    status: string;         // "Arrived", "En Route", "Cancelled"
    scheduled_off: string;  // Planlanan Kalkış
    actual_off: string;     // Gerçekleşen Kalkış
    scheduled_on: string;   // Planlanan İniş
    actual_on: string;      // Gerçekleşen İniş
    arrival_delay: number;  // Saniye cinsinden gecikme (En önemli veri!)
}

export async function getRealTimeFlightData(flightIdent: string): Promise<FlightStatus | null> {
    if (!process.env.FLIGHTAWARE_API_KEY) {
        console.error("FlightAware API Key eksik!");
        return null;
    }

    try {
        // AeroAPI v4: Uçuş Durumu Sorgulama
        // ident: Operator kodu + Uçuş numarası (Örn: THY59 veya TK59 değil, ICAO kodu istenir genelde ama IATA da çalışır)
        const response = await fetch(`${BASE_URL}/flights/${flightIdent}`, {
            headers: {
                'x-apikey': process.env.FLIGHTAWARE_API_KEY
            },
            next: { revalidate: 60 } // 1 dakika cache (Sürekli sormayalım)
        });

        if (!response.ok) {
            console.error("FlightAware Error:", await response.text());
            return null;
        }

        const data = await response.json();

        // En son gerçekleşen uçuşu al (flights array döner)
        const flight = data.flights[0];

        if (!flight) return null;

        return {
            ident: flight.ident,
            status: flight.status,
            scheduled_off: flight.scheduled_out,
            actual_off: flight.actual_out,
            scheduled_on: flight.scheduled_in,
            actual_on: flight.actual_in,
            arrival_delay: flight.arrival_delay || 0 // Saniye cinsinden
        };

    } catch (error) {
        console.error("FlightAware Connection Failed:", error);
        return null;
    }
}
