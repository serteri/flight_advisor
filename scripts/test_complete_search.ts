import dotenv from 'dotenv';
dotenv.config();
import { searchAllProviders } from '@/services/search/searchService';

async function testLocalSearch() {
  console.log('🧪 Testing complete search pipeline locally...\n');

  const results = await searchAllProviders({
    origin: 'BNE',
    destination: 'IST',
    date: '2026-03-15',
    adults: 1,
    children: 0,
    infants: 0,
    cabin: 'economy',
    currency: 'USD'
  });

  console.log(`\n✅ TOTAL RESULTS: ${results.length}`);

  // Group by source
  const bySource: Record<string, any[]> = {};
  results.forEach(r => {
    const source = r.source || 'unknown';
    if (!bySource[source]) bySource[source] = [];
    bySource[source].push(r);
  });

  console.log('\n📊 Results by source:');
  Object.entries(bySource).forEach(([source, flights]) => {
    console.log(`   ${source}: ${flights.length}`);
  });

  console.log('\n💡 Sample flights:');
  results.slice(0, 3).forEach((f, i) => {
    console.log(`   [${i+1}] ${f.airline} - $${f.price} ${f.currency} (${f.source})`);
  });
}

testLocalSearch().catch(console.error);
