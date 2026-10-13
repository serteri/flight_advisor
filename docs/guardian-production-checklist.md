# Guardian production checklist

Names only - never paste secret values into this file, tickets or chat.
"Production" = the Vercel production deployment (`VERCEL_ENV=production`).
Preview and local runs always use mocks (no real email, no AeroDataBox, no QStash publishing).

## 1. Required environment variables (names only)

| Area | Variables |
|---|---|
| App | `APP_BASE_URL` (public https URL, no trailing path), `NEXTAUTH_SECRET` or `AUTH_SECRET`, `DATABASE_URL`, `ADMIN_EMAIL` |
| Email switch | `EMAIL_DELIVERY_READY` (must be exactly `true`), optional `EMAIL_PROVIDER` (`resend` default, or `mailjet`), `NOTIFICATION_FROM_EMAIL` |
| Resend | `RESEND_API_KEY` |
| Mailjet | `MAILJET_API_KEY`, `MAILJET_SECRET_KEY` |
| AeroDataBox (RapidAPI) | `RAPID_API_KEY`, `RAPID_API_HOST_AERODATABOX`; optional `AERODATABOX_MONTHLY_QUOTA` (default 600 units), `AERODATABOX_UNITS_PER_CALL` (default 2) |
| QStash | `QSTASH_URL`, `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` |
| Auth (Google) | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Analytics (optional) | `GA4_API_SECRET` (server-side Guardian events; none are sent without it) |

Overrides that must NOT be set in production: `EMAIL_FORCE_LIVE`, `QSTASH_FORCE_LIVE`, `AERODATABOX_FORCE_LIVE`.

## 2. Admin: read `/admin/guardian`

Sign in as the `ADMIN_EMAIL` user and open `/admin/guardian` (anyone else gets a 404). It shows counts and ids only - no emails, names or secrets.

| Block | Healthy looks like |
|---|---|
| Email delivery | State `READY`, real sending enabled `yes`, provider credentials present, app URL valid. `DELIVERY_DISABLED` = the switch is off (waitlist mode). `CONFIGURATION_ERROR` = the listed variable names are missing/invalid. |
| QStash | Credentials `yes`; publish-due schedule `HEALTHY`. `MISSING` = run the setup script (section 4). `WRONG_DESTINATION`/`WRONG_CRON`/`PAUSED` = fix in the QStash console or re-run the script. `UNREACHABLE` = token/URL wrong or QStash down. "Last successful publish-due run" should be within the last ~26 h. |
| AeroDataBox | Mode `LIVE`, credentials `yes`, quota status `OK`. `SKIP_EARLY` (80%) skips DEP-24h checks, `CRITICAL` (95%) keeps only DEP and ARR+4h, `EXHAUSTED` blocks all provider calls until the month resets. "Additional normal trips supportable" = remaining calls / 6. |
| Monitoring | Active / pending confirmation / pending verification / flight-not-found / completed counts. |
| Scheduled checks | "Stale" should be `0`. "Scheduled, not yet published" are checks more than 6 days ahead (normal). "Failed (last 24 h)" should be low. |
| Latest failures | Time, trip id, check id, checkpoint, failure type, provider code/status, retry state (`retry pending` = QStash will redeliver, max 3; `final` = gave up). |

## 3. Email - confirm live sending

1. `/admin/guardian` -> Email delivery state is `READY`.
2. Submit one flight on the home page with a project-owned test address and consent ticked.
3. The confirmation email arrives (check spam). Vercel logs for the request show `[Email:welcome] DELIVERED via <provider>`.
4. Log meanings: `DELIVERED` sent; `DELIVERY_DISABLED` blocked by policy (in production this is logged as an error and the request fails - nothing is faked); `CONFIGURATION_ERROR` names the missing variables; `PROVIDER_ERROR` is the provider's rejection text.
5. If the switch was off while people signed up (waitlist), run `scripts/send-pending-confirmations.ts` once after turning it on.

## 4. QStash - confirm publishing and execution

1. Create the daily schedule once (production env loaded): `VERCEL_ENV=production npx tsx scripts/setup-publish-schedule.ts --apply` (dry run without `--apply`). It is idempotent.
2. `/admin/guardian` -> QStash schedule `HEALTHY`.
3. QStash console -> Schedules: `flightagent-publish-due`, cron `0 3 * * *`, destination `<APP_BASE_URL>/api/guardian/publish-due`. After the first 03:00 UTC run, "Last successful publish-due run" fills in.
4. QStash console -> Messages / Logs: after confirming a trip, `/api/guardian/check?...` messages appear with the planned `notBefore` times; deliveries return 200.

