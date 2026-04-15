import { prisma } from '@/lib/prisma';

export interface DecisionRecord {
	eventId: string;
	origin: string;
	destination: string;
	departureDate: Date;
	decisionType: 'BUY_NOW' | 'WAIT' | 'AVOID';
	decisionConfidence: number;
	priceAtDecision: number;
	decidedAt: Date;
}

export interface DecisionAccuracyResult {
	eventId: string;
	isAccurate: boolean;
	accuracyScore: number;
	priceChange: number;
	priceChangePercent: number;
	feedback: string;
}

class DecisionAccuracyTracker {
	static async recordDecision(record: DecisionRecord): Promise<{
		success: boolean;
		accuracyId?: string;
		error?: string;
	}> {
		try {
			const model = (prisma as any)?.decisionAccuracy;
			if (!model) {
				return { success: false, error: 'DecisionAccuracy model unavailable' };
			}

			const created = await model.create({
				data: {
					origin: record.origin,
					destination: record.destination,
					departureDate: record.departureDate,
					decisionType: record.decisionType,
					decisionConfidence: record.decisionConfidence,
					priceAtDecision: record.priceAtDecision,
					decidedAt: record.decidedAt,
					eventId: record.eventId,
				},
			});

			return { success: true, accuracyId: created.id };
		} catch (error) {
			console.error('[DecisionAccuracyTracker] Record failed:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	static async evaluateDecision(
		accuracyId: string,
		currentPrice: number
	): Promise<DecisionAccuracyResult | null> {
		try {
			const model = (prisma as any)?.decisionAccuracy;
			if (!model) return null;

			const decision = await model.findUnique({ where: { id: accuracyId } });
			if (!decision) return null;

			const priceChange = currentPrice - decision.priceAtDecision;
			const priceChangePercent = (priceChange / decision.priceAtDecision) * 100;

			let isAccurate = false;
			let accuracyScore = 0;
			let feedback = '';

			if (decision.decisionType === 'BUY_NOW') {
				if (priceChange > 0) {
					isAccurate = true;
					accuracyScore = Math.min(100, 50 + priceChangePercent * 0.5);
					feedback = `Correct! Price increased ${priceChangePercent.toFixed(1)}% after decision.`;
				} else {
					isAccurate = false;
					accuracyScore = Math.max(0, 50 - Math.abs(priceChangePercent) * 0.5);
					feedback = `Incorrect. Price decreased ${Math.abs(priceChangePercent).toFixed(1)}% instead.`;
				}
			} else if (decision.decisionType === 'WAIT') {
				if (priceChange < 0) {
					isAccurate = true;
					accuracyScore = Math.min(100, 50 + Math.abs(priceChangePercent) * 0.5);
					feedback = `Correct! Price decreased ${Math.abs(priceChangePercent).toFixed(1)}% as expected.`;
				} else {
					isAccurate = false;
					accuracyScore = Math.max(0, 50 - priceChangePercent * 0.5);
					feedback = `Incorrect. Price increased ${priceChangePercent.toFixed(1)}% instead of dropping.`;
				}
			} else if (decision.decisionType === 'AVOID') {
				if (priceChange > 300) {
					isAccurate = true;
					accuracyScore = Math.min(100, 50 + priceChangePercent * 0.3);
					feedback = `Correct! Price spiked ${priceChangePercent.toFixed(1)}%, validating AVOID.`;
				} else if (priceChange < 0) {
					isAccurate = false;
					accuracyScore = Math.max(0, 25 + Math.abs(priceChangePercent) * 0.5);
					feedback = `Uncertain. Price dropped ${Math.abs(priceChangePercent).toFixed(1)}%, making AVOID questionable.`;
				} else {
					isAccurate = true;
					accuracyScore = 60;
					feedback = 'Reasonable. Price remained stable, AVOID avoided regret.';
				}
			}

			await model.update({
				where: { id: accuracyId },
				data: {
					evaluatedAt: new Date(),
					priceAtEvaluation: currentPrice,
					priceChange,
					priceChangePercent: Number(priceChangePercent.toFixed(2)),
					isAccurate,
					accuracyScore: Math.round(accuracyScore),
				},
			});

			return {
				eventId: decision.eventId || '',
				isAccurate,
				accuracyScore: Math.round(accuracyScore),
				priceChange,
				priceChangePercent,
				feedback,
			};
		} catch (error) {
			console.error('[DecisionAccuracyTracker] Evaluation failed:', error);
			return null;
		}
	}

	static async getPendingEvaluations(daysAgo: number = 3): Promise<any[]> {
		try {
			const model = (prisma as any)?.decisionAccuracy;
			if (!model) return [];

			const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
			return await model.findMany({
				where: {
					decidedAt: { lte: cutoffDate },
					evaluatedAt: null,
				},
				orderBy: { decidedAt: 'asc' },
				take: 100,
			});
		} catch (error) {
			console.error('[DecisionAccuracyTracker] Failed to fetch pending evaluations:', error);
			return [];
		}
	}

	static async getAccuracyStats(
		origin: string,
		destination: string,
		decisionType?: string
	): Promise<{
		totalEvaluated: number;
		accurateCount: number;
		accuracyRate: number;
		avgAccuracyScore: number;
	}> {
		try {
			if (!origin || !destination) {
				return { totalEvaluated: 0, accurateCount: 0, accuracyRate: 0, avgAccuracyScore: 0 };
			}

			const model = (prisma as any)?.decisionAccuracy;
			if (!model) {
				return { totalEvaluated: 0, accurateCount: 0, accuracyRate: 0, avgAccuracyScore: 0 };
			}

			const where: any = {
				origin,
				destination,
				evaluatedAt: { not: null },
			};
			if (decisionType) where.decisionType = decisionType;

			const evals = await model.findMany({ where });
			if (evals.length === 0) {
				return { totalEvaluated: 0, accurateCount: 0, accuracyRate: 0, avgAccuracyScore: 0 };
			}

			const accurateCount = evals.filter((e: any) => e.isAccurate).length;
			const avgAccuracyScore =
				evals.reduce((sum: number, e: any) => sum + (e.accuracyScore || 0), 0) / evals.length;

			return {
				totalEvaluated: evals.length,
				accurateCount,
				accuracyRate: Number(((accurateCount / evals.length) * 100).toFixed(1)),
				avgAccuracyScore: Number(avgAccuracyScore.toFixed(1)),
			};
		} catch (error) {
			console.error('[DecisionAccuracyTracker] Stats query failed:', error);
			return { totalEvaluated: 0, accurateCount: 0, accuracyRate: 0, avgAccuracyScore: 0 };
		}
	}
}

export default DecisionAccuracyTracker;