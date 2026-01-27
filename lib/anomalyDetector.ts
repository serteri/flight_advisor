import { prisma } from "@/lib/prisma";
import {
    calculateMean,
    calculateStdDev,
    calculateDealScore,
    calculateDropPercent,
    isAnomaly,
    generateAnomalyExplanation,
} from "@/lib/anomaly";

export interface AnalysisResult {
    hasEnoughData: boolean;
    currentPrice: number;
    mean: number;
    stdDev: number;
    dealScore: number;
    dropPercent: number;
    isAnomaly: boolean;
    explanation?: string;
}

export async function analyzeRoute(routeId: string): Promise<AnalysisResult> {
    try {
        // Fetch route with current price
        const route = await prisma.route.findUnique({
            where: { id: routeId },
        });

        if (!route || route.currentPrice === null) {
            console.log(`[AnomalyDetector] Route ${routeId} has no current price`);
            return {
                hasEnoughData: false,
                currentPrice: 0,
                mean: 0,
                stdDev: 0,
                dealScore: 0,
                dropPercent: 0,
                isAnomaly: false,
            };
        }

        // Fetch last 30 price snapshots
        const snapshots = await prisma.priceSnapshot.findMany({
            where: { routeId },
            orderBy: { timestamp: 'desc' },
            take: 30,
        });

        // Need minimum 5 snapshots for meaningful analysis
        if (snapshots.length < 5) {
            console.log(`[AnomalyDetector] Route ${routeId} has only ${snapshots.length} snapshots (need 5+)`);
            return {
                hasEnoughData: false,
                currentPrice: route.currentPrice,
                mean: 0,
                stdDev: 0,
                dealScore: 0,
                dropPercent: 0,
                isAnomaly: false,
            };
        }

        // Extract historical prices
        const historicalPrices = snapshots.map(s => s.amount);
        const currentPrice = route.currentPrice;

        // Calculate statistics using existing anomaly.ts functions
        const mean = calculateMean(historicalPrices);
        const stdDev = calculateStdDev(historicalPrices);
        // Check if latest snapshot has a score (LLM score)
        const latestSnapshot = snapshots[0];
        const llmScore = latestSnapshot?.score;

        // Use LLM score if available, otherwise calculate basic statistical score
        const dealScore = llmScore ?? calculateDealScore(currentPrice, historicalPrices);

        const dropPercent = calculateDropPercent(mean, currentPrice);
        const anomalyDetected = isAnomaly(dropPercent);

        console.log(`[AnomalyDetector] Route ${route.originCode}→${route.destinationCode}:`);
        console.log(`  Current: ${currentPrice} TRY`);
        console.log(`  Mean: ${mean.toFixed(2)} TRY`);
        console.log(`  StdDev: ${stdDev.toFixed(2)}`);
        console.log(`  Deal Score: ${dealScore}/10`);
        console.log(`  Drop: ${dropPercent.toFixed(1)}%`);
        console.log(`  Anomaly: ${anomalyDetected ? 'YES' : 'NO'}`);

        // Update route stats cache
        await prisma.route.update({
            where: { id: routeId },
            data: {
                stats_mean: mean,
                stats_stdDev: stdDev,
                stats_lastUpdated: new Date(),
            },
        });

        const result: AnalysisResult = {
            hasEnoughData: true,
            currentPrice,
            mean,
            stdDev,
            dealScore,
            dropPercent,
            isAnomaly: anomalyDetected,
            explanation: latestSnapshot?.explanation ?? (anomalyDetected
                ? generateAnomalyExplanation(mean, currentPrice, dropPercent)
                : undefined),
        };

        return result;
    } catch (error) {
        console.error(`[AnomalyDetector] Failed to analyze route ${routeId}:`, error);
        throw error;
    }
}
