#!/usr/bin/env node
/**
 * Test SerpAPI directly to debug why it returns 0 flights in the UI
 */

const API_KEY = process.env.SERPAPI_KEY;

if (!API_KEY) {
  console.error('Missing SERPAPI_KEY in .env');
  process.exit(1);
}

async function testSerpAPI() {
  console.log('\n🔍 Testing SerpAPI Direct Connection\n');
  
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.append('engine', 'google_flights');
  url.searchParams.append('departure_id', 'NYC');
  url.searchParams.append('arrival_id', 'LHR');
  url.searchParams.append('outbound_date', '2026-04-01');
  url.searchParams.append('currency', 'USD');
  url.searchParams.append('gl', 'us');
  url.searchParams.append('hl', 'en');
  url.searchParams.append('api_key', API_KEY);
  url.searchParams.append('deep_search', 'true');

  try {
    console.log(`📡 Fetching from: ${url.toString().split('?')[0]}`);
    console.log(`   Query: NYC -> LHR (2026-04-01)\n`);

    const response = await fetch(url.toString());
    const json = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Keys:', Object.keys(json).slice(0, 20));

    if (json.error) {
      console.error('❌ SerpAPI Error:', json.error);
      return;
    }

    const bestCount = json.best_flights?.length || 0;
    const otherCount = json.other_flights?.length || 0;
    const flightsCount = json.flights?.length || 0;

    console.log('\n📊 Available Flight Arrays:');
    console.log(`   best_flights: ${bestCount} items`);
    console.log(`   other_flights: ${otherCount} items`);
    console.log(`   flights: ${flightsCount} items`);

    const total = bestCount + otherCount + flightsCount;
    console.log(`\n   ✅ TOTAL: ${total} flights`);

    if (bestCount > 0) {
      console.log('\n📝 Sample from best_flights[0]:');
      console.log('  -', JSON.stringify(json.best_flights[0], null, 2).split('\n').slice(0, 10).join('\n  - '));
    }

  } catch (error) {
    console.error('❌ Fetch Error:', error.message);
  }

  console.log('\n');
}

testSerpAPI();
