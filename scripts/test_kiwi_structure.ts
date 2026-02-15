import dotenv from 'dotenv';
dotenv.config();

async function testKiwiStructure() {
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
    
    if (items.length === 0) {
      console.log('❌ No items');
      return;
    }

    const item = items[0];
    console.log('🔍 DETAILED STRUCTURE OF FIRST ITEM:');
    console.log('\n1️⃣ PRICING:');
    console.log(`   item.price: ${JSON.stringify(item.price)}`);
    console.log(`   item.price.amount: ${item.price?.amount}`);
    console.log(`   item.priceEur: ${JSON.stringify(item.priceEur)}`);

    console.log('\n2️⃣ DURATION:');
    console.log(`   item.duration: ${item.duration}`);
    console.log(`   item.sector.duration: ${item.sector?.duration}`);

    console.log('\n3️⃣ SEGMENT INFO:');
    const segment = item.sector?.sectorSegments?.[0]?.segment;
    console.log(`   segment: ${!!segment ? '✅ exists' : '❌ missing'}`);
    if (segment) {
      console.log(`   carrier: ${JSON.stringify(segment.marketingCarrier)}`);
      console.log(`   departure: ${segment.source?.localTime}`);
      console.log(`   arrival: ${item.sector?.sectorSegments?.at(-1)?.segment?.destination?.localTime}`);
      console.log(`   stops: ${(item.sector?.sectorSegments?.length || 1) - 1}`);
    }

    console.log('\n4️⃣ BOOKING:');
    console.log(`   bookingOptions: ${!!item.bookingOptions ? '✅ exists' : '❌ missing'}`);
    console.log(`   bookingUrl: ${item.bookingOptions?.edges?.[0]?.node?.bookingUrl}`);
    
    console.log('\n5️⃣ ID & METADATA:');
    console.log(`   id: ${item.id}`);
    console.log(`   provider: ${item.provider}`);

  } catch (error: any) {
    console.error(`🔥 Error: ${error.message}`);
  }
}

testKiwiStructure();
