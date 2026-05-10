import {
  ALERT_LIFECYCLE_STATES,
  MONITORING_EVENT_TAXONOMY,
  buildAlertFingerprint,
  getAlertCooldownMs,
  getRetryDelayMs,
  nextRetryAt,
} from '@/lib/alertLifecycle';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredStates = ['DETECTED', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'EXPIRED', 'SUPPRESSED'];
for (const state of requiredStates) {
  assert(ALERT_LIFECYCLE_STATES.includes(state as never), `Missing lifecycle state ${state}`);
}

const routeEvents = ['PRICE_DROP', 'PRICE_SPIKE', 'TARGET_PRICE_REACHED', 'ROUTE_STALE'];
for (const event of routeEvents) {
  assert(MONITORING_EVENT_TAXONOMY.routeTracking.includes(event as never), `Missing route event ${event}`);
}

const guardianEvents = [
  'DELAY_DETECTED',
  'CANCELLATION_DETECTED',
  'GATE_CHANGE',
  'TERMINAL_CHANGE',
  'CONNECTION_RISK',
  'STATUS_UNAVAILABLE',
  'MONITORING_STALE',
];
for (const event of guardianEvents) {
  assert(MONITORING_EVENT_TAXONOMY.guardian.includes(event as never), `Missing Guardian event ${event}`);
}

const systemEvents = ['PROVIDER_UNAVAILABLE', 'CHECK_DELAYED', 'MONITORING_RECOVERED'];
for (const event of systemEvents) {
  assert(MONITORING_EVENT_TAXONOMY.system.includes(event as never), `Missing system event ${event}`);
}

const repeatedFingerprint = buildAlertFingerprint(['trip_1', 'DELAY_DETECTED', 30]);
assert(repeatedFingerprint === buildAlertFingerprint(['trip_1', 'DELAY_DETECTED', 30]), 'Repeated event fingerprint must be stable');
assert(repeatedFingerprint !== buildAlertFingerprint(['trip_1', 'DELAY_DETECTED', 60]), 'Different event details must produce a different fingerprint');

assert(getAlertCooldownMs('MONITORING_STALE') > getAlertCooldownMs('PRICE_DROP'), 'Stale alerts should have a longer cooldown than price drops');
assert(getAlertCooldownMs('ROUTE_STALE') === getAlertCooldownMs('MONITORING_STALE'), 'Route stale alerts should use stale cooldown rules');
assert(getRetryDelayMs(1) === 60_000, 'First retry delay should be 1 minute');
assert(getRetryDelayMs(3) === 240_000, 'Third retry delay should be exponential');
assert(getRetryDelayMs(8) === 960_000, 'Retry delay should be capped by retry attempt clamp');

const now = new Date('2026-05-10T00:00:00.000Z');
assert(nextRetryAt(now, 2).toISOString() === '2026-05-10T00:02:00.000Z', 'nextRetryAt should schedule the second attempt two minutes later');

console.log('alert_infra_smoke: ok');
