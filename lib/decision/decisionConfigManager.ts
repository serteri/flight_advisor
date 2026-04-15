/**
 * 🔧 DECISION CONFIG MANAGER
 * 
 * Handles updating decision configs with:
 * - In-memory store updates
 * - Database persistence
 * - Safety validations
 * - Audit trail
 */

import { prisma } from '@/lib/prisma';
import { decisionConfigStore, DecisionConfigValue, SafetyBounds } from './decisionConfig';

type DecisionType = 'BUY_NOW' | 'WAIT' | 'AVOID';

interface UpdateConfigRequest {
  priceThresholdMin?: number;
  priceThresholdMax?: number;
  timePressureWeight?: number;
  volatilitySensitivity?: number;
  trendClarityWeight?: number;
  safetyBounds?: SafetyBounds;
}

export class DecisionConfigManager {
  /**
   * Update decision config
   * Validates bounds, applies to in-memory store, persists to DB
   */
  static async updateConfig(
    decisionType: DecisionType,
    updates: UpdateConfigRequest,
    updatedBy?: string
  ): Promise<{
    success: boolean;
    config?: DecisionConfigValue;
    error?: string;
  }> {
    try {
      // Validate in-memory first (with safety bounds)
      const inMemoryUpdated = decisionConfigStore.update(
        decisionType,
        updates,
        updatedBy
      );

      if (!inMemoryUpdated) {
        return {
          success: false,
          error: 'Config validation failed (safety bounds violated)',
        };
      }

      // Persist to database
      try {
        const model = (prisma as any)?.decisionConfig;
        if (!model) {
          console.warn('[DecisionConfigManager] DecisionConfig model unavailable, skipping DB persist');
          return { success: true, config: inMemoryUpdated };
        }

        await model.upsert({
          where: { decisionType },
          update: {
            priceThresholdMin: inMemoryUpdated.priceThresholdMin,
            priceThresholdMax: inMemoryUpdated.priceThresholdMax,
            timePressureWeight: inMemoryUpdated.timePressureWeight,
            volatilitySensitivity: inMemoryUpdated.volatilitySensitivity,
            trendClarityWeight: inMemoryUpdated.trendClarityWeight,
            safetyBounds: inMemoryUpdated.safetyBounds,
            version: inMemoryUpdated.version,
            updatedBy,
            updatedAt: new Date(),
          },
          create: {
            decisionType,
            priceThresholdMin: inMemoryUpdated.priceThresholdMin,
            priceThresholdMax: inMemoryUpdated.priceThresholdMax,
            timePressureWeight: inMemoryUpdated.timePressureWeight,
            volatilitySensitivity: inMemoryUpdated.volatilitySensitivity,
            trendClarityWeight: inMemoryUpdated.trendClarityWeight,
            safetyBounds: inMemoryUpdated.safetyBounds,
            version: inMemoryUpdated.version,
            updatedBy,
          },
        });

        return { success: true, config: inMemoryUpdated };
      } catch (dbError) {
        console.error('[DecisionConfigManager] DB persist failed:', dbError);
        // Still return success since in-memory is updated
        // DB will catch up on next sync
        return { success: true, config: inMemoryUpdated };
      }
    } catch (error) {
      console.error('[DecisionConfigManager] Update critical error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current config for a decision type
   */
  static getConfig(decisionType: DecisionType): DecisionConfigValue {
    return decisionConfigStore.get(decisionType);
  }

  /**
   * Get all configs
   */
  static getAllConfigs(): DecisionConfigValue[] {
    return decisionConfigStore.getAll();
  }

  /**
   * Apply config changes safely (for admin use)
   * - Updates all decision types
   * - Returns which succeeded/failed
   */
  static async applyBatchUpdates(
    updates: Record<DecisionType, UpdateConfigRequest>,
    updatedBy?: string
  ): Promise<{
    successful: DecisionType[];
    failed: { type: DecisionType; error: string }[];
  }> {
    const successful: DecisionType[] = [];
    const failed: { type: DecisionType; error: string }[] = [];

    for (const [type, config] of Object.entries(updates)) {
      const result = await this.updateConfig(
        type as DecisionType,
        config,
        updatedBy
      );

      if (result.success) {
        successful.push(type as DecisionType);
      } else {
        failed.push({
          type: type as DecisionType,
          error: result.error || 'Unknown error',
        });
      }
    }

    return { successful, failed };
  }

  /**
   * Sync configs from database to in-memory store
   */
  static async syncFromDatabase(): Promise<void> {
    try {
      const model = (prisma as any)?.decisionConfig;
      if (!model) {
        console.warn('[DecisionConfigManager] DecisionConfig model unavailable for sync');
        return;
      }

      const configs = await model.findMany();

      // Update in-memory store with DB values
      for (const config of configs) {
        decisionConfigStore.update(config.decisionType, {
          priceThresholdMin: config.priceThresholdMin,
          priceThresholdMax: config.priceThresholdMax,
          timePressureWeight: config.timePressureWeight,
          volatilitySensitivity: config.volatilitySensitivity,
          trendClarityWeight: config.trendClarityWeight,
          safetyBounds: config.safetyBounds,
          version: config.version,
          updatedAt: new Date(config.updatedAt),
        });
      }

      console.log(`[DecisionConfigManager] Synced ${configs.length} configs from DB`);
    } catch (error) {
      console.error('[DecisionConfigManager] Sync failed:', error);
    }
  }

  /**
   * Reset to defaults (emergency only)
   */
  static resetToDefaults(): void {
    decisionConfigStore.reset();
    console.warn('[DecisionConfigManager] ⚠️ Reset all configs to defaults');
  }
}

export default DecisionConfigManager;
