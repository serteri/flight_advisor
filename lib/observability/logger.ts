export const isDebugLoggingEnabled = () => {
    return process.env.ENABLE_DEBUG_LOGS === 'true' || process.env.DEBUG === 'true';
};

export const safeLog = (namespace: string, message: string, ...args: any[]) => {
    try {
        if (!isDebugLoggingEnabled()) return;
        
        if (args.length > 0) {
            console.log(`[${namespace}] ${message}`, ...args);
        } else {
            console.log(`[${namespace}] ${message}`);
        }
    } catch (e) {
        // Must never disrupt the pipeline
    }
};

export const logPipelineMetrics = (total: number, valid: number, dropped: number, avgPrice: number | string) => {
    safeLog('PIPELINE', `total=${total} valid=${valid} dropped=${dropped} avgPrice=${avgPrice}`);
};

export const logProviderHealth = (provider: string, resultsCount: number, errorCount: number = 0) => {
    if (errorCount > 0) {
        safeLog('PROVIDER', `${provider}: ${resultsCount} results (${errorCount} errors) (warning)`);
    } else if (resultsCount === 0) {
        safeLog('PROVIDER', `${provider}: 0 results (warning)`);
    } else {
        safeLog('PROVIDER', `${provider}: ${resultsCount} results`);
    }
};

export const logScoreVisibility = (minScore: number | string, maxScore: number | string) => {
    safeLog('SCORE', `range: ${minScore} → ${maxScore}`);
};

export const logPerformanceTiming = (providerMs: number, scoringMs: number, totalMs: number) => {
    safeLog('PERF', `providers=${providerMs}ms scoring=${scoringMs}ms total=${totalMs}ms`);
};
