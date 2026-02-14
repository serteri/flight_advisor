import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, { ok: boolean; info?: string }> = {};

  // Duffel token
  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  checks.duffel = { ok: !!duffelToken, info: duffelToken ? `masked:${duffelToken.slice(0,8)}...${duffelToken.slice(-4)}` : 'missing' };

  // RapidAPI Sky key
  const rapidSky = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  checks.rapidapi_sky = { ok: !!rapidSky, info: rapidSky ? 'present' : 'missing' };

  // Database connectivity quick check (optional)
  const dbUrl = process.env.DATABASE_URL;
  checks.database = { ok: !!dbUrl, info: dbUrl ? 'present' : 'missing' };

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json({ healthy: allOk, checks });
}
