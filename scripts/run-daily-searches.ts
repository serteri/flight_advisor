/*
  Daily Search Seeder
  - Simulates realistic background searches against /api/flight-search
  - Helps populate SearchAnalytics + RouteInsight with fresh price signals

  Usage:
    npm run seed:flights
    npm run seed:flights -- --dry-run
    npm run seed:flights -- --base-url=https://flightagent.io
*/

type Cabin = 'economy' | 'business' | 'first';
type Persona = 'budget' | 'comfort' | 'business' | 'family';

const AIRPORT_POOL = [
  'ATL', 'PEK', 'LAX', 'ORD', 'LHR', 'HND', 'PVG', 'CDG', 'DFW', 'AMS',
  'FRA', 'IST', 'SIN', 'DEN', 'JFK', 'MAD', 'BCN', 'MUC', 'LGW', 'MEL',
  'SYD', 'BNE', 'PER', 'AKL', 'WLG', 'CHC', 'DXB', 'DOH', 'AUH', 'RUH',
  'JED', 'CAI', 'CMN', 'CPT', 'JNB', 'NBO', 'ADD', 'LOS', 'ACC', 'DAR',
  'BKK', 'HKG', 'ICN', 'NRT', 'KIX', 'TPE', 'MNL', 'CGK', 'KUL', 'DEL',
  'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'DAC', 'CMB', 'KTM', 'SGN', 'HAN',
  'SFO', 'SEA', 'BOS', 'MIA', 'IAD', 'EWR', 'YYZ', 'YVR', 'YUL', 'MEX',
  'GRU', 'GIG', 'EZE', 'SCL', 'LIM', 'BOG', 'PTY', 'CUN', 'LAS', 'PHX',
  'IAH', 'MSP', 'DTW', 'PHL', 'CLT', 'SAN', 'TPA', 'MCO', 'FLL', 'DCA',
  'OSL', 'ARN', 'CPH', 'HEL', 'DUB', 'BRU', 'ZRH', 'VIE', 'PRG', 'WAW',
  'ATH', 'LIS', 'OPO', 'FCO', 'MXP', 'NAP', 'VCE', 'GVA', 'MAN', 'EDI',
  'GLA', 'BUD', 'OTP', 'SOF', 'BEG', 'ZAG', 'TLL', 'RIX', 'VNO', 'KEF',
  'GOT', 'BGO', 'SVG', 'TRD', 'BLL', 'ALC', 'AGP', 'PMI', 'IBZ', 'TFS',
  'MRS', 'NCE', 'LYS', 'TLS', 'HAM', 'DUS', 'BER', 'STR', 'CGN', 'HAJ',
  'GDN', 'KRK', 'KTW', 'WRO', 'LCA', 'MLA', 'TLV', 'AMM', 'BEY', 'KWI',
  'MCT', 'BAH', 'MED', 'DMM', 'IKA', 'KHI', 'LHE', 'ISB', 'TRV', 'GOI',
  'PNQ', 'AMD', 'COK', 'MLE', 'REP', 'PNH', 'RGN', 'VTE', 'BWN', 'DPS',
  'SUB', 'CEB', 'CRK', 'DVO', 'NAN', 'PPT', 'GUM', 'SPN', 'HNL', 'OGG',
  'ANC', 'FAI', 'PDX', 'SJC', 'AUS', 'SAT', 'RDU', 'BNA', 'SLC', 'CVG',
  'CLE', 'CMH', 'PIT', 'IND', 'MSY', 'MCI', 'OKC', 'OMA', 'ABQ', 'TUS'
] as const;

const CABINS: Cabin[] = ['economy', 'economy', 'business', 'first'];
const PERSONAS: Persona[] = ['budget', 'comfort', 'business', 'family'];

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const baseUrlArg = args.find((arg) => arg.startsWith('--base-url='));

