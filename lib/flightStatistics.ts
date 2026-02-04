
import { FlightForScoring } from './flightTypes';

export interface BatchStats {
    minPrice: number;    // En ucuz (Hacker Fare dahil)
    maxPrice: number;    // En pahalı
    medianPrice: number; // Piyasanın tam ortası (En güvenilir referans)
    p10Price: number;    // En ucuz %10'luk dilim (Gerçek fırsatlar)
    minDuration: number; // En hızlı uçuş süresi
    maxDuration: number; // En yavaş uçuş (Normalize için)
}

export function calculateBatchStats(flights: FlightForScoring[]): BatchStats {
    if (!flights || flights.length === 0) {
        return { minPrice: 0, maxPrice: 0, medianPrice: 0, p10Price: 0, minDuration: 0, maxDuration: 0 };
    }

    // Fiyatları küçükten büyüğe sırala (Use effectivePrice if available)
    const prices = flights.map(f => f.effectivePrice || f.price).sort((a, b) => a - b);
    const durations = flights.map(f => f.duration).sort((a, b) => a - b);

    // Median (Ortanca) Hesapla
    const mid = Math.floor(prices.length / 2);
    const medianPrice = prices.length % 2 !== 0
        ? prices[mid]
        : (prices[mid - 1] + prices[mid]) / 2;

    // P10 (En iyi %10) Hesapla
    const p10Index = Math.floor(prices.length * 0.1);
    const p10Price = prices[p10Index] || prices[0];

    // Reference Price (Outlier Cleaned Base Price)
    // Avoid using the absolute cheapest if it's an outlier. Use P10 as the baseline for "Good Price".
    const referencePrice = p10Price;

    return {
        minPrice: prices[0],
        maxPrice: prices[prices.length - 1],
        medianPrice,
        p10Price,
        minDuration: durations[0],
        maxDuration: durations[durations.length - 1] // Added for normalization
    };
}
