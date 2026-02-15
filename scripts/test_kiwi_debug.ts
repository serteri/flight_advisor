import dotenv from 'dotenv';
dotenv.config();

async function testKiwiEndpoint() {
  const apiKey = process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com';

  console.log('🔍 Kiwi Real-Time Endpoint Debug Test');
  console.log(`API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`Host: ${apiHost}`);

  if (!apiKey) {
    console.error('❌ RAPID_API_KEY not set');
    return;
  }

  try {
    // Test with verified working endpoint
    const url = `https://${apiHost}/flights/search-oneway`;
    const query = new URLSearchParams({
      originSkyId: 'BNE',
      destinationSkyId: 'IST',
      departureDate: '2026-03-15',
      cabinClass: 'ECONOMY',
      adults: '1',
      currency: 'USD'
    });

    console.log(`\n📡 Fetching: ${url}?${query.toString()}`);
    console.log('⏳ Waiting for response...\n');

    const res = await fetch(`${url}?${query.toString()}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost
      }
    });

    console.log(`📊 Status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const text = await res.text();
      console.error(`❌ Error response:\n${text}`);
      return;
    }

    const json = await res.json();
    console.log(`✅ Response received (${JSON.stringify(json).length} bytes)`);
    console.log('\n🔎 Checking structure:');
    console.log(`- json.data exists: ${!!json.data}`);
    console.log(`- json.data.itineraries exists: ${!!json.data?.itineraries}`);
    console.log(`- json.itineraries exists: ${!!json.itineraries}`);
    console.log(`- Array length (itineraries): ${(json.data?.itineraries || json.itineraries || []).length}`);

    // Show first item structure
    const items = json.data?.itineraries || json.itineraries || json.data || [];
    if (items.length > 0) {
      console.log('\n📦 First item structure (keys):');
      console.log(Object.keys(items[0]).slice(0, 10).join(', '));
      console.log('\n💰 First item (partial):');
      console.log(JSON.stringify(items[0], null, 2).slice(0, 500) + '...');
    } else {
      console.log('\n⚠️ No items in response');
      console.log('Full response:');
      console.log(JSON.stringify(json, null, 2).slice(0, 1000));
    }

  } catch (error: any) {
    console.error(`🔥 Error: ${error.message}`);
    console.error(error.stack);
  }
}

testKiwiEndpoint();
