# Guardian Next Check Audit

Read-only production audit on 14 October 2026, before the first QF549 checkpoint. No production records, QStash messages, or schedules were modified. Only operational fields were selected from the database, inside a read-only transaction.

## Root cause

**A — nextCheckAt initial placeholder was never advanced.** The signed-in Add Booked Trip save creates `nextCheckAt: new Date()`. Verified initialization skips a second provider lookup and calls `replanTripChecks`, which writes `monitoringEndsAt` and schedules six checkpoints but never synchronizes `nextCheckAt`.

The database does **not** have `lastCheckedAt == nextCheckAt`: `lastCheckedAt` is null. An additional **F — UI fallback** makes Last checked display the creation snapshot's `snapshotAt`. This snapshot is created by the save route and is not a monitoring run. Both displayed values round to 14 October 11:14 in Brisbane.

No duplicate checks were found. All six messages are published and pending for future execution. There is no evidence of an execution failure or a timezone formatting error causing the stale next-check field.

## Production trip state

| Field | Observed value (UTC) |
|---|---|
| trip.id | `cmv7f3dsd0002kx060hzrn0fx` |
| status | `ACTIVE` |
| createdAt | `2026-10-14T01:14:37.837Z` |
| lastCheckedAt | `null` |
| nextCheckAt | `2026-10-14T01:14:37.836Z` |
| monitoringEndsAt | `2026-10-17T09:50:00.000Z` |
| scheduledDepartureUtc | `2026-10-15T08:15:00.000Z` |
| scheduledArrivalUtc | `2026-10-15T09:50:00.000Z` |
| snapshot.snapshotAt | `2026-10-14T01:14:37.837Z` |

The expected next checkpoint at audit time is `2026-10-14T08:15:00.000Z`, or **14 October 18:15 Brisbane**. Last checked should read **Not checked yet**.

## Scheduled checks

All six rows have status **SCHEDULED**, `error: null`, and a non-null `messageId`. The schema has no separate `qstashMessageId`, `publishedAt`, or other failure fields. `updatedAt` below is the database update time, not a separately tracked publication timestamp.

| kind | id | runAt (UTC) | createdAt (UTC) | updatedAt (UTC) |
|---|---|---|---|---|
| DEP_MINUS_24H | `cmv7f3gvt0006kx067mq0jzm8` | 2026-10-14T08:15:00.000Z | 2026-10-14T01:14:41.850Z | 2026-10-14T01:14:42.618Z |
| DEP_MINUS_3H | `cmv7f3hzm0008kx06pldieqr9` | 2026-10-15T05:15:00.000Z | 2026-10-14T01:14:43.283Z | 2026-10-14T01:14:43.614Z |
| DEP | `cmv7f3if0000akx06jv8xnr9t` | 2026-10-15T08:15:00.000Z | 2026-10-14T01:14:43.837Z | 2026-10-14T01:14:44.171Z |
| ARR_PLUS_1H | `cmv7f3iui000ckx069qayv211` | 2026-10-15T10:50:00.000Z | 2026-10-14T01:14:44.394Z | 2026-10-14T01:14:44.824Z |
| ARR_PLUS_4H | `cmv7f3jcm000ekx06efr788od` | 2026-10-15T13:50:00.000Z | 2026-10-14T01:14:45.047Z | 2026-10-14T01:14:45.378Z |
| COMPLETE | `cmv7f3js1000gkx061ec3xd6k` | 2026-10-17T09:50:00.000Z | 2026-10-14T01:14:45.601Z | 2026-10-14T01:14:45.930Z |

