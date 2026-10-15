import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    NO_MAPPING_REASON,
    decideNotification,
    escapeHtml,
    factsFromAlertEvent,
    renderEmailHtml,
    renderEmailText,
    type NotificationDecision,
} from '../lib/guardian/notificationPolicy';
import { DELAY_BUCKETS, actionGuidance, classifyChange, describeChange, getDelayBucket } from '../lib/guardian/disruptionContent';
import { airlineActions } from '../lib/guardian/airlineActions';
import { latestMeaningfulChange } from '../lib/guardian/tripPresentation';
import { planCheckpoints, resolveTripSchedule } from '../lib/guardian/checkpoints';

const read = (p: string) => readFileSync(p, 'utf8');
const notifier = read('services/notifications/guardianNotifier.ts');

const ctx = { origin: 'BNE', destination: 'SYD', airlineCode: 'QF', flightNumber: '549' };
const delay = (minutes: number, previous = 0, compensation?: unknown) =>
    ({ type: 'DELAY', subType: `delay_bucket_${getDelayBucket(minutes)}`, previous: `${previous}min`, current: { delayMinutes: minutes, compensation, ...ctx } });
const gate = (from: string, to: string, hoursToDeparture: number | null) =>
    ({ type: 'GATE_CHANGE', subType: 'gate_change_departure', previous: { departureGate: from, arrivalGate: null }, current: { departureGate: to, arrivalGate: null, hoursToDeparture, ...ctx } });
const cancelled = (compensation?: unknown) => ({ type: 'CANCELLED', subType: 'status_cancelled', previous: 'ON_TIME', current: { status: 'CANCELLED', compensation, ...ctx } });

const must = (d: NotificationDecision) => {
    assert.ok(d.notify, 'expected a notification');
    return d as Extract<NotificationDecision, { notify: true }>;
};
const TRIP_URL = 'https://www.flightagent.io/dashboard/guardian/trip1';

test('unknown / unmapped events never produce a user notification', () => {
    for (const event of [{ type: 'EQUIPMENT_CHANGE', previous: 'A', current: ctx }, { type: 'SOMETHING_NEW', current: ctx }, { type: 'DATA_ISSUE', current: ctx }]) {
        const d = decideNotification(event);
        assert.equal(d.notify, false);
        if (!d.notify) assert.equal(d.reason, NO_MAPPING_REASON);
    }
});

test('DATA_ISSUE, recovery and no-change stay user-silent', () => {
    assert.equal(decideNotification({ type: 'DATA_ISSUE', subType: 'status_unknown', current: ctx }).notify, false);
    assert.equal(decideNotification({ type: 'MONITORING_RECOVERED', current: ctx }).notify, false);
    assert.equal(decideNotification({ type: 'DELAY', previous: '0min', current: { delayMinutes: 0, ...ctx } }).notify, false); // on-time observation
});

test('delay thresholds: 10 and 20 min silent, 45 IMPORTANT, 120 CRITICAL', () => {
    assert.equal(decideNotification(delay(10)).notify, false);
    assert.equal(decideNotification(delay(20)).notify, false);
    assert.equal(must(decideNotification(delay(45))).severity, 'IMPORTANT');
    assert.equal(must(decideNotification(delay(90, 45))).severity, 'IMPORTANT');
    assert.equal(must(decideNotification(delay(120, 70))).severity, 'CRITICAL');
    assert.deepEqual([...DELAY_BUCKETS], [15, 30, 60, 120, 180, 240]);
});

test('cancellation is CRITICAL', () => {
    assert.equal(must(decideNotification(cancelled())).severity, 'CRITICAL');
});

test('repeated unchanged delay is not emailed again; a material increase is', () => {
    assert.equal(decideNotification(delay(45, 45)).notify, false);
    assert.equal(decideNotification(delay(72, 70)).notify, false);
    assert.equal(decideNotification(delay(70, 45)).notify, true);
    assert.equal(decideNotification(delay(50, 40)).notify, false); // same 30-59 tier
});

