// Test script to inspect Duffel API response structure
const { Duffel } = require('@duffel/api');

const duffel = new Duffel({
  token: process.env.DUFFEL_ACCESS_TOKEN,
});

async function testDuffelBaggage() {
  try {
    const response = await duffel.offerRequests.create({
      slices: [
        {
          origin: 'BNE',
          destination: 'IST',
          departure_date: '2026-03-24',
        },
      ],
      passengers: [{ type: 'adult' }],
      cabin_class: 'economy',
    });

    console.log('=== DUFFEL OFFER REQUEST RESPONSE ===');
    console.log('Offers count:', response.data.offers.length);
    
    if (response.data.offers.length > 0) {
      const firstOffer = response.data.offers[0];
      console.log('\n=== FIRST OFFER STRUCTURE ===');
      console.log('Offer ID:', firstOffer.id);
      console.log('Total Amount:', firstOffer.total_amount);
      console.log('Total Currency:', firstOffer.total_currency);
      
      console.log('\n=== PASSENGERS ===');
      console.log('Passengers:', JSON.stringify(firstOffer.passengers, null, 2));
      
      console.log('\n=== AVAILABLE SERVICES ===');
      console.log('Available Services:', JSON.stringify(firstOffer.available_services, null, 2));
      
      console.log('\n=== CONDITIONS ===');
      console.log('Conditions:', JSON.stringify(firstOffer.conditions, null, 2));
      
      console.log('\n=== FIRST SLICE ===');
      const firstSlice = firstOffer.slices[0];
      console.log('Segments count:', firstSlice.segments.length);
      console.log('Segments:', JSON.stringify(firstSlice.segments.map(s => ({
        origin: s.origin,
        destination: s.destination,
        carrier: s.operating_carrier,
        passengers: s.passengers
      })), null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.meta) {
      console.error('Meta:', error.meta);
    }
  }
}

testDuffelBaggage();
