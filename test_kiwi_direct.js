#!/usr/bin/env node

/**
 * KIWI.COM TEST SCRIPT
 * No API key needed!
 */

const KIWI_API_BASE = 'https://api.tequila.kiwi.com';

(async () => {
  try {
    console.log(`\n🥝 KIWI.COM API TEST`);
    console.log(`====================\n`);

    const url = new URL(`${KIWI_API_BASE}/v2/search`);
    url.searchParams.set('fly_from', 'BNE');
    url.searchParams.set('fly_to', 'IST');
    url.searchParams.set('date_from', '2026/04/17');
    url.searchParams.set('date_to', '2026/04/17');
    url.searchParams.set('adults', '1');
    url.searchParams.set('curr', 'USD');
    url.searchParams.set('limit', '50');
    url.searchParams.set('max_stopovers', '3');
    url.searchParams.set('vehicle_type', 'aircraft');
    url.searchParams.set('sort', 'price');

    console.log(`📡 Request: ${url.toString().substring(0, 100)}...`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Error:`, errText.substring(0, 500));
      process.exit(1);
    }

    const json = await response.json();

    console.log(`Response keys: ${Object.keys(json).join(', ')}`);
    console.log(`Flights found: ${json.data?.length || 0}\n`);

    if (json.data && json.data.length > 0) {
      const sample = json.data[0];
      console.log(`Sample flight:`);
      console.log(`  ID: ${sample.id}`);
      console.log(`  Price: ${sample.price} ${sample.currency}`);
      console.log(`  Airlines: ${sample.airlines?.join(', ')}`);
      console.log(`  Route segments: ${sample.route?.length || 0}`);
      console.log(`  Deep link: ${sample.deep_link}\n`);

      console.log(`✅ Kiwi.com API working! ${json.data.length} flights returned.`);
    } else {
      console.log(`⚠️ No flights found for this route.`);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    process.exit(1);
  }
})();