test('gate / terminal changes depend on time to departure', () => {
    assert.equal(decideNotification(gate('22', '17', 30)).notify, false);
    assert.equal(decideNotification(gate('22', '17', null)).notify, false);
    const near = must(decideNotification(gate('22', '17', 2)));
    assert.equal(near.severity, 'IMPORTANT');
    assert.equal(near.before, '22');
    assert.equal(near.now, '17');
    assert.match(near.whatChanged, /changed from 22 to 17/);
    assert.equal(near.subject, 'QF549 gate changed to 17');
    assert.equal(classifyChange({ kind: 'TERMINAL_CHANGE', from: 'D', to: 'B', hoursToDeparture: 3 }), 'IMPORTANT');
});

test('schedule shift materiality', () => {
    assert.equal(classifyChange({ kind: 'SCHEDULE_CHANGE', shiftMinutes: 10 }), 'INFO');
    assert.equal(classifyChange({ kind: 'SCHEDULE_CHANGE', shiftMinutes: 25 }), 'INFO');
    assert.equal(classifyChange({ kind: 'SCHEDULE_CHANGE', shiftMinutes: 35 }), 'IMPORTANT');
    assert.equal(classifyChange({ kind: 'SCHEDULE_CHANGE', shiftMinutes: -45 }), 'IMPORTANT');
    assert.equal(classifyChange({ kind: 'SCHEDULE_CHANGE', shiftMinutes: 200 }), 'CRITICAL');
    assert.equal(classifyChange({ kind: 'SCHEDULE_CHANGE', shiftMinutes: 5, airportOrDateChanged: true }), 'CRITICAL');
});

test('QF549 45-minute delay: subject, flight, route, old -> new, guidance, link', () => {
    const d = must(decideNotification(delay(45)));
    assert.equal(d.subject, 'QF549 delayed by 45 minutes');
    assert.equal(d.before, 'On schedule');
    assert.equal(d.now, '45 minutes late');
    const text = renderEmailText(d, TRIP_URL);
    assert.match(text, /QF549 · BNE → SYD/);
    assert.match(text, /Arrival delay detected/);
    assert.match(text, /Before: On schedule/);
    assert.match(text, /Now: 45 minutes late/);
    assert.match(text, /Change: \+45 minutes/);
    assert.match(text, /Check the Qantas app before leaving for the airport/);
    assert.ok(text.includes(TRIP_URL));
    assert.ok(renderEmailHtml(d, TRIP_URL).includes(`href="${TRIP_URL}"`));
    assert.equal(d.actionRequired, true);
});

test('QF549 cancellation content', () => {
    const d = must(decideNotification(cancelled()));
    assert.equal(d.subject, 'QF549 has been cancelled');
    const text = renderEmailText(d, TRIP_URL);
    assert.match(text, /QF549 · BNE → SYD/);
    assert.match(text, /QF549 is now reported as cancelled/);
    assert.match(text, /rebooking or refund options/);
    assert.match(text, /Keep your booking confirmation/);
    assert.match(text, /receipts for reasonable additional expenses/);
});

test('no internal severity labels or generic wording can reach a user', () => {
    const decisions = [delay(45), delay(130, 70), cancelled(), gate('22', '17', 1)].map((e) => must(decideNotification(e)));
    for (const d of decisions) {
        const out = `${d.subject}\n${renderEmailText(d, TRIP_URL)}\n${renderEmailHtml(d, TRIP_URL)}\n${d.smsText}`;
        assert.doesNotMatch(d.subject, /\[(LOW|MEDIUM|HIGH)\]/);
        assert.doesNotMatch(out, /Trip monitoring update|Guardian detected a minor update|Severity:|You are receiving this/i);
    }
    assert.doesNotMatch(notifier, /Trip monitoring update|Guardian detected a minor update|\[\$\{severityLabel\}\]|LOW_SEVERITY_THROTTLE/);
});

