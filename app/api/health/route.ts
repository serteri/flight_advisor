import { NextResponse } from 'next/server';

// Public endpoint: report only presence of configuration, never any part of a secret.
export async function GET() {
  const checks: Record<string, { ok: boolean; info?: string }> = {};

  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  checks.duffel = { ok: !!duffelToken, info: duffelToken ? 'present' : 'missing' };

  const rapidSky = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  checks.rapidapi_sky = { ok: !!rapidSky, info: rapidSky ? 'present' : 'missing' };

  const dbUrl = process.env.DATABASE_URL;
  checks.database = { ok: !!dbUrl, info: dbUrl ? 'present' : 'missing' };

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json({ healthy: allOk, checks });
}
