import type { ScoredFlight, UnifiedFlight } from '@/types/unifiedFlight';

type Recommendation = 'BUY_NOW' | 'WAIT' | 'AVOID';

type ParseAuditChecks = {
    routeContinuity: boolean;
    timeChronology: boolean;
    durationRealism: boolean;
    segmentCompleteness: boolean;
    baggageCompleteness: boolean;
};

export type ParseAudit = {
    passed: boolean;
    warnings: string[];
    hardErrors: string[];
    completenessScore: number;
    checks: ParseAuditChecks;
};

export type ScoreAudit = {
    passed: boolean;
    adjustments: string[];
    confidencePenalty: number;
    recommendationOverride?: Recommendation;
};

export type OutputHonestyAudit = {
    passed: boolean;
    warnings: string[];
    violations: string[];
};

export type SelfCheckDebug = {
    parseAudit: ParseAudit;
    scoreAudit: ScoreAudit;
    honestyAudit: OutputHonestyAudit;
};

export type SelfCheckResult = {
    flight: ScoredFlight;
    userWarnings: string[];
    debug: SelfCheckDebug;
};

type SegmentLike = {
    from?: string;
    to?: string;
    departureTime?: string;
    arrivalTime?: string;
    carrier?: string;
    flightNumber?: string;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const safeDate = (value?: string): number | null => {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
};

const uniq = (values: string[]): string[] => values.filter((value, index) => values.indexOf(value) === index);

const hasUnknownBaggage = (flight: UnifiedFlight): boolean => {
    const baggage = flight.baggage;
    if (!baggage) return true;
    if (baggage.included && !baggage.checked?.kg && !baggage.checked?.pieces) return true;
    if (!baggage.included && !baggage.checked?.label && !baggage.cabin?.label) return true;
    return false;
};

export const buildParseAudit = (flight: UnifiedFlight): ParseAudit => {
    const warnings: string[] = [];
    const hardErrors: string[] = [];
    const segments = Array.isArray(flight.segments) ? (flight.segments as SegmentLike[]) : [];

    let routeContinuity = true;
    let timeChronology = true;
    let durationRealism = true;
    let segmentCompleteness = true;
    let baggageCompleteness = true;

    if (segments.length === 0) {
        segmentCompleteness = false;
        hardErrors.push('No itinerary segments available for validation.');
    }

    let completeSegments = 0;
    for (let index = 0; index < segments.length; index += 1) {
        const current = segments[index];
        const complete = Boolean(
            current.from
            && current.to
            && current.departureTime
            && current.arrivalTime
            && current.carrier
            && current.flightNumber,
        );

        if (complete) completeSegments += 1;
        else {
            segmentCompleteness = false;
            warnings.push(`Segment ${index + 1} metadata is incomplete.`);
        }

        const depMs = safeDate(current.departureTime);
        const arrMs = safeDate(current.arrivalTime);
        if (depMs === null || arrMs === null || arrMs <= depMs) {
            timeChronology = false;
            hardErrors.push(`Segment ${index + 1} has invalid time chronology.`);
        }

        if (index < segments.length - 1) {
            const next = segments[index + 1];
            if ((current.to || '').toUpperCase() !== (next.from || '').toUpperCase()) {
                routeContinuity = false;
                hardErrors.push(`Route continuity broken between segment ${index + 1} and ${index + 2}.`);
            }

            const nextDepMs = safeDate(next.departureTime);
            if (arrMs !== null && nextDepMs !== null && nextDepMs < arrMs) {
                timeChronology = false;
                hardErrors.push(`Connection chronology issue between segment ${index + 1} and ${index + 2}.`);
            }
        }
    }

    const firstDep = safeDate(segments[0]?.departureTime);
    const lastArr = safeDate(segments[segments.length - 1]?.arrivalTime);
    const timedDuration = firstDep !== null && lastArr !== null ? Math.round((lastArr - firstDep) / 60000) : null;
    const reportedDuration = Number(flight.duration || 0);

    if (timedDuration === null || timedDuration <= 0) {
        durationRealism = false;
        hardErrors.push('Itinerary total duration cannot be verified from segment times.');
    } else {
        if (timedDuration < 30) {
            durationRealism = false;
            hardErrors.push('Total duration appears unrealistically short.');
        }
        if (timedDuration > 48 * 60) {
            warnings.push('Total duration is very high and should be reviewed.');
        }
        if (reportedDuration > 0) {
            const diff = Math.abs(reportedDuration - timedDuration);
            if (diff > 300) {
                durationRealism = false;
                hardErrors.push('Reported duration strongly conflicts with segment chronology.');
            } else if (diff > 120) {
                warnings.push('Reported duration does not closely match segment-derived duration.');
            }
        }
    }

    if (hasUnknownBaggage(flight)) {
        baggageCompleteness = false;
        warnings.push('Baggage details incomplete');
    }

    const routeScore = routeContinuity ? 20 : 0;
    const chronologyScore = timeChronology ? 20 : 0;
    const durationScore = durationRealism ? 20 : 0;
    const segmentScore = segments.length > 0 ? Math.round((completeSegments / segments.length) * 20) : 0;
    const baggageScore = baggageCompleteness ? 20 : 8;
    const completenessScore = clamp(routeScore + chronologyScore + durationScore + segmentScore + baggageScore, 0, 100);

    return {
        passed: hardErrors.length === 0,
        warnings: uniq(warnings),
        hardErrors: uniq(hardErrors),
        completenessScore,
        checks: {
            routeContinuity,
            timeChronology,
            durationRealism,
            segmentCompleteness,
            baggageCompleteness,
        },
    };
};

const mapRecommendationToBuyWait = (recommendation: Recommendation): 'BUY' | 'WAIT' | 'MONITOR' => {
    if (recommendation === 'BUY_NOW') return 'BUY';
    if (recommendation === 'AVOID') return 'MONITOR';
    return 'WAIT';
};

export const buildScoreAudit = (
    flight: ScoredFlight,
    parseAudit: ParseAudit,
): ScoreAudit => {
    const adjustments: string[] = [];
    let confidencePenalty = 0;
    let recommendationOverride: Recommendation | undefined;

    const score = flight.score;
    const confidence = Number(score?.confidence || 0);
    const completeness = parseAudit.completenessScore;

    if (confidence > completeness + 20) {
        const penalty = clamp(Math.round((confidence - completeness) * 0.5), 6, 25);
        confidencePenalty += penalty;
        adjustments.push('Confidence reduced to match itinerary completeness.');
    }

    const recommendation = score?.decisionRecommendation;
    if (recommendation === 'BUY_NOW' && (!parseAudit.passed || completeness < 70)) {
        recommendationOverride = 'WAIT';
        adjustments.push('BUY recommendation softened due to incomplete itinerary data.');
    }

    const riskFlagsLower = (score?.riskFlags || []).map((item) => item.toLowerCase());
    const comfortLower = (score?.comfortNotes || []).map((item) => item.toLowerCase());

    const hasDurationContradiction =
        comfortLower.some((item) => item.includes('short travel'))
        && riskFlagsLower.some((item) => item.includes('long total travel time'));
    if (hasDurationContradiction) {
        confidencePenalty += 6;
        adjustments.push('Confidence reduced due to contradictory duration signals.');
    }

    const baggageUnknown = hasUnknownBaggage(flight);
    const baggageScore = Number(score?.breakdown?.baggageScore || 0);
    if (baggageUnknown && baggageScore >= 8) {
        confidencePenalty += 10;
        adjustments.push('Baggage impact softened because baggage details are unknown.');
    }

    const hasDataError = riskFlagsLower.some((item) => item.includes('data error') || item.includes('unrealistic'));
    if (hasDataError && recommendation === 'BUY_NOW') {
        recommendationOverride = 'WAIT';
        confidencePenalty += 8;
        adjustments.push('Recommendation downgraded due to realism flags.');
    }

    return {
        passed: adjustments.length === 0,
        adjustments,
        confidencePenalty: clamp(confidencePenalty, 0, 40),
        recommendationOverride,
    };
};

const removeFakePrecision = (text?: string): string | undefined => {
    if (!text) return text;
    return text.replace(/(\d+)\.(\d+)%/g, (_full, intPart, decPart) => {
        const normalized = Math.round(Number(`${intPart}.${decPart}`));
        return `${normalized}%`;
    });
};

export const applyScoreAudit = (
    flight: ScoredFlight,
    scoreAudit: ScoreAudit,
): ScoredFlight => {
    if (scoreAudit.confidencePenalty <= 0 && !scoreAudit.recommendationOverride) {
        return flight;
    }

    const nextConfidence = clamp(Number((flight.score.confidence || 50) - scoreAudit.confidencePenalty), 20, 99);
    const nextDecisionConfidence = clamp(Number((flight.score.decisionConfidence || nextConfidence) - scoreAudit.confidencePenalty), 20, 99);
    const nextRecommendation = scoreAudit.recommendationOverride || flight.score.decisionRecommendation;

    const nextRiskFlags = uniq([
        ...(flight.score.riskFlags || []),
        scoreAudit.confidencePenalty > 0
            ? 'Self-check reduced confidence due to incomplete or contradictory inputs.'
            : '',
    ].filter(Boolean));

    return {
        ...flight,
        score: {
            ...flight.score,
            confidence: nextConfidence,
            decisionConfidence: nextDecisionConfidence,
            decisionRecommendation: nextRecommendation,
            decisionReason: nextRecommendation !== flight.score.decisionRecommendation
                ? `Self-check override: ${nextRecommendation === 'WAIT' ? 'wait for clearer data quality' : 'recommendation updated for realism safeguards'}.`
                : flight.score.decisionReason,
            buyWaitSignal: flight.score.buyWaitSignal
                ? {
                    ...flight.score.buyWaitSignal,
                    action: nextRecommendation ? mapRecommendationToBuyWait(nextRecommendation) : flight.score.buyWaitSignal.action,
                }
                : flight.score.buyWaitSignal,
            riskFlags: nextRiskFlags,
        },
    };
};

export const buildOutputHonestyAudit = (flight: ScoredFlight): OutputHonestyAudit => {
    const warnings: string[] = [];
    const violations: string[] = [];

    const source = String(flight.source || '').toLowerCase();
    const explanation = String(flight.score.explanation || '').toLowerCase();
    const reason = String(flight.score.decisionReason || '').toLowerCase();
    const signalLabel = String(flight.score.buyWaitSignal?.label || '').toLowerCase();

    const fakeLivePattern = /\blive data|real-time|real time\b/i;
    if (fakeLivePattern.test(explanation) || fakeLivePattern.test(reason) || fakeLivePattern.test(signalLabel)) {
        warnings.push('Estimated timing signal only');
        violations.push('Detected potentially misleading live-data wording.');
    }

    const baggageUnknown = hasUnknownBaggage(flight);
    const comfortNotes = flight.score.comfortNotes || [];
    if (baggageUnknown && comfortNotes.some((note) => /checked baggage included|20kg\+ checked/i.test(note))) {
        warnings.push('Baggage details incomplete');
        violations.push('Detected baggage certainty language without complete baggage data.');
    }

    const hasFakePrecision = /(\d+)\.(\d+)%/.test(flight.score.explanation || '') || /(\d+)\.(\d+)%/.test(flight.score.decisionReason || '');
    if (hasFakePrecision) {
        violations.push('Detected overly precise percentage wording in user-facing text.');
    }

    if (source === 'manual' && /route average|historical median/i.test(`${flight.score.explanation || ''} ${flight.score.decisionReason || ''}`)) {
        warnings.push('Estimated timing signal only');
        violations.push('Manual source output referenced market precision beyond available source context.');
    }

    return {
        passed: violations.length === 0,
        warnings: uniq(warnings),
        violations,
    };
};

export const applyHonestyAudit = (flight: ScoredFlight): ScoredFlight => {
    const comfortNotes = (flight.score.comfortNotes || []).filter((note) => {
        if (!hasUnknownBaggage(flight)) return true;
        return !/checked baggage included|20kg\+ checked/i.test(note);
    });

    const explanation = removeFakePrecision(flight.score.explanation);
    const decisionReason = removeFakePrecision(flight.score.decisionReason);

    return {
        ...flight,
        score: {
            ...flight.score,
            explanation,
            decisionReason,
            comfortNotes,
        },
    };
};

const toUserWarnings = (parseAudit: ParseAudit, honestyAudit: OutputHonestyAudit): string[] => {
    const userWarnings: string[] = [];

    if (!parseAudit.checks.segmentCompleteness) {
        userWarnings.push('Partial itinerary detected');
    }
    if (!parseAudit.checks.baggageCompleteness) {
        userWarnings.push('Baggage details incomplete');
    }
    if (!parseAudit.checks.durationRealism || !parseAudit.checks.timeChronology) {
        userWarnings.push('Estimated timing signal only');
    }

    userWarnings.push(...honestyAudit.warnings);

    return uniq(userWarnings).slice(0, 3);
};

export const runSelfCheckLayer = (
    flight: ScoredFlight,
    parseAuditOverride?: ParseAudit,
): SelfCheckResult => {
    const parseAudit = parseAuditOverride || buildParseAudit(flight);
    const scoreAudit = buildScoreAudit(flight, parseAudit);
    const scoredFlight = applyScoreAudit(flight, scoreAudit);
    const honestFlight = applyHonestyAudit(scoredFlight);
    const honestyAudit = buildOutputHonestyAudit(honestFlight);

    return {
        flight: honestFlight,
        userWarnings: toUserWarnings(parseAudit, honestyAudit),
        debug: {
            parseAudit,
            scoreAudit,
            honestyAudit,
        },
    };
};