test('compensation appears only with a meaningful disruption and a LIKELY_ELIGIBLE result', () => {
    const likely = { regime: 'EU261', status: 'LIKELY_ELIGIBLE', amount: 400, currency: 'EUR' };
    const withComp = must(decideNotification(delay(200, 100, likely), likely));
    assert.match(withComp.compensation ?? '', /may qualify for compensation under EU261 \(potentially EUR 400\)/);
    assert.match(withComp.compensation ?? '', /extraordinary circumstances/);
    for (const status of ['NOT_ELIGIBLE', 'NEEDS_INFO']) {
        assert.equal(must(decideNotification(cancelled(), { regime: 'EU261', status })).compensation, null);
    }
    assert.equal(must(decideNotification(delay(45), { regime: 'NONE', status: 'NOT_ELIGIBLE' })).compensation, null);
    assert.equal(decideNotification(delay(10), likely).notify, false); // no standalone compensation email
    assert.equal(must(decideNotification(gate('22', '17', 1), likely)).compensation, null);
});

test('deterministic action guidance', () => {
    assert.match(actionGuidance({ kind: 'DELAY', minutes: 10, previousMinutes: 0 }).steps[0], /No action needed yet/);
    assert.match(actionGuidance({ kind: 'DELAY', minutes: 45, previousMinutes: 0 }, 'Qantas').steps[0], /Check the Qantas app before leaving/);
    assert.match(actionGuidance({ kind: 'DELAY', minutes: 75, previousMinutes: 0 }, 'Qantas').steps[0], /latest departure time and rebooking options with Qantas/);
    assert.match(actionGuidance({ kind: 'TERMINAL_CHANGE', from: 'D', to: 'B', hoursToDeparture: 2 }).steps[0], /extra time/);
    assert.equal(actionGuidance(null).summary, 'No action needed');
    assert.doesNotMatch(JSON.stringify([actionGuidance({ kind: 'CANCELLATION' }), actionGuidance({ kind: 'DELAY', minutes: 90, previousMinutes: 0 })]), /cancel (your|the) (booking|flight) yourself/i);
});