| kind | messageId | QStash state at audit |
|---|---|---|
| DEP_MINUS_24H | `msg_7YoJxFpwkEy6sUx4tWjApWaoUpdDLF6QactYyout2Cramncy6Mzy3` | Pending; notBefore matches runAt |
| DEP_MINUS_3H | `msg_26hZCxZCuWyyTWPmSVBrNC1RADLwRwunizxkZuwuf3eMEjwPWTmUE28aJZiWn2D` | Pending; notBefore matches runAt |
| DEP | `msg_7YoJxFpwkEy5zBp36jecfaBBbjidjy6x1xtmZtuX5vdC3iX56BiZL` | Pending; notBefore matches runAt |
| ARR_PLUS_1H | `msg_7YoJxFpwkEy5zBp2WPfVYYyyDZPhHU4hbhKmPZrRbDA69P19c5hT5` | Pending; notBefore matches runAt |
| ARR_PLUS_4H | `msg_26hZCxZCuWyyTWPmSVBrNCtiJEejZ2NZZEDoCakZuk66tvjosGBxJWWTyqtwn29` | Pending; notBefore matches runAt |
| COMPLETE | `msg_26hZCxZCuWyyTWPmSVBrNCtiJEfGRWQmQczYH1Q3B1PgCNLuUCx3ZssG51tQFmp` | Pending; notBefore matches runAt |

## Expected schedule

Departure checkpoints use origin-local time (`Australia/Brisbane`, UTC+10); arrival and completion checkpoints use destination-local time (`Australia/Sydney`, UTC+11 for these dates).

| Milestone | UTC | Airport-local equivalent |
|---|---|---|
| DEP_MINUS_24H | 2026-10-14 08:15Z | 14 Oct 2026 18:15 Brisbane |
| DEP_MINUS_3H | 2026-10-15 05:15Z | 15 Oct 2026 15:15 Brisbane |
| DEP | 2026-10-15 08:15Z | 15 Oct 2026 18:15 Brisbane |
| ARR_PLUS_1H | 2026-10-15 10:50Z | 15 Oct 2026 21:50 Sydney |
| ARR_PLUS_4H | 2026-10-15 13:50Z | 16 Oct 2026 00:50 Sydney |
| COMPLETE | 2026-10-17 09:50Z | 17 Oct 2026 20:50 Sydney |

COMPLETE is scheduled arrival +48 hours, as defined by the existing lifecycle. All stored checkpoint times match the expected schedule.

## QStash state

Read-only QStash API inspection confirmed `flightagent-publish-due`, cron `0 3 * * *` UTC, `isPaused: false`. Each of the trip's six stored message IDs was retrieved successfully from QStash, with `notBefore` equal to the corresponding checkpoint's UTC timestamp. These are pending future deliveries, not overdue or failed executions.

## Code issue and fix

- Central scheduling now synchronizes `nextCheckAt` after persisting/publishing a plan, using the earliest strictly future SCHEDULED checkpoint.
- Replanning passes its reference time and current check exclusion to central scheduling. Existing cancellation/replanning behavior remains in place; no additional checks are created by the synchronization helper.
- Successful worker completion uses the same selection helper, excluding its own check and past checkpoints. Fallback reads the latest monitoring end from the database, avoiding a stale pre-replan value.
- With no future checks, use `monitoringEndsAt`. If neither a check nor a monitoring end exists, the helper returns null; the existing required database field is left unchanged rather than fabricated. Normal initialized plans always establish a monitoring end. No nullable-column migration is introduced.
- Planning never updates `lastCheckedAt`. COMPLETE no longer updates it because completion does not make a provider call.
- Trip Details uses only `lastCheckedAt` for Last checked and Last monitoring run. Null displays **Not checked yet**. A missing next time displays **Not scheduled**, including the next-step text. English, Turkish, and German strings are included.
- No production backfill, timestamp edit, new check creation, message publication, or deployment was performed. Existing production placeholder data remains until the real worker run updates it or a separately authorized repair occurs.

## Validation

- `npm test`: 311 passed, 1 skipped, 0 failed (312 total).
- `npx tsc --noEmit -p .`: passed.
- `npm run build`: passed.
- Regression tests execute verified initialization and replanning against an in-memory database adapter, a successful worker with the development provider fixture, future/current/past/status selection, fallback, UI wording, and QF549 milestone order.
- Changed-file lint: the new helper, lifecycle module, and tests pass. Scheduler/worker/UI have 7 existing explicit-any errors and 3 existing unused-variable warnings; baseline lint against main confirms the scheduler/worker errors predate this change. No new lint issues introduced.
- DB migration: **None**.
- Branch: `guardian-next-check-lifecycle`.
- PR: linked in the final audit response and attached to this chat.
- Deployment: **NOT DEPLOYED**.