## 5. AeroDataBox - confirm a real lookup

1. Mode `LIVE` on `/admin/guardian` and quota block populated.
2. On the home page, enter a real upcoming flight number and date. The "find my flight" step shows the real route/times (a mock never shows for production).
3. Vercel logs: `[AeroDataBox] LIVE legs for <flight> on <date>`. The quota "used" figure increases by one call (2 units by default).
4. A flight the provider does not know is blocked within 7 days of departure (`FLIGHT_NOT_FOUND`); further out it becomes `PENDING_VERIFICATION` and is re-checked 7 days before departure.

## 6. Database - what appears after tracking one flight

| Moment | Records |
|---|---|
| Form submitted | `User` (email only), `MonitoredTrip` status `PENDING_CONFIRMATION` (consent, hashed request IP), one `FlightSegment`, a `LoginToken` |
| Link opened | Trip -> `ACTIVE` (`confirmedAt` set), `ScheduledTripCheck` rows (`DEP_MINUS_24H`, `DEP_MINUS_3H`, `DEP`, `ARR_PLUS_1H`, `ARR_PLUS_4H`, `COMPLETE`) with `messageId` for those within 6 days |
| A check runs | row `SCHEDULED` -> `DONE`; `TripSnapshot` upserted; `apiCallsUsed` incremented; `ApiQuotaState` (provider `AERODATABOX`) incremented |
| Disruption detected | `AlertEvent`, `GuardianAlert`, `AlertNotificationDelivery` (+ `ClaimRequest` lead and `lastAlertSentAt` when the compensation engine says likely eligible) |
| Arrival + 48 h | `COMPLETE` check -> trip `COMPLETED` |

Free plan: one flight monitored at a time. Extra pending trips for the same account are `ARCHIVED` at confirmation.

## 7. Guardian lifecycle statuses

`PENDING_CONFIRMATION` -> `ACTIVE` -> `COMPLETED`; side exits `PENDING_VERIFICATION` -> `ACTIVE`/`FLIGHT_NOT_FOUND`, `ARCHIVED` (a pending trip over the Free limit).
Checks: `SCHEDULED` -> `DONE` | `SKIPPED` (quota block, obsolete/superseded stale check, trip ended) | `FAILED` | `CANCELLED`.

## 8. Alerts - verify notification delivery safely

Do not fake a disruption or edit production rows. Options:
- Use `scripts/send-test-alert.ts` (explicit manual real send to an address you own) to check the template and sender domain.
- Watch real flights: when a delay or cancellation naturally occurs, `AlertNotificationDelivery` shows `SENT`/`FAILED` per channel and the email log line reads `[Email:disruption-alert] DELIVERED`.
- A failed alert email leaves `lastAlertSentAt` empty so a later check retries; `AlertNotificationDelivery` retries are bounded.

## 9. Recovery - diagnose a failed check

1. `/admin/guardian` -> Latest failures: note failure type and code.
2. By type:
   - `TEMPORARY` (HTTP 5xx/429/timeout): QStash retries up to 3 times automatically; if `final`, the next checkpoint will try again.
   - `AUTHENTICATION`: check `RAPID_API_KEY` / `RAPID_API_HOST_AERODATABOX` and the RapidAPI subscription.
   - `QUOTA`: quota level blocked the call; see the AeroDataBox block.
   - `INVALID_INPUT` / `PERMANENT` / `NOT_FOUND`: the flight data itself is wrong; no retry will help.
3. Missed `publish-due` run: the next run recovers on its own. Checks overdue < 24 h run late; arrival-side checks and `COMPLETE` older than that run late (one per trip); obsolete pre-departure checks are marked `SKIPPED` with the reason in `error`. Messages QStash lost (still `SCHEDULED` 2 h past their time) are republished.
4. QStash outage: same recovery at the next daily run. Check QStash status and the schedule block.

## 10. Production end-to-end test (manual, one flight)

Use a project-owned test address and a real upcoming flight. Do not create or edit disruption data.
1. Submit the form -> row `PENDING_CONFIRMATION` (section 6).
2. Confirmation email arrives (section 3) -> open the link -> trip `ACTIVE`.
3. `ScheduledTripCheck` rows exist; those within 6 days have `messageId`.
4. When the first checkpoint time passes: row `DONE`, `TripSnapshot` filled, QStash log shows a 200 delivery.
5. Stop here unless the flight is genuinely disrupted; never manufacture a disruption or a claim.
