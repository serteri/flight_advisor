import dotenv from 'dotenv';
import { resolveSkyPlaceIds } from '../services/search/skyPlaceResolver';

dotenv.config();

async function run() {
  const KEY = process.env.RAPID_API_KEY_SKY || process.env.RAPID_API_KEY;
  const HOST = process.env.RAPID_API_HOST_SKY || process.env.RAPID_API_HOST;

  if (!KEY || !HOST) {
    console.error('RAPID_API_KEY_SKY or RAPID_API_KEY and RAPID_API_HOST_SKY must be set in .env');
    process.exit(1);
  }

  const origin = process.argv[2] || 'BNE';
  const dest = process.argv[3] || 'SYD';
  const date = process.argv[4] || new Date().toISOString().slice(0,10);

  console.log('Testing resolver for', origin, '->', dest, 'on', date);
  const res = await resolveSkyPlaceIds(origin, dest, date, KEY as string, HOST as string);
  console.log('Result:', res);
}

run().catch(e => { console.error(e); process.exit(1); });
