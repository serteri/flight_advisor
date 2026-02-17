#!/usr/bin/env node
require('dotenv').config();

const OXY_USER = process.env.OXYLABS_USERNAME;
const OXY_PASS = process.env.OXYLABS_PASSWORD;

console.log(`\n🧪 OXYLABS DIRECT API TEST`);
console.log(`===========================`);
console.log(`Username: ${OXY_USER}`);
console.log(`Password: ${OXY_PASS ? 'SET (length=' + OXY_PASS.length + ')' : 'NOT SET'}`);

if (!OXY_USER || !OXY_PASS) {
  console.error(`\n❌ MISSING CREDENTIALS`);
  process.exit(1);
}

const AUTH = Buffer.from(`${OXY_USER}:${OXY_PASS}`).toString('base64');
console.log(`Auth header: Basic ${AUTH.substring(0, 10)}...`);

(async () => {
  try {
    const body = {
      source: 'google_flights',  // Use google_flights, not google_search
      domain: 'com',
      query: 'BNE to IST 2026-04-17',
      parse: true,
      context: [
        { key: 'results_language', value: 'en' },
        { key: 'gl', value: 'au' }
      ]
    };

    console.log(`\n📡 Sending request to Oxylabs...`);
    const response = await fetch('https://realtime.oxylabs.io/v1/queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${AUTH}`
      },
      body: JSON.stringify(body),
      timeout: 30000
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);

    const json = await response.json();

    if (!response.ok) {
      console.error(`\n❌ API Error:`, json);
      process.exit(1);
    }

    // Check response structure
    const results = json.results?.[0];
    console.log(`\n✅ Response received`);
    console.log(`   - Has results array: ${Array.isArray(json.results)}`);
    console.log(`   - First result keys: ${results ? Object.keys(results).slice(0, 10).join(', ') : 'N/A'}`);

    if (results?.content) {
      const content = results.content;
      console.log(`   - Content type: ${typeof content}`);
      console.log(`   - Content keys: ${Object.keys(content).slice(0, 15).join(', ')}`);

      // Check for flights in Oxylabs structure
      let flights = [];
      if (Array.isArray(content.flights)) {
        flights = content.flights;
        console.log(`   - ✅ Found flights in content.flights`);
      } else if (Array.isArray(content.results)) {
        flights = content.results;
        console.log(`   - ✅ Found flights in content.results (${flights.length} items)`);
      } else if (Array.isArray(content.trip_options)) {
        flights = content.trip_options;
        console.log(`   - ✅ Found flights in content.trip_options`);
      } else {
        console.log(`   - ⚠️ No flights array found. Content:`, JSON.stringify(content).substring(0, 500));
      }

      if (flights?.length > 0) {
        console.log(`\n   Sample flight structure:`);
        console.log(JSON.stringify(flights[0], null, 2).substring(0, 800));
      }
    }

    console.log(`\n✅ Test completed successfully\n`);

  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    if (error.response) {
      console.error(`Response:`, error.response);
    }
    process.exit(1);
  }
})();
