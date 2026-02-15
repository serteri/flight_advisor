import dotenv from 'dotenv';
dotenv.config();

async function testKiwiProvider() {
  const apiKey = process.env.RAPID_API_KEY;
  const apiHost = 'flights-scraper-real-time.p.rapidapi.com';

  if (!apiKey) return;

  try {
    const url = `https://${apiHost}/flights/search-oneway`;
    const query = new URLSearchParams({
      originSkyId: 'BNE',
      destinationSkyId: 'IST',
      departureDate: '2026-03-15',
      cabinClass: 'ECONOMY',
      adults: '1',
      currency: 'USD'
    });

    const res = await fetch(`${url}?${query.toString()}`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': apiHost
      }
    });

    if (!res.ok) return;

    const json = await res.json();
    const items = json.data?.itineraries || [];
    
    if (items.length === 0) return;

    const item = items[0];
    console.log('🔍 CARRIER & FLIGHT INFO:');
    console.log('\nProviders array:');
    if (Array.isArray(item.provider)) {
      item.provider.forEach((p: any, idx: number) => {
        console.log(`  [${idx}] ${JSON.stringify(p, null, 2)}`);
      });
    } else {
      console.log(`  ${JSON.stringify(item.provider, null, 2)}`);
    }

    console.log('\nSegment structure:');
    const segment = item.sector?.sectorSegments?.[0]?.segment;
    if (segment) {
      console.log(`  Keys: ${Object.keys(segment).slice(0, 15).join(', ')}`);
      console.log(`  marketingCarrier: ${JSON.stringify(segment.marketingCarrier)}`);
      console.log(`  operatingCarrier: ${JSON.stringify(segment.operatingCarrier)}`);
      console.log(`  airline: ${JSON.stringify(segment.airline)}`);
    }

    // Also check all segments
    console.log(`\nAll segment carriers:`);
    const allSegments = item.sector?.sectorSegments || [];
    allSegments.forEach((seg: any, idx: number) => {
      const s = seg?.segment;
      console.log(`  Leg ${idx}: ${s?.marketingCarrier?.code || s?.operatingCarrier?.code || 'N/A'} - ${s?.airline?.code || 'N/A'}`);
    });

  } catch (error: any) {
    console.error(`🔥 Error: ${error.message}`);
  }
}

testKiwiProvider();
