
export function calculateMean(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return sum / numbers.length;
}

export function calculateStdDev(numbers: number[]): number {
    if (numbers.length < 2) return 0;
    const mean = calculateMean(numbers);
    const variance = numbers.reduce((curr, n) => curr + Math.pow(n - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
}

export function calculateDealScore(currentPrice: number, history: number[]): number {
    if (history.length < 3) return 0; // Not enough data for meaningful score

    const mean = calculateMean(history);
    const stdDev = calculateStdDev(history);

    if (stdDev === 0) return 0;

    // Z-Score: (Mean - Current) / StdDev
    const zScore = (mean - currentPrice) / stdDev;

    // Map Z-Score to 0-10 scale
    // Z=0 (Average) -> Score 5
    // Z=1 (1 Sigma Better) -> Score 7
    // Z=2 (2 Sigma Better) -> Score 9
    // Z=-1 (Expensive) -> Score 3

    let score = 5 + (zScore * 2);

    return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

// 8. MVP anomaly rule
// dropPercent = (mean - currentPrice) / mean * 100
export function calculateDropPercent(mean: number, currentPrice: number): number {
    if (mean === 0) return 0;
    return ((mean - currentPrice) / mean) * 100;
}

export function isAnomaly(dropPercent: number): boolean {
    // Week 1: 25% drop rule
    return dropPercent >= 25;
}

// 9. Explain message
export function generateAnomalyExplanation(mean: number, currentPrice: number, dropPercent: number): string {
    return `Price dropped ${Math.round(dropPercent)}% below normal. Avg: ${Math.round(mean)} TRY. Now: ${currentPrice} TRY.`;
}
