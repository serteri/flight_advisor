/**
 * @deprecated
 * Search provider fanout is no longer part of the core FlightAgent product.
 * Retained temporarily during the product pivot so legacy search surfaces can
 * be phased out without breaking scoring, guardian, notifications, or parsers.
 */
import { HybridSearchParams } from "@/types/hybridFlight";
import { normalizeSource } from '@/lib/utils';
import { searchDuffel } from './providers/duffel';
import { searchSabreProvider } from './providers/sabre';
import { searchFlightAPIProvider } from './providers/flightapi';
import { searchPricelineProvider } from './providers/priceline';
import { PricelineEndpointNotFoundError, PricelineRateLimitError } from '@/lib/providers/priceline';
import { toUnifiedFlights } from '@/lib/adapters/toUnifiedFlight';
import type { UnifiedFlight } from '@/types/unifiedFlight';
import { logProviderHealth, logPipelineMetrics, safeLog, logPerformanceTiming } from '@/lib/observability/logger';
import { validateUnifiedFlight } from '@/lib/intelligence/flightValidator';
import {
  recordUnifiedSuccess,
} from '@/lib/featureFlags';
// Kiwi excluded (requires auth). Travelpayouts removed from search — affiliate links only via lib/monetization/travelpayouts.ts.

// Phase 7: UnifiedFlight Canon
export type SearchProvidersMeta = {
  flights: UnifiedFlight[];
  warnings: string[];
  rateLimited: boolean;
  /** Pipeline mode is now strictly 'unified' */
  pipelineMode: 'unified';
  /** Optional telemetry payload for observability debugging */
  _debugObservability?: {
    totalFlightsFetched: number;
    droppedViaValidation: number;
    providerFetchTime: number;
    providerStats: Record<string, { count: number; error: boolean }>;
  };
};

type SearchProviderOptions = {
  skipPriceline?: boolean;
  injectedFlights?: UnifiedFlight[];
};

export async function searchAllProvidersWithMeta(
  params: HybridSearchParams,
  options: SearchProviderOptions = {}
): Promise<SearchProvidersMeta> {
  const base = await searchAllProvidersInternal(params, options);
  return base;
}

// Phase 7: Unified Canon
export async function searchAllProviders(params: HybridSearchParams): Promise<UnifiedFlight[]> {
  const { flights } = await searchAllProvidersInternal(params, {});
  return flights;
}

// ── RUNTIME STATUS ─────────────────────────────────────────────────────────────
//
// Active runtime path is UnifiedFlight-only.
// Search aggregation in this file feeds canonical scoring path directly.
// Legacy passthrough pipeline has been retired.

// ── MAIN SEARCH PIPELINE ──────────────────────────────────────────────────────

