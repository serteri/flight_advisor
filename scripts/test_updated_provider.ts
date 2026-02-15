import dotenv from 'dotenv';
dotenv.config();
import { searchSkyScrapper } from '@/services/search/providers/rapidapi';

async function testUpdatedProvider() {
  console.log('🧪 Testing updated Kiwi provider...\n');

  const results = await searchSkyScrapper({
    origin: 'BNE',
    destination: 'IST',
    date: '2026-03-15',
    currency: 'USD',
    cabinClass: 'ECONOMY',
    adults: 1
  });

  console.log(`\n✅ Got ${results.length} flights from Kiwi provider`);

  if (results.length > 0) {
    const first = results[0];
    console.log('\n💡 First flight:');
    console.log(`  Airline: ${first.airline}`);
    console.log(`  Price: $${first.price} ${first.currency}`);
    console.log(`  Score: ${first.score}`);
    console.log(`  Tags: ${first.tags?.join(', ') || 'none'}`);
    console.log(`  Provider: ${first.bookingProviders?.[0]?.name}`);
    console.log(`  Link: ${first.deepLink?.slice(0, 80)}...`);
  }
}

testUpdatedProvider().catch(console.error);
