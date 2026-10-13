# Phase 2 — "Find my flight" step: design and quota report

## Behaviour
- The form asks for flight number + date only. `POST /api/flights/lookup` returns the provider's legs:
  route, airport-local departure/arrival ("15 Oct 2026, 13:00"), airline (local code list → provider name → bare code).
- One leg → "This is my flight" confirms it. Several legs (same number, same day) → all are listed, the visitor picks theirs.
  Submit is blocked until a leg is confirmed/chosen (client `submitGate`, and server `resolveFlightSelection`).
- The server stores the chosen leg on the trip (segment origin/destination, scheduled UTC times, `flightVerifiedAt`).
  The client only sends the leg **key**; the server resolves it against its own cached lookup.
  Opt-in (`initializeTripMonitoring`) then makes **no** provider call. EU261 uses the chosen segment's route.
  Later checkpoint lookups pin the leg by airports (`LegHint`), so a number that flies two legs never reads the other leg.
- Not found: ≤7 days to departure → blocked ("check number/date"); >7 days → allowed ("schedule may not be published yet"),
  verified at opt-in / −7 days by the existing PENDING_VERIFICATION flow.
- Never blocks: quota critical (≥95 %), provider/HTTP/timeout errors, broken cache tables, per-IP limit (the form then works as before).

## Protections
| | |
|---|---|
| Cache | 6 h per (flight number, date), found **and** not-found (`FlightLookupCache`) |
| Rate limit | 10 lookups / hour / HMAC'd IP, cache hits count too (`FlightLookupAttempt`) |
| Quota | `FORM_LOOKUP` allowed only at quota level OK / SKIP_EARLY; blocked at CRITICAL (≥95 %) and EXHAUSTED. Monitoring checks keep their own rules |

## Quota consumption (default: 600 units/month, 2 units/call = **300 calls/month**)
Cost model (`estimateMonthlyCalls` in `lib/flightData/quotaPolicy.ts`):

- form lookups = submissions × lookups per submission × (1 − cache hit rate)  — spent **before** double opt-in
- monitoring = submissions × confirm rate × 5 calls (the 1 registration call now comes from the form lookup)

Assumptions: 1.3 lookups per submission (typo fixes), 60 % of submissions open the confirmation link.

| submissions / month | form lookups | monitoring | total calls | % of 300 |
|---:|---:|---:|---:|---:|
| 30 | 39 | 90 | 129 | 43 % |
| 60 | 78 | 180 | 258 | 86 % |
| 100 | 130 | 300 | 430 | **143 %** |
| 200 | 260 | 600 | 860 | 287 % |

Sensitivity: 10 % cache hits changes 100 submissions to 417 calls (139 %); a 40 % confirm rate gives 330 (110 %).

Reading this:
- **About 60 form submissions a month is the ceiling at 600 units.** Before this step the ceiling was ≈ 50 *confirmed* trips (6 calls each).
  Per confirmed trip the cost is unchanged (1 form lookup + 5 checkpoints), but every **unconfirmed** submission now costs ≥ 1 call
  (before: 0, because nothing was called until opt-in).
- The cache barely helps with ordinary traffic (same flight + same day within 6 h is rare); it mainly stops repeat-click abuse.
- The per-IP limit bounds one address to 10 calls/hour; distributed abuse is bounded only by the quota gate.
- At 95 % the form lookup switches itself off, which leaves ≈ 15 calls (5 % of 300) for monitoring of already confirmed trips.
  If signups are expected above ~60/month, raise `AERODATABOX_MONTHLY_QUOTA` (the plan) before relying on this step.

## Schema (NOT APPLIED)
`docs/phase2_schema_flight_lookup.sql`: `MonitoredTrip.flightVerifiedAt`, `FlightLookupCache`, `FlightLookupAttempt`.
Apply it **before** deploying — Prisma selects every `MonitoredTrip` column, so code that knows `flightVerifiedAt` breaks all trip
queries on a database without it. (The enum values of `docs/phase2_schema_flight_not_found.sql` are a separate prerequisite of the validation work.)