async function searchAllProvidersInternal(
  params: HybridSearchParams,
  options: SearchProviderOptions
): Promise<SearchProvidersMeta> {
  console.log(`\n🔎 Flight Search Started`);
  console.log(`  Route: ${params.origin} → ${params.destination}`);
  console.log(`  Date: ${params.date}`);

  const startTime = Date.now();
  const promises: Promise<any[]>[] = [];
  const providers: string[] = [];
  const warnings: string[] = [];
  let rateLimited = false;

  // Duffel - primary source
  if (process.env.DUFFEL_ACCESS_TOKEN) {
    console.log(`✅ Adding Duffel provider`);
    promises.push(searchDuffel(params));
    providers.push('Duffel');
  }

  // Sabre - secondary truth source
  if (process.env.SABRE_CLIENT_ID && process.env.SABRE_CLIENT_SECRET) {
    console.log(`✅ Adding Sabre provider`);
    promises.push(searchSabreProvider(params));
    providers.push('Sabre');
  }

  // FlightAPI - supplemental price/search source
  if (process.env.FLIGHTAPI_KEY) {
    console.log(`✅ Adding FlightAPI provider`);
    promises.push(searchFlightAPIProvider(params));
    providers.push('FlightAPI');
  }

  // PRICELINE - RapidAPI
  if (!options.skipPriceline && process.env.RAPID_API_KEY && process.env.RAPID_API_HOST_PRICELINE) {
    console.log(`✅ Adding PRICELINE provider`);
    promises.push(searchPricelineProvider(params));
    providers.push('Priceline');
  } else if (options.skipPriceline) {
    console.log(`⏭️ Skipping PRICELINE provider (DB cache hit)`);
  }

  console.log(`🚀 Starting ${promises.length} providers...\n`);

  try {
    const results = await Promise.allSettled(promises);
    const elapsed = Date.now() - startTime;

    let allFlights: any[] = [];
    let duffelCount = 0;
    let sabreCount = 0;
    let flightapiCount = 0;
    let pricelineCount = 0;
    const cachedCount = (options.injectedFlights || []).length;

    if ((options.injectedFlights || []).length > 0) {
      const cachedUnified = (options.injectedFlights || []).map((flight) => ({
        ...flight,
        departTime: flight.departureTime,
        arriveTime: flight.arrivalTime,
      }));
      allFlights.push(...cachedUnified);
    }

    const providerStats: Record<string, { count: number; error: boolean }> = {};

    results.forEach((result, idx) => {
      const providerName = providers[idx] || `Provider-${idx + 1}`;
      if (result.status === 'fulfilled') {
        const flights = result.value || [];
        allFlights = [...allFlights, ...flights];
        providerStats[providerName] = { count: flights.length, error: false };
        logProviderHealth(providerName, flights.length, 0);

        if (providerName === 'Duffel') {
          duffelCount = flights.length;
        } else if (providerName === 'Sabre') {
          sabreCount = flights.length;
        } else if (providerName === 'FlightAPI') {
          flightapiCount = flights.length;
        } else if (providerName === 'Priceline') {
          pricelineCount = flights.length;
        }
      } else {
        providerStats[providerName] = { count: 0, error: true };
        logProviderHealth(providerName, 0, 1);
        
        // Log detailed rejection information
        const errorMsg = result.reason?.message || String(result.reason);
        safeLog('PROVIDER', `❌ ${providerName} provider failed: ${errorMsg}`);

        if (result.reason instanceof PricelineRateLimitError || result.reason?.code === 'PRICELINE_RATE_LIMIT') {
          rateLimited = true;
          warnings.push('Hızlı Arama Limiti Doldu');
        } else if (result.reason instanceof PricelineEndpointNotFoundError || result.reason?.code === 'PRICELINE_ENDPOINT_NOT_FOUND') {
          warnings.push('Priceline endpoint yapılandırması geçersiz (404)');
        }
      }
    });

    const normalizeCode = (value: any) => {
      if (!value) return "";
      if (typeof value === "string") return value.toUpperCase();
      if (typeof value === "object") {
        return (
          value.iata || value.iataCode || value.iata_code || value.code || ""
        ).toUpperCase();
      }
      return "";
    };

    const targetOrigin = params.origin.toUpperCase();
    const targetDest = params.destination.toUpperCase();

    const filteredFlights = allFlights.filter((flight) => {
      const flightOrigin = normalizeCode(flight.from || (flight as any).origin);
      const flightDest = normalizeCode(flight.to || (flight as any).destination);
      const price = Number(flight.price);

      const originMatch = !flightOrigin || flightOrigin === targetOrigin;
      const destMatch = !flightDest || flightDest === targetDest;
      const validPrice = Number.isFinite(price) && price > 0;

      return originMatch && destMatch && validPrice;
    });

    const hasExplicitTimezone = (value: string): boolean => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim());
    const withDurationDebug = filteredFlights.map((flight) => {
      if ((flight as any).durationDebug) return flight;

      const dep = String(flight.departTime || '');
      const arr = String(flight.arriveTime || '');
      const depMs = dep && hasExplicitTimezone(dep) ? new Date(dep).getTime() : NaN;
      const arrMs = arr && hasExplicitTimezone(arr) ? new Date(arr).getTime() : NaN;
      const timestampDuration = Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs
        ? Math.round((arrMs - depMs) / 60000)
        : 0;

      return {
        ...flight,
        durationDebug: {
          providerDuration: Number(flight.duration) || 0,
          timestampDuration,
          resolvedDuration: Number(flight.duration) || timestampDuration || 0,
          provider: normalizeSource(flight.source),
          fallback: true,
        },
      };
    });

    console.log(`\n📊 Total: ${allFlights.length} flights (${elapsed}ms)`);
    console.log(`   Duffel: ${duffelCount} | Sabre: ${sabreCount} | FlightAPI: ${flightapiCount} | PRICELINE: ${pricelineCount} | DB Cache: ${cachedCount}`);
    console.log(`   Filtered: ${filteredFlights.length} (origin/destination match)\n`);
    
    // Sort by price
    const sortedFlights = withDurationDebug.sort((a, b) => a.price - b.price);

    // ── PIPELINE ROUTING ──────────────────────────────────────────────────
    const convStart = Date.now();
    let outputFlights: UnifiedFlight[] = [];
    let initialUnifiedCount = 0;
    
    try {
      const convertedFlights = toUnifiedFlights(sortedFlights as any[]);
      initialUnifiedCount = convertedFlights.length;
      
      // Step: Run runtime validation layer
      outputFlights = convertedFlights.filter(flight => validateUnifiedFlight(flight));
      
      const convMs = Date.now() - convStart;
      const invalidCount = initialUnifiedCount - outputFlights.length;
      const legacyLossCount = sortedFlights.length - initialUnifiedCount;
      
      const avgPrice = outputFlights.reduce((sum, f) => sum + (Number(f.price) || 0), 0) / (outputFlights.length || 1);
      
      logPipelineMetrics(
          initialUnifiedCount, 
          outputFlights.length, 
          invalidCount + legacyLossCount, 
          Math.round(avgPrice)
      );
      
      safeLog('TIMING', `Conversion completed in ${convMs}ms`);

      recordUnifiedSuccess();
    } catch (err) {
      safeLog('UNIFIED', `❌ [UNIFIED] conversion failed: ${err}`);
    }

    return {
      flights: outputFlights,
      warnings: Array.from(new Set(warnings)),
      rateLimited,
      pipelineMode: 'unified',
      _debugObservability: {
        totalFlightsFetched: allFlights.length,
        droppedViaValidation: initialUnifiedCount - outputFlights.length,
        providerFetchTime: elapsed,
        providerStats,
      }
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Search failed (${elapsed}ms):`, error);
    return {
      flights: [],
      warnings: ['Arama sağlayıcı hatası oluştu'],
      rateLimited,
      pipelineMode: 'unified',
    };
  }
}
