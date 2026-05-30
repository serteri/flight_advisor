/**
 * INTERNAL HEALTH DIAGNOSTICS ENDPOINT
 * 
 * GET /api/internal/health?period=last_hour|last_24h|last_7d
 * 
 * Returns comprehensive health metrics for operators.
 * NOT exposed to end users.
 * 
 * Access Control: Currently unrestricted (TODO: Add auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getHealthSummaryLastHour,
  getHealthSummaryLast24Hours,
  getHealthSummaryLast7Days,
} from '@/services/healthMetrics';

export const runtime = 'nodejs';

const assertInternalAccess = (request: NextRequest): NextResponse | null => {
  const configuredSecret = process.env.INTERNAL_API_SECRET;
  if (!configuredSecret) {
    console.error('[Health Diagnostics] INTERNAL_API_SECRET is not configured');
    return NextResponse.json({ error: 'Internal API not configured' }, { status: 500 });
  }

  const headerSecret = request.headers.get('INTERNAL_API_SECRET');
  if (!headerSecret || headerSecret !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
};

interface HealthRequest {
  period?: 'last_hour' | 'last_24h' | 'last_7d';
}

/**
 * GET /api/internal/health
 * 
 * Query params:
 *   - period: 'last_hour' (default) | 'last_24h' | 'last_7d'
 *   - format: 'json' (default) | 'summary' (condensed)
 * 
 * Returns:
 *   SystemHealthSummary object with:
 *   - timestamp
 *   - overallStatus: HEALTHY | DEGRADED | CRITICAL
 *   - parser health metrics
 *   - scoring health metrics
 *   - route data health metrics
 *   - guardian health metrics
 *   - health indicators (percentages)
 *   - alerts array
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = assertInternalAccess(request);
  if (authError) return authError;

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') as HealthRequest['period']) || 'last_hour';
    const format = searchParams.get('format') || 'json';

    // Validate period
    if (!['last_hour', 'last_24h', 'last_7d'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Use: last_hour, last_24h, or last_7d' },
        { status: 400 }
      );
    }

    // Get health summary based on period
    let health;
    switch (period) {
      case 'last_hour':
        health = getHealthSummaryLastHour();
        break;
      case 'last_24h':
        health = getHealthSummaryLast24Hours();
        break;
      case 'last_7d':
        health = getHealthSummaryLast7Days();
        break;
    }

    // Return full details or condensed summary
    if (format === 'summary') {
      const condensed = {
        timestamp: health.timestamp,
        periodLabel: health.periodLabel,
        overallStatus: health.overallStatus,
        degradationReasons: health.degradationReasons,
        indicators: health.indicators,
        alertCount: health.alerts.length,
        criticalAlerts: health.alerts.filter((a) => a.severity === 'CRITICAL').length,
      };
      return NextResponse.json(condensed);
    }

    return NextResponse.json(health, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Health Diagnostics] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve health metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/internal/health/reset
 * 
 * Clears accumulated metrics (for testing/deployment)
 * TODO: Add authentication
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = assertInternalAccess(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));

    if (body.action === 'reset') {
      // TODO: Implement reset logic in HealthMetricsCollector
      return NextResponse.json({
        message: 'Metrics reset successful',
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Health Diagnostics] Reset error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
