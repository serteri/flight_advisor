import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import DecisionAccuracyTracker from '@/lib/decision/decisionAccuracyTracker';

type DecisionKey = 'BUY_NOW' | 'WAIT' | 'AVOID';

const DECISIONS: DecisionKey[] = ['BUY_NOW', 'WAIT', 'AVOID'];

const toRate = (numerator: number, denominator: number): number => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
    return Number(((numerator / denominator) * 100).toFixed(1));
};

export async function GET(request: Request) {
    const model = (prisma as any)?.flightSelectionEvent;
    if (!model) {
        return NextResponse.json({ error: 'flightSelectionEvent model unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.max(1, Math.min(90, Number(searchParams.get('days') || 30)));
    const variant = searchParams.get('variant');
    const route = searchParams.get('route');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    try {
        // 🎯 MAIN FUNNEL ANALYTICS
        const whereClause: any = {
            createdAt: { gte: since },
            action: {
                in: [
                    'DECISION_SHOWN_BUY_NOW',
                    'DECISION_CLICKED_BUY_NOW',
                    'BOOK_CLICKED_BUY_NOW',
                    'DECISION_SHOWN_WAIT',
                    'TRACK_CLICKED_WAIT',
                    'DECISION_CLICKED_WAIT',
                    'DECISION_SHOWN_AVOID',
                    'IGNORE_AVOID',
                    'DECISION_CLICKED_AVOID',
                ],
            },
        };

        if (variant) {
            whereClause.variantId = variant;
        }

        if (route) {
            const [origin, destination] = route.split('-');
            if (origin && destination) {
                whereClause.origin = origin.toUpperCase();
                whereClause.destination = destination.toUpperCase();
            }
        }

        const rows = await model.findMany({
            where: whereClause,
            select: {
                action: true,
                origin: true,
                destination: true,
                variantId: true,
                decisionConfidence: true,
            },
        });

        const counts = new Map<string, number>();
        const routeCounts = new Map<string, Map<string, number>>();
        const variantCounts = new Map<string, Map<string, number>>();
        const confidenceByDecision = new Map<string, number[]>();

        rows.forEach((row: any) => {
            const action = String(row.action || '').toUpperCase();
            counts.set(action, (counts.get(action) || 0) + 1);

            const routeKey = `${row.origin}-${row.destination}`;
            if (!routeCounts.has(routeKey)) {
                routeCounts.set(routeKey, new Map());
            }
            const routeMap = routeCounts.get(routeKey)!;
            routeMap.set(action, (routeMap.get(action) || 0) + 1);

            if (row.variantId) {
                if (!variantCounts.has(row.variantId)) {
                    variantCounts.set(row.variantId, new Map());
                }
                const variantMap = variantCounts.get(row.variantId)!;
                variantMap.set(action, (variantMap.get(action) || 0) + 1);
            }

            if (action.includes('BUY_NOW')) {
                if (!confidenceByDecision.has('BUY_NOW')) {
                    confidenceByDecision.set('BUY_NOW', []);
                }
                if (row.decisionConfidence) {
                    confidenceByDecision.get('BUY_NOW')!.push(row.decisionConfidence);
                }
            } else if (action.includes('WAIT')) {
                if (!confidenceByDecision.has('WAIT')) {
                    confidenceByDecision.set('WAIT', []);
                }
                if (row.decisionConfidence) {
                    confidenceByDecision.get('WAIT')!.push(row.decisionConfidence);
                }
            } else if (action.includes('AVOID')) {
                if (!confidenceByDecision.has('AVOID')) {
                    confidenceByDecision.set('AVOID', []);
                }
                if (row.decisionConfidence) {
                    confidenceByDecision.get('AVOID')!.push(row.decisionConfidence);
                }
            }
        });

        // Build decision summary
        const summary = DECISIONS.map((decision) => {
            const shown = counts.get(`DECISION_SHOWN_${decision}`) || 0;
            const decisionClicked = counts.get(`DECISION_CLICKED_${decision}`) || 0;
            const bookClicked = counts.get(`BOOK_CLICKED_${decision}`) || 0;
            const trackClicked = counts.get(`TRACK_CLICKED_${decision}`) || 0;
            const ignore = counts.get(`IGNORE_${decision}`) || 0;

            const confidences = confidenceByDecision.get(decision) || [];
            const avgConfidence =
                confidences.length > 0
                    ? Number((confidences.reduce((a, b) => a + b, 0) / confidences.length).toFixed(1))
                    : 0;

            return {
                decision,
                shown,
                decisionClickRate: toRate(decisionClicked, shown),
                buyNowClickRate: decision === 'BUY_NOW' ? toRate(bookClicked, shown) : 0,
                waitTrackRate: decision === 'WAIT' ? toRate(trackClicked, shown) : 0,
                avoidIgnoreRate: decision === 'AVOID' ? toRate(ignore, shown) : 0,
                avgConfidence,
                bookClicked,
                trackClicked,
                ignore,
            };
        });

        // 🧪 VARIANT-BASED METRICS
        const variantMetrics = variant
            ? null
            : Array.from(variantCounts.entries()).map(([variantId, variantActions]) => {
                const variantShown =
                    variantActions.get('DECISION_SHOWN_BUY_NOW') ||
                    variantActions.get('DECISION_SHOWN_WAIT') ||
                    variantActions.get('DECISION_SHOWN_AVOID') ||
                    0;
                const variantBookClicked = variantActions.get('BOOK_CLICKED_BUY_NOW') || 0;

                return {
                    variantId,
                    shown: variantShown,
                    conversionRate: toRate(variantBookClicked, variantShown),
                    actionCounts: Object.fromEntries(variantActions),
                };
            });

        // 📍 ROUTE-LEVEL PERFORMANCE
        const routeMetrics = Array.from(routeCounts.entries())
            .map(([routeKey, routeActions]) => {
                const routeShown =
                    routeActions.get('DECISION_SHOWN_BUY_NOW') ||
                    routeActions.get('DECISION_SHOWN_WAIT') ||
                    routeActions.get('DECISION_SHOWN_AVOID') ||
                    0;
                const routeConversion = routeActions.get('BOOK_CLICKED_BUY_NOW') || 0;
                const routeTrack = routeActions.get('TRACK_CLICKED_WAIT') || 0;

                return {
                    route: routeKey,
                    shown: routeShown,
                    conversionRate: toRate(routeConversion, routeShown),
                    trackRate: toRate(routeTrack, routeShown),
                    actionCounts: Object.fromEntries(routeActions),
                };
            })
            .sort((a, b) => b.shown - a.shown)
            .slice(0, 20);

        // 📊 DECISION ACCURACY FEEDBACK
        const accuracyStats = await Promise.all(
            DECISIONS.map(async (decision) => {
                const routeOrigin = route ? route.split('-')[0] : '';
                const routeDest = route ? route.split('-')[1] : '';
                const stats = await DecisionAccuracyTracker.getAccuracyStats(
                    routeOrigin,
                    routeDest,
                    decision
                );
                return {
                    decision,
                    ...stats,
                };
            })
        );

        // 🎯 AUTO-TUNING SUGGESTIONS
        const buyNow = summary.find((item) => item.decision === 'BUY_NOW');
        const wait = summary.find((item) => item.decision === 'WAIT');
        const avoid = summary.find((item) => item.decision === 'AVOID');

        const suggestions = {
            rankingWeight:
                buyNow && buyNow.buyNowClickRate >= 12
                    ? 'keep_buy_now_priority_high'
                    : 'reduce_buy_now_priority_if_false_positives_continue',
            decisionThresholds:
                wait && wait.waitTrackRate >= 10
                    ? 'wait_threshold_is_working'
                    : 'consider_tightening_wait_thresholds',
            confidenceCalibration:
                avoid && avoid.avoidIgnoreRate >= 20
                    ? 'avoid_confidence_is_directionally_correct'
                    : 'lower_avoid_confidence_until_ignore_rate_improves',
            accuracyFeedback: accuracyStats
                .map((stat) => `${stat.decision}: ${stat.accuracyRate}% accuracy (${stat.totalEvaluated} evals)`)
                .join(' | '),
        };

        return NextResponse.json({
            windowDays: days,
            summary,
            variantMetrics,
            routeMetrics,
            accuracyStats,
            suggestions,
        });
    } catch (error) {
        console.error('[DECISION_ANALYTICS] failed:', error);
        return NextResponse.json({ error: 'analytics lookup failed' }, { status: 500 });
    }
}
