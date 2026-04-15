/**
 * 🎭 VARIANT RESOLVER
 * 
 * Retrieves variant info and applies variant-specific config
 * For use in UI components and API handlers
 */

import ExperimentManager, { ExperimentVariant } from './experimentManager';

export interface VariantInfo {
  experimentId: string;
  variantId: string;
  variantName?: string;
  config?: Record<string, any>;
}

export interface VariantContext {
  activeExperiments: Array<{
    experimentId: string;
    experimentType: string;
    variantId: string;
    variantName?: string;
    config?: Record<string, any>;
  }>;
}

class VariantResolver {
  /**
   * Resolve all active variants for a user/session
   * Returns context object for use in components
   */
  static async resolveVariantContext(
    userId?: string,
    sessionId?: string
  ): Promise<VariantContext> {
    if (!userId && !sessionId) {
      return { activeExperiments: [] };
    }

    try {
      // Get all active experiments
      const activeExperiments = await ExperimentManager.getActiveExperiments();

      const context: VariantContext = {
        activeExperiments: [],
      };

      // For each active experiment, get user's variant
      for (const exp of activeExperiments) {
        if (!exp.id) continue;

        const variantId = await ExperimentManager.getUserVariant(userId, sessionId, exp.id);

        if (!variantId) {
          // Assign user if not already assigned
          const result = await ExperimentManager.assignUserToVariant(userId, sessionId, exp.id);
          if (!result.success) continue;

          const newVariantId = result.variantId;
          const variant = (exp.variants || []).find((v) => v.id === newVariantId);

          context.activeExperiments.push({
            experimentId: exp.id,
            experimentType: exp.experimentType,
            variantId: newVariantId || '',
            variantName: variant?.name,
            config: variant?.config,
          });
        } else {
          // Already assigned, retrieve variant info
          const variant = (exp.variants || []).find((v) => v.id === variantId);

          context.activeExperiments.push({
            experimentId: exp.id,
            experimentType: exp.experimentType,
            variantId,
            variantName: variant?.name,
            config: variant?.config,
          });
        }
      }

      return context;
    } catch (error) {
      console.error('[VariantResolver] Resolution failed:', error);
      return { activeExperiments: [] };
    }
  }

  /**
   * Get variant config for specific experiment type
   */
  static async getVariantConfig(
    experimentType: string,
    userId?: string,
    sessionId?: string
  ): Promise<Record<string, any> | null> {
    const context = await this.resolveVariantContext(userId, sessionId);
    const experiment = context.activeExperiments.find((e) => e.experimentType === experimentType);
    return experiment?.config || null;
  }

  /**
   * Check if variant is A or B (helper)
   */
  static getVariantLetterFromId(variantId: string): 'A' | 'B' | string {
    if (variantId.toLowerCase().includes('control') || variantId.toLowerCase().includes('a')) {
      return 'A';
    }
    if (variantId.toLowerCase().includes('treatment') || variantId.toLowerCase().includes('b')) {
      return 'B';
    }
    return variantId.substring(0, 1).toUpperCase();
  }

  /**
   * Build event payload with variant info
   */
  static buildVariantPayload(
    context: VariantContext
  ): {
    experimentId?: string;
    variantId?: string;
    experimentType?: string;
  } {
    if (context.activeExperiments.length === 0) {
      return {};
    }

    // Return first experiment's variant info
    const exp = context.activeExperiments[0];
    return {
      experimentId: exp.experimentId,
      variantId: exp.variantId,
      experimentType: exp.experimentType,
    };
  }
}

export default VariantResolver;
