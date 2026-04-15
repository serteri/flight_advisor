/**
 * 🧪 EXPERIMENT MANAGER
 * 
 * Handles:
 * - Creating experiments and variants
 * - Assigning users to variants
 * - Querying active experiments
 */

import { prisma } from '@/lib/prisma';

export interface ExperimentVariant {
  id: string;
  name: string;
  config?: Record<string, any>;
}

export interface ExperimentDefinition {
  id?: string;
  name: string;
  description?: string;
  experimentType: 'MESSAGE' | 'CTA' | 'PAYWALL_TIMING' | 'RANKING_WEIGHT';
  status?: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  variants: ExperimentVariant[];
  targetMetric?: 'BOOKING_RATE' | 'CLICK_RATE' | 'TRACK_RATE';
  minSampleSize?: number;
  startDate?: Date;
  endDate?: Date;
}

class ExperimentManager {
  /**
   * Create a new experiment
   */
  static async createExperiment(
    definition: ExperimentDefinition
  ): Promise<{
    success: boolean;
    experimentId?: string;
    error?: string;
  }> {
    try {
      const model = (prisma as any)?.experiment;
      if (!model) {
        return { success: false, error: 'Experiment model unavailable' };
      }

      const created = await model.create({
        data: {
          name: definition.name,
          description: definition.description,
          experimentType: definition.experimentType,
          status: definition.status || 'DRAFT',
          variants: definition.variants as any,
          targetMetric: definition.targetMetric,
          minSampleSize: definition.minSampleSize || 100,
          startDate: definition.startDate,
          endDate: definition.endDate,
        },
      });

      console.log(`[ExperimentManager] Created experiment: ${created.id} (${definition.name})`);

      return { success: true, experimentId: created.id };
    } catch (error) {
      console.error('[ExperimentManager] Create failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get active experiments
   */
  static async getActiveExperiments(): Promise<ExperimentDefinition[]> {
    try {
      const model = (prisma as any)?.experiment;
      if (!model) return [];

      const experiments = await model.findMany({
        where: {
          status: 'RUNNING',
          OR: [
            { startDate: null },
            { startDate: { lte: new Date() } },
          ],
          AND: [
            {
              OR: [
                { endDate: null },
                { endDate: { gte: new Date() } },
              ],
            },
          ],
        },
        orderBy: { startDate: 'desc' },
      });

      return experiments.map((exp: any) => ({
        id: exp.id,
        name: exp.name,
        description: exp.description,
        experimentType: exp.experimentType,
        status: exp.status,
        variants: exp.variants || [],
        targetMetric: exp.targetMetric,
        minSampleSize: exp.minSampleSize,
        startDate: exp.startDate,
        endDate: exp.endDate,
      }));
    } catch (error) {
      console.error('[ExperimentManager] Failed to fetch active experiments:', error);
      return [];
    }
  }

  /**
   * Assign user to variant
   * If user already assigned to experiment, return existing assignment
   */
  static async assignUserToVariant(
    userId: string | undefined,
    sessionId: string | undefined,
    experimentId: string
  ): Promise<{
    success: boolean;
    variantId?: string;
    error?: string;
  }> {
    if (!userId && !sessionId) {
      return { success: false, error: 'userId or sessionId required' };
    }

    try {
      const model = (prisma as any)?.experimentAssignment;
      if (!model) {
        return { success: false, error: 'ExperimentAssignment model unavailable' };
      }

      // Check if already assigned
      const existing = await model.findFirst({
        where: {
          experimentId,
          OR: userId ? [{ userId }] : [{ sessionId }],
        },
      });

      if (existing) {
        return { success: true, variantId: existing.variantId };
      }

      // Get experiment details
      const expModel = (prisma as any)?.experiment;
      const experiment = await expModel?.findUnique({ where: { id: experimentId } });

      if (!experiment || !experiment.variants?.length) {
        return { success: false, error: 'Experiment not found or has no variants' };
      }

      // Random variant assignment (can add weights later)
      const variants = experiment.variants as ExperimentVariant[];
      const variantId = variants[Math.floor(Math.random() * variants.length)].id;

      // Create assignment
      const assignment = await model.create({
        data: {
          userId: userId || undefined,
          sessionId: sessionId || undefined,
          experimentId,
          variantId,
        },
      });

      console.log(
        `[ExperimentManager] Assigned ${userId || sessionId} to variant ${variantId} in experiment ${experimentId}`
      );

      return { success: true, variantId };
    } catch (error) {
      console.error('[ExperimentManager] Assignment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user's variant for an experiment
   */
  static async getUserVariant(
    userId: string | undefined,
    sessionId: string | undefined,
    experimentId: string
  ): Promise<string | null> {
    if (!userId && !sessionId) return null;

    try {
      const model = (prisma as any)?.experimentAssignment;
      if (!model) return null;

      const assignment = await model.findFirst({
        where: {
          experimentId,
          OR: userId ? [{ userId }] : [{ sessionId }],
        },
      });

      return assignment?.variantId || null;
    } catch (error) {
      console.error('[ExperimentManager] Get variant failed:', error);
      return null;
    }
  }

  /**
   * Get variants for an experiment
   */
  static async getExperimentVariants(
    experimentId: string
  ): Promise<ExperimentVariant[]> {
    try {
      const model = (prisma as any)?.experiment;
      if (!model) return [];

      const experiment = await model.findUnique({
        where: { id: experimentId },
      });

      return (experiment?.variants as ExperimentVariant[]) || [];
    } catch (error) {
      console.error('[ExperimentManager] Failed to fetch variants:', error);
      return [];
    }
  }

  /**
   * Update experiment status
   */
  static async updateExperimentStatus(
    experimentId: string,
    status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED'
  ): Promise<boolean> {
    try {
      const model = (prisma as any)?.experiment;
      if (!model) return false;

      await model.update({
        where: { id: experimentId },
        data: { status },
      });

      console.log(`[ExperimentManager] Updated experiment ${experimentId} status to ${status}`);
      return true;
    } catch (error) {
      console.error('[ExperimentManager] Status update failed:', error);
      return false;
    }
  }
}

export default ExperimentManager;
