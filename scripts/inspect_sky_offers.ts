import dotenv from 'dotenv';
dotenv.config();

import { searchSkyScrapper } from '../services/search/providers/rapidapi';

async function run() {
  const origin = process.argv[2] || 'BNE';
  const dest = process.argv[3] || 'IST';
  const date = process.argv[4] || '2026-03-08';

  console.log('Inspecting Sky offers for', origin, '->', dest, date);
  const offers = await searchSkyScrapper({ origin, destination: dest, date });
  console.log('Offers count:', offers.length);
  for (let i = 0; i < Math.min(5, offers.length); i++) {
    const o = offers[i];
    console.log(`\n---- Offer ${i+1} id=${o.id} price=${o.price} ${o.currency}`);
    console.log('bookingProviders sample:', (o.bookingProviders || []).slice(0,6));
    console.log('deepLink:', o.deepLink);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
