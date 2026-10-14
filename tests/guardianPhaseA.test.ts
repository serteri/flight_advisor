import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    alertsSentCount,
    checkKindLabelKey,
    earliestNextCheck,
    flightState,
    guardianStatus,
    lastCheckSummary,
    legacyAlertNeedsAction,
    monitoringDelayState,
    monitoringPlanKeys,
    nextScheduledCheck,
    scheduleState,
    tripHasChanges,
    usesNeutralRightsCopy,
    eventPriority,
    STANDARD_PLAN_KEYS,
} from '../lib/guardian/tripPresentation';
import { formatCheckTime } from '../lib/guardian/checkTimeFormat';
import { splitTrips } from '../lib/guardian/tripBuckets';
import { airportSchedule } from '../lib/guardian/flightScheduleDisplay';
import { planCheckpoints, resolveTripSchedule } from '../lib/guardian/checkpoints';

const read = (p: string) => readFileSync(p, 'utf8');
const card = read('components/TravelGuardianDashboard.tsx');
const detail = read('app/[locale]/dashboard/guardian/[id]/TripDetailsClient.tsx');
const listPage = read('app/[locale]/dashboard/guardian/page.tsx');
const settings = read('app/[locale]/dashboard/settings/page.tsx');
const en = JSON.parse(read('messages/en.json'));
const tr = JSON.parse(read('messages/tr.json'));
const de = JSON.parse(read('messages/de.json'));

const activeUi = [card, detail, listPage, settings, read('components/dashboard/DashboardClient.tsx')].join('\n');
const activeMessages = (m: Record<string, unknown>) => JSON.stringify({
    v2: m.GuardianV2, dash: m.GuardianDashboard, details: m.GuardianTripDetails, settings: m.Settings,
});

const verified = { status: 'ACTIVE', lastCheckedAt: '2026-10-15T05:00:00Z', snapshot: { status: 'ON_TIME', delayMinutes: 0, dataQuality: 'HIGH' } };
const unchecked = { status: 'ACTIVE', lastCheckedAt: null, snapshot: { status: 'scheduled', delayMinutes: 0, dataQuality: 'UNKNOWN' } };

test('legacy "Every 6 hours" is gone from active Guardian UI and its messages', () => {
    assert.doesNotMatch(activeUi, /every6Hours|Every 6 hours/i);
    for (const m of [en, tr, de]) assert.doesNotMatch(activeMessages(m), /every ?6 ?hours|6 saatte|6 Stunden/i);
});

test('"Est. Value Found" / Estimated Protection Value are gone', () => {
    assert.doesNotMatch(activeUi, /valueFound|Est\. Value|Estimated Protection|estimateEu261Value/i);
    for (const m of [en, tr, de]) assert.doesNotMatch(activeMessages(m), /Est\. Value|Estimated Protection|valueFound/i);
});

test('settings: no price-drop or weekly price-summary control; no fake switches', () => {
    assert.doesNotMatch(settings, /priceDrop|weeklySummary|Switch|price drop|price summary/i);
    for (const m of [en, tr, de]) assert.doesNotMatch(JSON.stringify(m.Settings), /price drop|price summary|tracked routes|Preisabfall|fiyat/i);
    assert.match(settings, /settingsNotifications/);
});

test('dashboard KPI row uses Guardian metrics', () => {
    for (const key of ['kpi.activeTrips', 'kpi.tripsWithChanges', 'kpi.nextCheck', 'kpi.alertsSent']) assert.match(listPage, new RegExp(key.replace('.', '\\.')));
    assert.doesNotMatch(listPage, /activeAlerts|checkInterval|alerts\.length/);
});

test('trip card puts the flight first and uses plain-language labels', () => {
    const flightIdx = card.indexOf('flightNumber ?? trip.routeLabel');
    const watchingIdx = card.indexOf("watching.title");
    assert.ok(flightIdx > 0 && flightIdx < watchingIdx);
    assert.doesNotMatch(activeUi, /Disruption Hunter|Schedule Guardian|Upgrade Sniper/);
    for (const m of [en, tr, de]) assert.doesNotMatch(JSON.stringify(m.GuardianV2), /Disruption Hunter|Schedule Guardian/);
});