const BASE_URL = (
  (baseUrlArg ? baseUrlArg.split('=')[1] : '') ||
  process.env.FLIGHT_SEARCH_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 90_000;
const TOTAL_SEARCHES_MIN = 20;
const TOTAL_SEARCHES_MAX = 30;
const CONCURRENCY = 3;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function randomDepartureDateWithin60Days(): string {
  const now = new Date();
  const dayOffset = randInt(1, 60);
  const target = new Date(now.getTime() + dayOffset * 86_400_000);
  return toDateString(target);
}

function pickRoutePair(): { origin: string; destination: string } {
  const origin = pick(AIRPORT_POOL);
  let destination = pick(AIRPORT_POOL);

  while (destination === origin) {
    destination = pick(AIRPORT_POOL);
  }

  return { origin, destination };
}

function realisticTripParams() {
  const guests = randInt(1, 4);
  const cabin = pick(CABINS);
  const persona = pick(PERSONAS);
  const tripType = Math.random() < 0.45 ? 'ROUND_TRIP' : 'ONE_WAY';
  const date = randomDepartureDateWithin60Days();

  return {
    guests,
    cabin,
    persona,
    tripType,
    date,
  };
}

function buildSearchUrl(): { url: string; meta: Record<string, unknown> } {
  const route = pickRoutePair();
  const params = realisticTripParams();
  const search = new URLSearchParams({
    origin: route.origin,
    destination: route.destination,
    date: params.date,
    adults: String(params.guests),
    children: '0',
    infants: '0',
    cabin: params.cabin,
    persona: params.persona,
    tripType: params.tripType,
    // Keep variant randomized for analytics distribution
    buyNowVariant: pick(['A', 'B', 'C']),
  });

  return {
    url: `${BASE_URL}/api/flight-search?${search.toString()}`,
    meta: {
      route: `${route.origin}-${route.destination}`,
      date: params.date,
      guests: params.guests,
      cabin: params.cabin,
      persona: params.persona,
      tripType: params.tripType,
    },
  };
}

async function callFlightSearch(url: string): Promise<{ ok: boolean; status: number; count: number; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'flight-ai-daily-seeder/1.0',
      },
      signal: controller.signal,
    });

    let count = 0;
    try {
      const body = await res.json();
      const results = Array.isArray(body) ? body : body?.results;
      count = Array.isArray(results) ? results.length : 0;
    } catch {
      // ignore parsing errors; status is still meaningful
    }

    return { ok: res.ok, status: res.status, count };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const totalSearches = randInt(TOTAL_SEARCHES_MIN, TOTAL_SEARCHES_MAX);
  const jobs: Array<{ url: string; meta: Record<string, unknown> }> = [];
  const uniqueRoutes = new Set<string>();

  while (jobs.length < totalSearches) {
    const candidate = buildSearchUrl();
    const routeKey = String(candidate.meta.route || '');
    if (!routeKey || uniqueRoutes.has(routeKey)) {
      continue;
    }

    uniqueRoutes.add(routeKey);
    jobs.push(candidate);
  }

  console.log(`\n[seed:flights] Base URL: ${BASE_URL}`);
  console.log(`[seed:flights] Planned searches: ${jobs.length} unique random pairs from global pool (${AIRPORT_POOL.length} airports)`);
  if (isDryRun) {
    console.log('[seed:flights] Dry-run mode active, requests will not be sent.\n');
    jobs.forEach((job, idx) => {
      console.log(`${String(idx + 1).padStart(2, '0')}. ${job.meta.route} ${job.meta.date} | guests=${job.meta.guests} | ${job.meta.cabin} | ${job.meta.persona} | ${job.meta.tripType}`);
    });
    return;
  }

  let success = 0;
  let failed = 0;
  let totalResults = 0;

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    console.log(`\n[seed:flights] Running batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(jobs.length / CONCURRENCY)} (${batch.length} requests)`);
    const outputs = await Promise.all(
      batch.map(async (job) => {
        const result = await callFlightSearch(job.url);
        return { job, result };
      })
    );

    outputs.forEach(({ job, result }) => {
      if (result.ok) {
        success += 1;
        totalResults += result.count;
        console.log(`✓ ${job.meta.route} ${job.meta.date} -> ${result.status} (${result.count} flights)`);
      } else {
        failed += 1;
        console.warn(`✗ ${job.meta.route} ${job.meta.date} -> ${result.status || 'ERR'} ${result.error || ''}`.trim());
      }
    });
  }

  console.log('\n[seed:flights] Completed');
  console.log(`[seed:flights] Success: ${success}, Failed: ${failed}, Total flights seen: ${totalResults}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('[seed:flights] Fatal:', error);
  process.exit(1);
});