test('airline actions use only verified URLs from the existing map', () => {
    for (const code of ['QF', 'VA', 'JQ', 'SQ', 'EK', 'TK']) {
        const a = airlineActions(code);
        assert.ok(a.airlineName);
        assert.match(a.supportUrl ?? '', /^https:\/\//);
    }
    assert.equal(airlineActions('QF').airlineName, 'Qantas');
    assert.equal(airlineActions('BA').manageBookingUrl?.includes('managebooking'), true);
    assert.equal(airlineActions('QF').manageBookingUrl, null); // no verified manage-booking URL: none invented
    const unknown = airlineActions('ZZ', 'Zed Air');
    assert.equal(unknown.supportUrl, null);
    assert.equal(unknown.airlineName, 'Zed Air');
});

test('email HTML escapes dynamic values', () => {
    assert.equal(escapeHtml('<b>"x"</b>'), '&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    const d = must(decideNotification({ ...cancelled(), current: { ...ctx, flightNumber: '549<script>' } }));
    assert.doesNotMatch(renderEmailHtml(d, TRIP_URL), /<script>/);
});

test('notifier: skipped-with-reason, delivery idempotency and stale protection intact, severity-gated channels', () => {
    assert.match(notifier, /recordSkippedDelivery\(event\.alertEventId, 'EMAIL', decision\.reason\)/);
    assert.match(notifier, /persistSkippedDelivery\(eventId, event\.tripId, 'EMAIL'\)/);
    assert.match(notifier, /claimNotificationDelivery/);
    assert.match(notifier, /reclaimStaleProcessingDelivery/);
    assert.match(notifier, /MAX_STALE_RECLAIM_ATTEMPTS/);
    assert.match(notifier, /decision\.severity === 'CRITICAL'/);
    assert.match(notifier, /appUrl\(`\/dashboard\/guardian\/\$\{event\.tripId\}`\)/);
    assert.doesNotMatch(notifier, /mapEventToMessage|deriveSeverityLabel/);
});

test('trip page: latest meaningful change, with old -> new and no raw payload', () => {
    const verified = { status: 'ACTIVE', lastCheckedAt: '2026-10-15T05:00:00Z', snapshot: { status: 'DELAYED', delayMinutes: 45, dataQuality: 'HIGH' } };
    const events = [{
        eventType: 'DELAY_DETECTED', state: 'SENT', detectedAt: '2026-10-15T05:00:00Z',
        payload: { eventId: 'trip1:DELAY:delay_bucket_30:abc', previous: '0min', current: { delayMinutes: 45, ...ctx } },
    }];
    const change = latestMeaningfulChange({ ...verified, alertEvents: events }, new Date('2026-10-15T06:00:00Z'));
    assert.equal(change?.facts.kind, 'DELAY');
    assert.equal(describeChange(change!.facts, { flightNumber: 'QF549', airlineCode: 'QF', origin: 'BNE', destination: 'SYD' }).delta, '+45 minutes');
    // recovered flight: the old delay is not "what changed" any more
    assert.equal(latestMeaningfulChange({ ...verified, snapshot: { status: 'ON_TIME', delayMinutes: 0, dataQuality: 'HIGH' }, alertEvents: events }), null);
    // QF549 on-time check: nothing to show
    assert.equal(latestMeaningfulChange({ ...verified, snapshot: { status: 'ON_TIME', delayMinutes: 0, dataQuality: 'HIGH' }, alertEvents: [] }), null);
    const gateEvent = { eventType: 'GATE_CHANGE', state: 'SENT', detectedAt: '2026-10-15T05:00:00Z', payload: { eventId: 't:GATE_CHANGE:gate_change_departure:h', previous: { departureGate: '22' }, current: { departureGate: '17', ...ctx } } };
    assert.equal(factsFromAlertEvent(gateEvent)?.kind, 'GATE_CHANGE');
    const detail = read('app/[locale]/dashboard/guardian/[id]/TripDetailsClient.tsx');
    assert.match(detail, /whatChanged\.title/);
    assert.match(detail, /whatToDo\.title/);
    assert.doesNotMatch(detail, /JSON\.stringify\(.*payload/);
});

test('dashboard card shows the action state of the latest change', () => {
    const card = read('components/TravelGuardianDashboard.tsx');
    assert.match(card, /latestMeaningfulChange\(trip\)/);
    assert.match(card, /guidance\.summary/);
});

test('nextCheckAt follows the plan in the lifecycle layer; checkpoint plan itself is unchanged', () => {
    const lifecycle = read('lib/guardian/tripLifecycle.ts');
    assert.match(lifecycle, /nextCheckAt: firstCheck\.runAt/);
    const plan = planCheckpoints(resolveTripSchedule({
        scheduledDepartureUtc: new Date('2026-10-15T08:15:00Z'), scheduledArrivalUtc: new Date('2026-10-15T09:50:00Z'), departureDate: new Date('2026-10-15T00:00:00Z'),
    }), new Date('2026-10-01T00:00:00Z'));
    assert.deepEqual(plan.map((c) => c.kind), ['DEP_MINUS_24H', 'DEP_MINUS_3H', 'DEP', 'ARR_PLUS_1H', 'ARR_PLUS_4H', 'COMPLETE']);
});

test('Free-limit behaviour is unchanged', () => {
    assert.match(read('app/api/trips/monitor/route.ts'), /withFreemiumGate\(userId, 'monitored_trip'/);
    assert.match(read('lib/guardian/freeLimit.ts'), /LIMIT_HOLDING_STATUSES = \['ACTIVE', 'PENDING_VERIFICATION'\]/);
});
