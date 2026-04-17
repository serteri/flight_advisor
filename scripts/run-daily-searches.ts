/*
  Daily Search Seeder
  - Simulates realistic background searches against /api/flight-search
  - Helps populate SearchAnalytics + RouteInsight with fresh price signals

  Usage:
    npm run seed:flights
    npm run seed:flights -- --dry-run
    npm run seed:flights -- --base-url=https://flightagent.io
*/

type Cabin = 'economy' | 'premium' | 'business';
type Persona = 'budget' | 'comfort' | 'business' | 'family';

type RouteConfig = {
  origin: string;
  destination: string;
  basePrice: number;
  distanceBand: 'medium' | 'long' | 'ultra';
};

const POPULAR_ROUTES: RouteConfig[] = [
  { origin: 'BNE', destination: 'IST', basePrice: 1220, distanceBand: 'ultra' },
  { origin: 'SYD', destination: 'LHR', basePrice: 1380, distanceBand: 'ultra' },
  { origin: 'MEL', destination: 'LAX', basePrice: 1090, distanceBand: 'ultra' },
  { origin: 'DXB', destination: 'JFK', basePrice: 980, distanceBand: 'ultra' },
  { origin: 'SIN', destination: 'CDG', basePrice: 890, distanceBand: 'long' },
  { origin: 'HND', destination: 'SFO', basePrice: 1010, distanceBand: 'long' },
  { origin: 'FRA', destination: 'JFK', basePrice: 760, distanceBand: 'long' },
  { origin: 'LHR', destination: 'JFK', basePrice: 690, distanceBand: 'long' },
  { origin: 'SYD', destination: 'SIN', basePrice: 420, distanceBand: 'medium' },
  { origin: 'BKK', destination: 'NRT', basePrice: 380, distanceBand: 'medium' },
];

const CABINS: Cabin[] = ['economy', 'economy', 'economy', 'premium', 'business'];
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

const REQUEST_TIMEOUT_MS = 30_000;
const SEARCHES_PER_ROUTE = 2;
const CONCURRENCY = 4;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
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

function realisticTripParams(route: RouteConfig) {
  const adults = randInt(1, 2);
  const children = Math.random() < 0.2 ? 1 : 0;
  const infants = children > 0 && Math.random() < 0.4 ? 1 : 0;
  const cabin = pick(CABINS);
  const persona = pick(PERSONAS);
  const tripType = Math.random() < 0.32 ? 'ROUND_TRIP' : 'ONE_WAY';
  const date = randomDepartureDateWithin60Days();

  const expectedPriceNoise = (() => {
    const volatilityFactor = route.distanceBand === 'ultra' ? 0.14 : route.distanceBand === 'long' ? 0.12 : 0.1;
    const seasonal = 1 + (Math.sin(Date.now() / 86_400_000) * 0.03);
    const randomShock = 1 + ((Math.random() - 0.5) * volatilityFactor * 2);
    const cabinFactor = cabin === 'business' ? 2.2 : cabin === 'premium' ? 1.45 : 1;
    return Math.round(route.basePrice * seasonal * randomShock * cabinFactor);
  })();

  return {
    adults,
    children,
    infants,
    cabin,
    persona,
    tripType,
    date,
    expectedPriceNoise,
  };
}

function buildSearchUrl(route: RouteConfig): { url: string; meta: Record<string, unknown> } {
  const params = realisticTripParams(route);
  const search = new URLSearchParams({
    origin: route.origin,
    destination: route.destination,
    date: params.date,
    adults: String(params.adults),
    children: String(params.children),
    infants: String(params.infants),
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
      cabin: params.cabin,
      persona: params.persona,
      tripType: params.tripType,
      expectedPriceNoise: params.expectedPriceNoise,
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
  const jobs: Array<{ url: string; meta: Record<string, unknown> }> = [];

  for (const route of POPULAR_ROUTES) {
    for (let i = 0; i < SEARCHES_PER_ROUTE; i += 1) {
      jobs.push(buildSearchUrl(route));
    }
  }

  console.log(`\n[seed:flights] Base URL: ${BASE_URL}`);
  console.log(`[seed:flights] Planned searches: ${jobs.length} (${POPULAR_ROUTES.length} routes x ${SEARCHES_PER_ROUTE})`);
  if (isDryRun) {
    console.log('[seed:flights] Dry-run mode active, requests will not be sent.\n');
    jobs.forEach((job, idx) => {
      console.log(`${String(idx + 1).padStart(2, '0')}. ${job.meta.route} ${job.meta.date} | ${job.meta.cabin} | ${job.meta.persona} | ${job.meta.tripType}`);
    });
    return;
  }

  let success = 0;
  let failed = 0;
  let totalResults = 0;

  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
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
