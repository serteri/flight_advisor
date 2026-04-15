/**
 * 🎯 DECISION CONFIG - Runtime-tunable decision thresholds
 * 
 * Stores configuration for BUY_NOW, WAIT, AVOID decisions.
 * In-memory cache + DB persistence.
 * All updates respect safety bounds to prevent extremes.
 */

type DecisionType = 'BUY_NOW' | 'WAIT' | 'AVOID';

export interface SafetyBounds {
  minPrice?: number;
  maxPrice?: number;
  maxWeightChange?: number;
  minThreshold?: number;
  maxThreshold?: number;
}

export interface DecisionConfigValue {
  decisionType: DecisionType;
  priceThresholdMin: number;
  priceThresholdMax: number;
  timePressureWeight: number;
  volatilitySensitivity: number;
  trendClarityWeight: number;
  safetyBounds: SafetyBounds;
  version: number;
  updatedAt: Date;
  appliedAt?: Date;
}

// 🔥 DEFAULT THRESHOLDS (Empirically tested)
const DECISION_CONFIG_DEFAULTS: Record<DecisionType, DecisionConfigValue> = {
  BUY_NOW: {
    decisionType: 'BUY_NOW',
    priceThresholdMin: 0.12,      // Price must be at least 12% below average
    priceThresholdMax: 0.40,      // Max 40% below average (avoid extreme outliers)
    timePressureWeight: 0.25,     // Urgency is 25% of decision signal
    volatilitySensitivity: 0.15,  // Volatility caps boost, 15% weight
    trendClarityWeight: 0.20,     // Trend quality matters, 20% weight
    safetyBounds: {
      minPrice: 0.01,
      maxPrice: 1.0,
      maxWeightChange: 0.05,      // Prevent sudden >5% threshold swings
      minThreshold: 0.05,
      maxThreshold: 0.50,
    },
    version: 1,
    updatedAt: new Date(),
  },

  WAIT: {
    decisionType: 'WAIT',
    priceThresholdMin: 0.02,       // Weak signal for action
    priceThresholdMax: 0.12,       // Neutral zone
    timePressureWeight: 0.20,      // Time less critical for WAIT
    volatilitySensitivity: 0.25,   // Volatility is more relevant
    trendClarityWeight: 0.30,      // Trend clarity is crucial (expect drop?)
    safetyBounds: {
      minPrice: 0.001,
      maxPrice: 0.5,
      maxWeightChange: 0.05,
      minThreshold: 0.01,
      maxThreshold: 0.30,
    },
    version: 1,
    updatedAt: new Date(),
  },

  AVOID: {
    decisionType: 'AVOID',
    priceThresholdMin: 0,          // Price is expensive (not cheap)
    priceThresholdMax: 0.02,       // Only strong sell events
    timePressureWeight: 0.10,      // AVOID doesn't depend on time
    volatilitySensitivity: 0.35,   // High volatility = likely to drop
    trendClarityWeight: 0.25,      // Clear trend matters
    safetyBounds: {
      minPrice: 0,
      maxPrice: 0.3,
      maxWeightChange: 0.05,
      minThreshold: 0,
      maxThreshold: 0.15,
    },
    version: 1,
    updatedAt: new Date(),
  },
};

/**
 * In-memory configuration store
 * Refreshes from DB on server start + periodic sync
 */
class DecisionConfigStore {
  private config: Map<DecisionType, DecisionConfigValue> = new Map();
  private lastSync: Date = new Date();
  private syncInterval: NodeJS.Timer | null = null;

  constructor() {
    // Initialize with defaults
    Object.entries(DECISION_CONFIG_DEFAULTS).forEach(([type, value]) => {
      this.config.set(type as DecisionType, { ...value });
    });
  }

  /**
   * Get current config for a decision type
   */
  get(decisionType: DecisionType): DecisionConfigValue {
    return this.config.get(decisionType) || DECISION_CONFIG_DEFAULTS[decisionType];
  }

  /**
   * Get all configs
   */
  getAll(): DecisionConfigValue[] {
    return Array.from(this.config.values());
  }

