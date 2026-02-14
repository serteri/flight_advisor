import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { Duffel } from '@duffel/api';

function maskToken(t?: string) {
  if (!t) return '<missing>';
  return t.slice(0, 8) + '...' + t.slice(-4);
}

async function check() {
  const token = process.env.DUFFEL_ACCESS_TOKEN;
  console.log('DUFFEL token (masked):', maskToken(token));

  if (!token) {
    console.error('No DUFFEL_ACCESS_TOKEN found in environment');
    process.exit(1);
  }

  const client = new Duffel({ token });

  try {
    // Minimal probe: create an offer request with impossible but valid structure to provoke auth response
    const res = await client.offerRequests.create({
      slices: [{ origin: 'BNE', destination: 'SYD', departure_date: '2026-03-08' }],
      passengers: [{ type: 'adult' }],
      cabin_class: 'economy'
    } as any) as any;

    console.log('Probe success:', !!res?.data?.offers?.length, 'offers:', res.data.offers.length);
  } catch (err: any) {
    console.error('Duffel probe failed:');
    if (err?.meta) console.error(' meta:', err.meta);
    if (err?.errors) console.error(' errors:', err.errors);
    console.error(' message:', err?.message || err);
    process.exit(2);
  }
}

check();
