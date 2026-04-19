/**
 * Feature Flags — Environment-based runtime switches.
 *
 * Each flag reads from process.env at call time (not module load time)
 * so that Next.js hot-reload and runtime env changes take effect immediately.
 *
 * ROLLBACK: Set USE_UNIFIED_PIPELINE=false to revert to legacy pipeline.
 */

/**
 * Controls which search pipeline processes flights.
 *
 * DEFAULT: true — UnifiedFlight pipeline is the primary execution path.
 *
 * Flow (unified, default):
 *   Provider output → toUnifiedFlights() → UnifiedFlight[]
 *   Scoring via applyAdvancedFlightScoring()
 *
 * Flow (legacy, fallback):
 *   Disabled (unified is primary runtime path)
 *
 * The final API response shape remains FlightResult-compatible regardless.
 *
 * ROLLBACK:  USE_UNIFIED_PIPELINE=false  in .env → instant revert to legacy
 * DISABLE:   USE_UNIFIED_PIPELINE=0      in .env → same effect
 */
export function useUnifiedPipeline(): boolean {
    const raw = process.env.USE_UNIFIED_PIPELINE;
    // Default: true (unified pipeline is PRIMARY)
    // Only return false when explicitly set to "false" or "0"
    if (raw === undefined || raw === '') return true;
    return raw !== '0' && raw.toLowerCase() !== 'false';
}

/**
 * When true, the API response includes a `_debug` field with
 * UnifiedFlight shadow data for internal verification.
 *
 * Default: false
 * Enable:  UNIFIED_DEBUG=true  in .env
 */
export function useUnifiedDebug(): boolean {
    const raw = process.env.UNIFIED_DEBUG;
    if (!raw) return false;
    return raw !== '0' && raw.toLowerCase() !== 'false';
}

// ── Fallback Metrics (In-Memory, Non-Persistent) ─────────────────────────────
// Tracks unified vs legacy pipeline usage for observability.
// Resets on process restart — this is intentional (no persistent state dependency).

const _metrics = {
    totalRequests: 0,
    unifiedSuccess: 0,
    legacyFallback: 0,
    legacyExplicit: 0,
    lastFallbackReason: '' as string,
    lastFallbackAt: 0 as number,
};

/** Record a unified pipeline success */
export function recordUnifiedSuccess(): void {
    _metrics.totalRequests++;
    _metrics.unifiedSuccess++;
}

/** Record a legacy fallback (automatic, due to unified failure) */
export function recordLegacyFallback(reason: string): void {
    _metrics.totalRequests++;
    _metrics.legacyFallback++;
    _metrics.lastFallbackReason = reason;
    _metrics.lastFallbackAt = Date.now();
}

/** Record an explicit legacy mode request (USE_UNIFIED_PIPELINE=false) */
export function recordLegacyExplicit(): void {
    _metrics.totalRequests++;
    _metrics.legacyExplicit++;
}

/** Current fallback rate as percentage (0–100). Returns 0 if no requests yet. */
export function getFallbackRate(): number {
    if (_metrics.totalRequests === 0) return 0;
    return Math.round((_metrics.legacyFallback / _metrics.totalRequests) * 10000) / 100;
}

/** Get current pipeline metrics snapshot (non-blocking, read-only) */
export function getPipelineMetrics() {
    return { ..._metrics, fallbackRate: getFallbackRate() };
}

/** Fallback rate warning threshold (percent). Log warning if exceeded. */
const FALLBACK_RATE_THRESHOLD = 5;

/**
 * Check if fallback rate exceeds threshold. Logs warning if so.
 * Called after each request — non-blocking, no side effects beyond logging.
 */
export function checkFallbackThreshold(): void {
    const rate = getFallbackRate();
    if (_metrics.totalRequests >= 10 && rate > FALLBACK_RATE_THRESHOLD) {
        console.warn(
            `⚠️ [UNIFIED WARNING] fallback rate exceeded threshold: ${rate}% > ${FALLBACK_RATE_THRESHOLD}% ` +
            `(${_metrics.legacyFallback}/${_metrics.totalRequests} requests, last reason: ${_metrics.lastFallbackReason})`
        );
    }
}
