/**
 * MONITORING TRANSPARENCY SMOKE TESTS
 *
 * Verifies the monitoring state model, stale-data rules, data source
 * resolution, and human-readable output for all significant states.
 *
 * Run: npx tsx scripts/monitoring_transparency_smoke.ts
 */

import {
    buildMonitoringContext,
    resolveDataSource,
    resolveMonitoringState,
    computeSnapshotAgeMinutes,
    formatSnapshotAge,
    formatNextCheck,
    type MonitoringDataSource,
    type TrackingStateInput,
} from '../lib/monitoringState';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
}

function section(name: string) {
    console.log(`\n[${name}]`);
}

function minutesAgo(n: number): Date {
    return new Date(Date.now() - n * 60 * 1000);
}

function minutesAhead(n: number): Date {
    return new Date(Date.now() + n * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Scenario 1: ACTIVE monitoring — recent snapshot, periodic source
// ---------------------------------------------------------------------------

section('SCENARIO 1 — ACTIVE: recent snapshot, periodic check');
{
    const lastChecked = minutesAgo(15);
    const trackingState: TrackingStateInput = {
        status: 'ACTIVE',
        waitingForNextSnapshot: true,
        limitedData: false,
        realTimeDataUnavailable: true,
    };
    const dataSource: MonitoringDataSource = 'PERIODIC_PROVIDER_CHECK';
    const ctx = buildMonitoringContext(lastChecked, trackingState, dataSource);

    assert('state is ACTIVE', ctx.state === 'ACTIVE');
    assert('not stale', !ctx.isStale);
    assert('suppressReassurance is false', !ctx.suppressReassurance);
    assert('humanReadableAge is minutes', ctx.humanReadableAge.includes('minute'));
    assert('stateLabel is "Monitoring active"', ctx.stateLabel === 'Monitoring active');
    assert('dataSourceLabel contains "Periodic"', ctx.dataSourceLabel.includes('Periodic'));
    assert('nextExpectedCheck is in the future', ctx.nextExpectedCheck !== null && ctx.nextExpectedCheck.getTime() > Date.now());
}

// ---------------------------------------------------------------------------
// Scenario 2: DELAYED — snapshot is 95 minutes old but under stale threshold
// ---------------------------------------------------------------------------

section('SCENARIO 2 — DELAYED: snapshot 95 minutes old');
{
    const lastChecked = minutesAgo(95);
    const trackingState: TrackingStateInput = {
        status: 'ACTIVE',
        waitingForNextSnapshot: true,
        limitedData: false,
    };
    const dataSource: MonitoringDataSource = 'PERIODIC_PROVIDER_CHECK';
    const ctx = buildMonitoringContext(lastChecked, trackingState, dataSource);

    assert('state is DELAYED', ctx.state === 'DELAYED');
    assert('not stale (under 120 min threshold)', !ctx.isStale);
    assert('suppressReassurance is true', ctx.suppressReassurance);
    assert('stateLabel is "Monitoring delayed"', ctx.stateLabel === 'Monitoring delayed');
    assert('humanReadableNext shows "Overdue"', ctx.humanReadableNext.includes('Overdue'));
}

// ---------------------------------------------------------------------------
// Scenario 3: STALE — snapshot is 130 minutes old
// ---------------------------------------------------------------------------

section('SCENARIO 3 — STALE: snapshot 130 minutes old');
{
    const lastChecked = minutesAgo(130);
    const trackingState: TrackingStateInput = {
        status: 'ACTIVE',
        limitedData: false,
    };
    const dataSource: MonitoringDataSource = 'PERIODIC_PROVIDER_CHECK';
    const ctx = buildMonitoringContext(lastChecked, trackingState, dataSource);

    assert('state is STALE', ctx.state === 'STALE');
    assert('isStale is true', ctx.isStale);
    assert('suppressReassurance is true', ctx.suppressReassurance);
    assert('stateLabel is "Snapshot outdated"', ctx.stateLabel === 'Snapshot outdated');
    assert('humanReadableAge shows hours', ctx.humanReadableAge.includes('h'));
}

// ---------------------------------------------------------------------------
// Scenario 4: ESTIMATED_ONLY — user-pasted itinerary, limited data
// ---------------------------------------------------------------------------

section('SCENARIO 4 — ESTIMATED_ONLY: user-pasted itinerary');
{
    const lastChecked = minutesAgo(20);
    const trackingState: TrackingStateInput = {
        status: 'ACTIVE',
        limitedData: true,
        realTimeDataUnavailable: true,
    };
    const dataSource = resolveDataSource('USER_PASTED_ITINERARY', true, true);
    const ctx = buildMonitoringContext(lastChecked, trackingState, dataSource);

    assert('dataSource is HISTORICAL_ESTIMATE', dataSource === 'HISTORICAL_ESTIMATE');
    assert('state is ESTIMATED_ONLY', ctx.state === 'ESTIMATED_ONLY');
    assert('suppressReassurance is true', ctx.suppressReassurance);
    assert('stateLabel is "Estimated data only"', ctx.stateLabel === 'Estimated data only');
    assert('dataSourceLabel contains "Historical"', ctx.dataSourceLabel.includes('Historical'));
}

// ---------------------------------------------------------------------------
// Scenario 5: ESTIMATED_ONLY — user-provided itinerary, no real-time
// ---------------------------------------------------------------------------

section('SCENARIO 5 — USER_PROVIDED_ITINERARY: no real-time, no limited flag');
{
    const lastChecked = minutesAgo(5);
    const trackingState: TrackingStateInput = {
        status: 'ACTIVE',
        waitingForNextSnapshot: true,
        limitedData: false,
        realTimeDataUnavailable: true,
    };
    const dataSource = resolveDataSource('USER_PASTED_ITINERARY', true, false);
    const ctx = buildMonitoringContext(lastChecked, trackingState, dataSource);

    assert('dataSource is USER_PROVIDED_ITINERARY', dataSource === 'USER_PROVIDED_ITINERARY');
    assert('state is ESTIMATED_ONLY', ctx.state === 'ESTIMATED_ONLY');
    assert('suppressReassurance is true', ctx.suppressReassurance);
}

// ---------------------------------------------------------------------------
// Scenario 6: ERROR — explicit error status
// ---------------------------------------------------------------------------

section('SCENARIO 6 — ERROR: explicit failure status');
{
    const lastChecked = minutesAgo(200);
    const trackingState: TrackingStateInput = {
        status: 'ERROR',
        limitedData: true,
    };
    const dataSource: MonitoringDataSource = 'PERIODIC_PROVIDER_CHECK';
    const ctx = buildMonitoringContext(lastChecked, trackingState, dataSource);

    assert('state is ERROR', ctx.state === 'ERROR');
    assert('suppressReassurance is true', ctx.suppressReassurance);
    assert('stateLabel is "Monitoring error"', ctx.stateLabel === 'Monitoring error');
}

// ---------------------------------------------------------------------------
// Scenario 7: LIMITED_DATA — active but limited coverage
// ---------------------------------------------------------------------------

section('SCENARIO 7 — LIMITED_DATA: monitoring active, data coverage limited');
{
    const lastChecked = minutesAgo(30);
    const trackingState: TrackingStateInput = {
        status: 'ACTIVE',
        waitingForNextSnapshot: false,
        limitedData: true,
        realTimeDataUnavailable: false,
    };
    const dataSource: MonitoringDataSource = 'PERIODIC_PROVIDER_CHECK';
    const ctx = buildMonitoringContext(lastChecked, trackingState, dataSource);

    assert('state is LIMITED_DATA', ctx.state === 'LIMITED_DATA');
    assert('not stale', !ctx.isStale);
    assert('suppressReassurance is false', !ctx.suppressReassurance);
    assert('stateLabel is "Limited coverage"', ctx.stateLabel === 'Limited coverage');
}

// ---------------------------------------------------------------------------
// Scenario 8: resolveDataSource — internal estimate (no dataSourceType from snapshot)
// ---------------------------------------------------------------------------

section('SCENARIO 8 — resolveDataSource: no snapshot data, no real-time');
{
    const dataSource = resolveDataSource(null, true, false);
    assert('resolves to PERIODIC_PROVIDER_CHECK', dataSource === 'PERIODIC_PROVIDER_CHECK');

    const dataSourceWithLimited = resolveDataSource(null, true, true);
    assert('with limitedData=true resolves to HISTORICAL_ESTIMATE', dataSourceWithLimited === 'HISTORICAL_ESTIMATE');

    const dataSourceLive = resolveDataSource(null, false, false);
    assert('with realTimeAvailable resolves to PERIODIC_PROVIDER_CHECK', dataSourceLive === 'PERIODIC_PROVIDER_CHECK');
}

// ---------------------------------------------------------------------------
// Scenario 9: snapshotAge formatting
// ---------------------------------------------------------------------------

section('SCENARIO 9 — Snapshot age formatting');
{
    assert('< 2 min → "just now"', formatSnapshotAge(1) === 'just now');
    assert('5 min → "5 minutes ago"', formatSnapshotAge(5) === '5 minutes ago');
    assert('60 min → "1 hour ago"', formatSnapshotAge(60) === '1 hour ago');
    assert('75 min → "1h 15m ago"', formatSnapshotAge(75) === '1h 15m ago');
    assert('null → "Unknown"', formatSnapshotAge(null) === 'Unknown');
    assert('0 min → "just now"', formatSnapshotAge(0) === 'just now');
}

// ---------------------------------------------------------------------------
// Scenario 10: nextCheck formatting
// ---------------------------------------------------------------------------

section('SCENARIO 10 — Next check formatting');
{
    const overdue = new Date(Date.now() - 10 * 60 * 1000);
    assert('past date → "Overdue"', formatNextCheck(overdue).includes('Overdue'));

    const soon = minutesAhead(5);
    assert('5 min ahead → "In 5 minutes"', formatNextCheck(soon).includes('5 minutes'));

    const inHour = minutesAhead(90);
    assert('90 min ahead → "about 1 hour"', formatNextCheck(inHour).includes('1 hour'));

    assert('null → "Next check time unknown"', formatNextCheck(null) === 'Next check time unknown');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(50)}`);
console.log(`Monitoring transparency smoke: ${failed === 0 ? 'PASS' : 'FAIL'}`);
console.log(`${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}