test('before the first check: first check scheduled, Not checked yet, no "On time", no "No changes"', () => {
    assert.deepEqual(lastCheckSummary(unchecked), { kind: 'NEVER' });
    assert.equal(guardianStatus(unchecked), 'WAITING_FIRST_CHECK');
    assert.equal(flightState(unchecked), 'NOT_VERIFIED');
    assert.notEqual(flightState(unchecked), 'ON_TIME');
    assert.equal(scheduleState(unchecked, false), 'WAITING');
    assert.equal(en.GuardianV2.check.notChecked, 'Not checked yet');
    assert.equal(en.GuardianV2.schedule.WAITING, 'Monitoring scheduled');
    assert.equal(en.GuardianV2.flightStatus.NOT_VERIFIED, 'Not verified yet');
    assert.match(card, /check\.first/);
});

test('a provider failure sets lastCheckedAt but is not a verified On time', () => {
    const failed = { status: 'ACTIVE', lastCheckedAt: '2026-10-15T05:00:00Z', snapshot: { status: 'scheduled', delayMinutes: 0, dataQuality: 'UNKNOWN' } };
    assert.equal(flightState(failed), 'NOT_VERIFIED');
    assert.equal(lastCheckSummary(failed).kind, 'ATTEMPTED');
    assert.equal(scheduleState(failed, false), 'WAITING');
});

test('after a verified check the states become real', () => {
    assert.equal(flightState(verified), 'ON_TIME');
    assert.equal(scheduleState(verified, false), 'NO_CHANGE');
    assert.equal(scheduleState(verified, true), 'CHANGED');
    assert.equal(flightState({ ...verified, snapshot: { status: 'DELAYED', delayMinutes: 45, dataQuality: 'HIGH' } }), 'DELAYED');
    assert.equal(flightState({ ...verified, snapshot: { status: 'CANCELLED', delayMinutes: 0, dataQuality: 'HIGH' } }), 'CANCELLED');
    assert.equal(flightState({ ...verified, snapshot: { status: 'UNKNOWN', delayMinutes: 0, dataQuality: 'LOW' } }), 'UNABLE_TO_VERIFY');
    assert.equal(guardianStatus(verified), 'MONITORING_ACTIVE');
});

test('the next check is the real earliest scheduled check, labelled by kind', () => {
    const checks = [
        { kind: 'DEP', runAt: '2026-10-15T08:15:00Z', status: 'SCHEDULED' },
        { kind: 'DEP_MINUS_3H', runAt: '2026-10-15T05:15:00Z', status: 'SCHEDULED' },
        { kind: 'DEP_MINUS_24H', runAt: '2026-10-14T08:15:00Z', status: 'DONE' },
        { kind: 'COMPLETE', runAt: '2026-10-14T00:00:00Z', status: 'SCHEDULED' },
    ];
    const next = nextScheduledCheck(checks);
    assert.equal(next?.runAt.toISOString(), '2026-10-15T05:15:00.000Z');
    assert.equal(next?.labelKey, 'dep3');
    assert.equal(nextScheduledCheck([]), null);
    assert.equal(nextScheduledCheck([{ kind: 'COMPLETE', runAt: '2026-10-20T00:00:00Z', status: 'SCHEDULED' }]), null);
    assert.equal(earliestNextCheck([null, next]), next);
});

test('check-kind labels come from the kind, with the agreed wording', () => {
    assert.equal(checkKindLabelKey('DEP_MINUS_3H'), 'dep3');
    assert.equal(checkKindLabelKey('ARR_PLUS_4H'), 'arr4');
    assert.equal(checkKindLabelKey('VERIFY_FLIGHT'), 'verify');
    assert.equal(checkKindLabelKey('COMPLETE'), null);
    assert.equal(en.GuardianV2.checkKind.dep3, '3 hours before departure');
    assert.equal(en.GuardianV2.checkKind.dep, 'At scheduled departure');
    assert.equal(en.GuardianV2.checkKind.verify, 'Verification check');
});

test('check times are shown in the departure airport clock (3h before an 18:15 BNE departure = 15:15)', () => {
    const ref = { scheduledDepartureUtc: '2026-10-15T08:15:00.000Z', scheduledDepartureLocal: '2026-10-15T18:15' };
    assert.equal(formatCheckTime('2026-10-15T05:15:00.000Z', 'en', ref), '15 Oct · 15:15');
    assert.equal(formatCheckTime('2026-10-15T05:15:00.000Z', 'en', null), '15 Oct · 05:15 UTC');
});

