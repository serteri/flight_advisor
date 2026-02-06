export interface Flight {
    id: string;
    airline: string;
    airlineLogo: string;
    departure: {
        iata: string;
        time: string;
    };
    arrival: {
        iata: string;
        time: string;
    };
    price: number;
    currency: string;
    deepLink: string; // Orijinal havayolu linki
    affiliateUrl?: string; // Travelpayouts ile üretilecek link
    agentScore?: number;
}
