import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import VariantResolver from '@/lib/experiment/variantResolver';
import { normalizeBuyNowVariant } from '@/lib/experiment/buyNowVariant';

const parseOptionalNumber = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const parseOptionalInt = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};

const parseOptionalDate = (value: unknown): Date | null => {
    const text = String(value || '').trim();
    if (!text) return null;
    const parsed = text.includes('T') ? new Date(text) : new Date(`${text}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const buildDecisionContextAction = (action: string, decisionRecommendation: unknown): string | null => {
    const normalizedAction = String(action || '').toUpperCase().trim();
    const normalizedDecision = String(decisionRecommendation || '').toUpperCase().trim();
    if (!normalizedAction || !normalizedDecision) return null;
    if (!['BUY_NOW', 'WAIT', 'AVOID'].includes(normalizedDecision)) return null;
    return `${normalizedAction}_${normalizedDecision}`;
};

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const session = await auth();
        const email = session?.user?.email?.toLowerCase();
        const user = email
            ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
            : null;

        // 🧪 GET VARIANT CONTEXT FOR A/B TESTING
        const variantContext = await VariantResolver.resolveVariantContext(user?.id);
        const variantPayload = VariantResolver.buildVariantPayload(variantContext);

        const action = String(payload?.action || '').toUpperCase();
        const localBuyNowVariant = normalizeBuyNowVariant(payload?.buyNowVariant);
        const resolvedVariantId = localBuyNowVariant || variantPayload.variantId || null;
        const allowedActions = new Set([
            'BOOK',
            'DETAIL',
            'IGNORE',
            'DECISION_SHOWN',
            'DECISION_CLICKED',
            'BOOK_CLICKED',
            'TRACK_CLICKED',
            'IGNORE_MULTI_STOP',
            'IGNORE_NIGHT',
        ]);
        if (!allowedActions.has(action)) {
            return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
        }

        const departureRaw = String(payload?.departTime || payload?.departureTime || '').trim();
        const departureDate = parseOptionalDate(payload?.departureDate);
        const departureHour = Number.isFinite(Number(payload?.departureHour))
            ? Math.max(0, Math.min(23, Number(payload.departureHour)))
            : departureRaw
                ? new Date(departureRaw).getUTCHours()
                : null;
        const isDirect = Boolean(payload?.isDirect);
        const stopCount = Number.isFinite(Number(payload?.stopCount)) ? Number(payload.stopCount) : null;
        const isNight = Boolean(
            payload?.isNight ||
            (Number.isFinite(Number(departureHour)) && (Number(departureHour) >= 18 || Number(departureHour) < 6))
        );
        const decisionContextAction = buildDecisionContextAction(action, payload?.decisionRecommendation);
        const legacyAction =
            action === 'BOOK_CLICKED'
                ? 'BOOK'
                : action === 'DECISION_CLICKED' || action === 'TRACK_CLICKED'
                    ? 'DETAIL'
                    : null;

        const createEventData = (eventAction: string) => ({
            action: eventAction,
            flightId: payload?.flightId ? String(payload.flightId) : null,
            flightNumber: payload?.flightNumber ? String(payload.flightNumber) : null,
            provider: payload?.provider ? String(payload.provider).toUpperCase() : null,
            origin: payload?.origin ? String(payload.origin).toUpperCase() : null,
            destination: payload?.destination ? String(payload.destination).toUpperCase() : null,
            departureDate,
            selectedPrice: parseOptionalNumber(payload?.selectedPrice),
            selectedScore: parseOptionalNumber(payload?.selectedScore),
            competitorPrice: parseOptionalNumber(payload?.competitorPrice ?? payload?.routeAveragePrice),
            competitorScore: parseOptionalNumber(payload?.competitorScore),
            rank: parseOptionalInt(payload?.rank),
            totalResults: parseOptionalInt(payload?.totalResults),
            currency: payload?.currency ? String(payload.currency).toUpperCase() : null,
            // 🧪 A/B TESTING
            experimentId: variantPayload.experimentId || null,
            variantId: resolvedVariantId,
            // 🎯 DECISION CONFIDENCE
            decisionConfidence: parseOptionalInt(payload?.decisionConfidence),
        });

        const createPreferenceData = (eventAction: string) => ({
            userId: user?.id || null,
            action: eventAction,
            airline: payload?.airline ? String(payload.airline) : null,
            origin: payload?.origin ? String(payload.origin).toUpperCase() : null,
            destination: payload?.destination ? String(payload.destination).toUpperCase() : null,
            departureDate,
            flightId: payload?.flightId ? String(payload.flightId) : null,
            provider: payload?.provider ? String(payload.provider).toUpperCase() : null,
            selectedPrice: parseOptionalNumber(payload?.selectedPrice),
            selectedScore: parseOptionalNumber(payload?.selectedScore),
            competitorPrice: parseOptionalNumber(payload?.competitorPrice ?? payload?.routeAveragePrice),
            competitorScore: parseOptionalNumber(payload?.competitorScore),
            isDirect,
            isNight,
            departureHour: Number.isFinite(Number(departureHour)) ? Number(departureHour) : null,
        });

        const model = (prisma as any)?.flightSelectionEvent;
        if (model) {
            await model.create({ data: createEventData(action) });

            if (legacyAction) {
                await model.create({ data: createEventData(legacyAction) });
            }

            if (decisionContextAction) {
                await model.create({ data: createEventData(decisionContextAction) });
            }

            if (action === 'IGNORE' && Number.isFinite(stopCount) && Number(stopCount) >= 2) {
                await model.create({
                    data: createEventData('IGNORE_MULTI_STOP'),
                });
            }

            if (action === 'IGNORE' && isNight) {
                await model.create({
                    data: createEventData('IGNORE_NIGHT'),
                });
            }
        }

        const preferenceModel = (prisma as any)?.userPreference;
        if (preferenceModel) {
            await preferenceModel.create({ data: createPreferenceData(action) });

            if (legacyAction) {
                await preferenceModel.create({ data: createPreferenceData(legacyAction) });
            }

            if (decisionContextAction) {
                await preferenceModel.create({ data: createPreferenceData(decisionContextAction) });
            }

            if (action === 'IGNORE' && Number.isFinite(stopCount) && Number(stopCount) >= 2) {
                await preferenceModel.create({
                    data: createPreferenceData('IGNORE_MULTI_STOP'),
                });
            }

            if (action === 'IGNORE' && isNight) {
                await preferenceModel.create({
                    data: createPreferenceData('IGNORE_NIGHT'),
                });
            }
        }

        const searchAnalyticsModel = (prisma as any)?.searchAnalytics;
        if (searchAnalyticsModel && departureDate && payload?.origin && payload?.destination) {
            const selectedPrice = parseOptionalNumber(payload?.selectedPrice);
            const routeAveragePrice = parseOptionalNumber(payload?.routeAveragePrice);
            const baselinePrice = selectedPrice || routeAveragePrice || 0;

            if (baselinePrice > 0) {
                try {
                    await searchAnalyticsModel.create({
                        data: {
                            origin: String(payload.origin).toUpperCase(),
                            destination: String(payload.destination).toUpperCase(),
                            departureDate,
                            minPrice: baselinePrice,
                            avgPrice: baselinePrice,
                            foundMinPrice: baselinePrice,
                            foundAvgPrice: baselinePrice,
                            provider: payload?.provider ? String(payload.provider).toUpperCase() : 'SELECTION_EVENT',
                            searchTimestamp: new Date(),
                            selectionAction: action,
                            selectionVariant: resolvedVariantId,
                            decisionRecommendation: payload?.decisionRecommendation ? String(payload.decisionRecommendation).toUpperCase() : null,
                            decisionConfidence: parseOptionalInt(payload?.decisionConfidence),
                            selectedPrice,
                        },
                    });
                } catch (analyticsError) {
                    console.warn('[SELECTION_TRACK] searchAnalytics create failed:', analyticsError);
                }
            }
        }

        return NextResponse.json({ ok: true, legacyLogged: Boolean(model), preferenceLogged: Boolean(preferenceModel) });
    } catch (error) {
        console.warn('[SELECTION_TRACK] persist failed:', error);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