test('the how-it-works plan is built from the scheduled kinds', () => {
    assert.deepEqual(monitoringPlanKeys([]), STANDARD_PLAN_KEYS);
    assert.deepEqual(monitoringPlanKeys([
        { kind: 'DEP_MINUS_3H', status: 'SCHEDULED' }, { kind: 'DEP', status: 'SCHEDULED' }, { kind: 'COMPLETE', status: 'SCHEDULED' },
    ]), ['dep3', 'dep']);
    assert.match(detail, /monitoringPlanKeys\(trip\.scheduledChecks\)/);
    assert.doesNotMatch(detail + card, /QStash|qstash/i);
});

test('monitoring delayed: never "Action Required"; recovery clears the delayed card', () => {
    const delayed = [{ eventType: 'CHECK_DELAYED', detectedAt: '2026-10-15T01:00:00Z' }];
    const recovered = [...delayed, { eventType: 'MONITORING_RECOVERED', detectedAt: '2026-10-15T02:00:00Z' }];
    assert.equal(monitoringDelayState(delayed), 'DELAYED');
    assert.equal(monitoringDelayState(recovered), 'HEALTHY');
    assert.equal(monitoringDelayState([{ eventType: 'DELAY_DETECTED', detectedAt: '2026-10-15T01:00:00Z' }]), 'HEALTHY');
    assert.match(en.GuardianV2.monitoringDelay.text, /No action is required from you/);
    assert.doesNotMatch(card + detail, /Action Required/);
    assert.equal(legacyAlertNeedsAction({ type: 'CHECK_DELAYED', severity: 'CRITICAL', actionLabel: 'x' }), false);
    assert.equal(legacyAlertNeedsAction({ type: 'DELAY_DETECTED', severity: 'INFO' }), false);
    assert.equal(legacyAlertNeedsAction({ type: 'DELAY_DETECTED', severity: 'CRITICAL' }), true);
});

test('notification empty state never prints UNKNOWN fields', () => {
    assert.equal(en.GuardianV2.notifications.none, 'No notifications sent yet.');
    // the only UNKNOWN left is the internal fallback inside parseNotificationType, never a rendered field
    assert.doesNotMatch(detail, /latestNotification \? latestNotificationType : 'UNKNOWN'/);
    assert.doesNotMatch(detail, /latestLifecycleAlert\?\.state \|\| 'UNKNOWN'/);
    assert.match(detail, /\(latestNotification \|\| latestLifecycleAlert\)/);
});

test('Australian domestic route gets neutral passenger-rights copy; EU/UK keep the assessment', () => {
    assert.equal(usesNeutralRightsCopy('NONE'), true);
    assert.equal(usesNeutralRightsCopy('EU261'), false);
    assert.equal(usesNeutralRightsCopy('UK261'), false);
    assert.equal(en.GuardianV2.rights.title, 'Passenger rights');
    assert.equal(en.GuardianV2.rights.neutral, 'No fixed EU/UK statutory compensation applies to this route.');
    assert.match(en.GuardianV2.rights.neutralMore, /Other airline or consumer rights may still apply/);
    assert.match(detail, /usesNeutralRightsCopy\(compensation\.regime\)/);
    assert.match(detail, /eu261\.title/); // engine-driven card still rendered for EU/UK
});

test('QF549 schedule still displays 18:15 -> 20:50', () => {
    const segment = { origin: 'BNE', destination: 'SYD', scheduledDepartureUtc: '2026-10-15T08:15:00.000Z', scheduledArrivalUtc: '2026-10-15T09:50:00.000Z' };
    const leg = {
        key: 'k', origin: { iata: 'BNE', name: null, city: null, timeZone: 'Australia/Brisbane' },
        destination: { iata: 'SYD', name: null, city: null, timeZone: 'Australia/Sydney' },
        departureLocal: '2026-10-15T18:15', arrivalLocal: '2026-10-15T20:50',
        departureUtc: segment.scheduledDepartureUtc, arrivalUtc: segment.scheduledArrivalUtc, airlineCode: 'QF', airlineName: 'Qantas',
    };
    const out = airportSchedule(segment, [leg]);
    assert.equal(out.scheduledDepartureLocal?.slice(11), '18:15');
    assert.equal(out.scheduledArrivalLocal?.slice(11), '20:50');
});