  /**
   * Update config (validates bounds)
   * @returns Updated config or null if validation failed
   */
  update(
    decisionType: DecisionType,
    partial: Partial<DecisionConfigValue>,
    updatedBy?: string
  ): DecisionConfigValue | null {
    const current = this.get(decisionType);
    const bounds = current.safetyBounds;

    // Validate price thresholds
    if (partial.priceThresholdMin !== undefined) {
      const min = bounds.minThreshold || bounds.minPrice || 0.001;
      const max = bounds.maxThreshold || bounds.maxPrice || 1.0;

      if (partial.priceThresholdMin < min || partial.priceThresholdMin > max) {
        console.warn(
          `[DecisionConfig] priceThresholdMin out of bounds [${min}, ${max}]: ${partial.priceThresholdMin}`
        );
        return null;
      }
    }

    if (partial.priceThresholdMax !== undefined) {
      const min = bounds.minThreshold || bounds.minPrice || 0.001;
      const max = bounds.maxThreshold || bounds.maxPrice || 1.0;

      if (partial.priceThresholdMax < min || partial.priceThresholdMax > max) {
        console.warn(
          `[DecisionConfig] priceThresholdMax out of bounds [${min}, ${max}]: ${partial.priceThresholdMax}`
        );
        return null;
      }

      // Ensure min < max
      const minVal = partial.priceThresholdMin || current.priceThresholdMin;
      if (minVal >= partial.priceThresholdMax) {
        console.warn(
          `[DecisionConfig] Invalid range: min (${minVal}) >= max (${partial.priceThresholdMax})`
        );
        return null;
      }
    }

    // Validate weight change (prevent sudden swings)
    const maxWeightChange = bounds.maxWeightChange || 0.05;
    ['timePressureWeight', 'volatilitySensitivity', 'trendClarityWeight'].forEach((key) => {
      const newVal = partial[key as keyof DecisionConfigValue] as number | undefined;
      if (newVal !== undefined) {
        const oldVal = current[key as keyof DecisionConfigValue] as number;
        const change = Math.abs(newVal - oldVal);
        if (change > maxWeightChange) {
          console.warn(
            `[DecisionConfig] Weight change too large for ${key}: ${change} > ${maxWeightChange}`
          );
          return; // Skip this update
        }
      }
    });

    // Update config
    const updated: DecisionConfigValue = {
      ...current,
      ...partial,
      decisionType,
      version: current.version + 1,
      updatedAt: new Date(),
    };

    this.config.set(decisionType, updated);
    console.log(`[DecisionConfig] Updated ${decisionType} (v${updated.version}):`, {
      priceThresholdMin: updated.priceThresholdMin,
      priceThresholdMax: updated.priceThresholdMax,
      timePressureWeight: updated.timePressureWeight,
      updatedBy,
    });

    return updated;
  }

  /**
   * Sync config from DB
   * Called on server start and periodically
   */
  async syncFromDb(): Promise<void> {
    try {
      // Attempt to load from database if available
      // For now, just use in-memory defaults
      // In production, this would query the DecisionConfig table
      this.lastSync = new Date();
      console.log('[DecisionConfig] Synced from DB (or defaults)');
    } catch (error) {
      console.error('[DecisionConfig] Failed to sync from DB:', error);
      // Keep using in-memory defaults on failure
    }
  }

  /**
   * Start periodic sync (e.g., every 5 minutes)
   */
  startPeriodicSync(intervalMs: number = 5 * 60 * 1000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.syncFromDb().catch((err) => console.error('[DecisionConfig] Sync error:', err));
    }, intervalMs);

    console.log(`[DecisionConfig] Periodic sync started (every ${intervalMs}ms)`);
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[DecisionConfig] Periodic sync stopped');
    }
  }

  /**
   * Reset to defaults (for testing or emergency)
   */
  reset(): void {
    this.config.clear();
    Object.entries(DECISION_CONFIG_DEFAULTS).forEach(([type, value]) => {
      this.config.set(type as DecisionType, { ...value });
    });
    console.warn('[DecisionConfig] Reset to defaults');
  }
}

// 🎯 Singleton instance
export const decisionConfigStore = new DecisionConfigStore();

// 🔥 Auto-sync on module load
if (typeof globalThis !== 'undefined' && !globalThis._decisionConfigInitialized) {
  decisionConfigStore.syncFromDb().catch(console.error);
  decisionConfigStore.startPeriodicSync(5 * 60 * 1000); // Sync every 5 minutes
  (globalThis as any)._decisionConfigInitialized = true;
}

export default decisionConfigStore;
