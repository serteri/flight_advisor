import { NextResponse } from 'next/server';

const mask = (s?: string) => {
  if (!s) return '<missing>';
  if (s.length <= 12) return s;
  return `${s.slice(0, 8)}...${s.slice(-4)}`;
};

const _DUFFEL = process.env.DUFFEL_ACCESS_TOKEN;
const _RAPID = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
try {
  // Log masked presence of critical tokens when this module is initialized.
  // This will appear in server logs when the server instance / function is loaded.
  // eslint-disable-next-line no-console
  console.info('startup: tokens — DUFFEL:', mask(_DUFFEL), 'RAPID_API_SKY:', mask(_RAPID));
} catch (e) {
  // ignore logging errors
}

export async function GET() {
  const checks: Record<string, { ok: boolean; info?: string }> = {};

  // Duffel token
  const duffelToken = process.env.DUFFEL_ACCESS_TOKEN;
  checks.duffel = { ok: !!duffelToken, info: duffelToken ? `masked:${mask(duffelToken)}` : 'missing' };

  // RapidAPI Sky key
  const rapidSky = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  checks.rapidapi_sky = { ok: !!rapidSky, info: rapidSky ? 'present' : 'missing' };

  // Database connectivity quick check (optional)
  const dbUrl = process.env.DATABASE_URL;
  checks.database = { ok: !!dbUrl, info: dbUrl ? 'present' : 'missing' };

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json({ healthy: allOk, checks });
}