test('KPIs: trips with changes and alerts sent come from current Guardian flight events only', () => {
    const now = new Date('2026-10-15T00:00:00Z');
    const clean = { ...verified, alertEvents: [] };
    const delayed = { ...verified, snapshot: { status: 'DELAYED', delayMinutes: 50, dataQuality: 'HIGH' }, alertEvents: [] };
    const withEvent = { ...verified, alertEvents: [{ eventType: 'GATE_CHANGE', state: 'SENT', detectedAt: '2026-10-14T12:00:00Z', sentAt: '2026-10-14T12:01:00Z' }] };
    const oldEvent = { ...verified, alertEvents: [{ eventType: 'GATE_CHANGE', state: 'SENT', detectedAt: '2026-09-01T12:00:00Z' }] };
    const systemOnly = { ...verified, alertEvents: [{ eventType: 'CHECK_DELAYED', state: 'SENT', detectedAt: '2026-10-14T12:00:00Z', sentAt: '2026-10-14T12:01:00Z' }] };
    const suppressed = { ...verified, alertEvents: [{ eventType: 'DELAY_DETECTED', state: 'SUPPRESSED', detectedAt: '2026-10-14T12:00:00Z' }] };
    assert.equal(tripHasChanges(clean, now), false);
    assert.equal(tripHasChanges(delayed, now), true);
    assert.equal(tripHasChanges(withEvent, now), true);
    assert.equal(tripHasChanges(oldEvent, now), false);
    assert.equal(tripHasChanges(systemOnly, now), false);
    assert.equal(tripHasChanges(suppressed, now), false);
    assert.equal(tripHasChanges({ ...withEvent, status: 'COMPLETED' }, now), false);
    assert.equal(alertsSentCount([clean, withEvent, systemOnly, suppressed]), 1);
});

test('event priority is presentation only: CRITICAL / IMPORTANT / INFO', () => {
    assert.equal(eventPriority('CANCELLATION_DETECTED', 'HIGH'), 'CRITICAL');
    assert.equal(eventPriority('DELAY_DETECTED', 'HIGH'), 'CRITICAL');
    assert.equal(eventPriority('DELAY_DETECTED', 'MEDIUM'), 'IMPORTANT');
    assert.equal(eventPriority('GATE_CHANGE', 'LOW'), 'IMPORTANT');
    assert.equal(eventPriority('MONITORING_RECOVERED', 'INFO'), 'INFO');
});

test('current / history split is unchanged', () => {
    const { current, history } = splitTrips([{ status: 'ACTIVE' }, { status: 'COMPLETED' }, { status: 'PENDING_VERIFICATION' }, { status: 'FLIGHT_NOT_FOUND' }]);
    assert.equal(current.length, 2);
    assert.equal(history.length, 2);
    assert.match(listPage, /splitTrips\(trips\)/);
});

test('Free-limit behaviour is untouched', () => {
    const monitor = read('app/api/trips/monitor/route.ts');
    assert.match(monitor, /withFreemiumGate\(userId, 'monitored_trip'/);
    assert.match(read('lib/guardian/freeLimit.ts'), /LIMIT_HOLDING_STATUSES = \['ACTIVE', 'PENDING_VERIFICATION'\]/);
});

test('checkpoint planning is unchanged (24h, 3h, departure, arrival +1h/+4h, completion)', () => {
    const plan = planCheckpoints(resolveTripSchedule({
        scheduledDepartureUtc: new Date('2026-10-15T08:15:00Z'),
        scheduledArrivalUtc: new Date('2026-10-15T09:50:00Z'),
        departureDate: new Date('2026-10-15T00:00:00Z'),
    }), new Date('2026-10-01T00:00:00Z'));
    assert.deepEqual(plan.map((c) => c.kind), ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE']);
    // this phase touched no worker / scheduler / checkpoint source
    assert.doesNotMatch(read('lib/guardian/tripPresentation.ts'), /prisma|fetch\(/);
});

test('translations carry the same GuardianV2 keys in en, tr and de', () => {
    const keys = (o: unknown, p = ''): string[] => o && typeof o === 'object'
        ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}.${k}`)) : [p];
    assert.deepEqual(keys(tr.GuardianV2).sort(), keys(en.GuardianV2).sort());
    assert.deepEqual(keys(de.GuardianV2).sort(), keys(en.GuardianV2).sort());
});
