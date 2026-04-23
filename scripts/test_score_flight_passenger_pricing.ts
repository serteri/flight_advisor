import { NextRequest } from 'next/server';

import { POST } from '@/app/api/score-flight/route';

const payload = {
  mode: 'detailed' as const,
  totalPrice: 1200,
  currency: 'USD',
  cabin: 'economy' as const,
  adults: 1,
  children: 1,
  infants: 0,
  segments: [
    {
      from: 'IST',
      to: 'SIN',
      departureDateTime: '2026-07-15T13:10:00.000Z',
      arrivalDateTime: '2026-07-16T04:55:00.000Z',
      airline: 'Singapore Airlines',
      flightNumber: 'SQ391',
    },
  ],
};

const request = new NextRequest('http://localhost/api/score-flight', {
  method: 'POST',
  body: JSON.stringify(payload),
  headers: {
    'content-type': 'application/json',
  },
});

async function main() {
  const response = await POST(request);
  const data = await response.json();

  console.log(JSON.stringify({
    price: data.price,
    passengerPricingContext: data.passengerPricingContext,
    recommendationExplanation: data.recommendationExplanation,
    confidenceInputs: data.confidenceInputs,
  }, null, 2));

  if (response.status !== 200) {
    throw new Error(`Expected 200 response, received ${response.status}: ${JSON.stringify(data)}`);
  }

  if (data.price !== 1200) {
    throw new Error(`Expected response to preserve total price 1200, received ${data.price}`);
  }

  if (!data.passengerPricingContext) {
    throw new Error('Expected passengerPricingContext in response');
  }

  if (data.passengerPricingContext.comparablePerTravelerPrice !== 600) {
    throw new Error(`Expected comparablePerTravelerPrice to be 600, received ${data.passengerPricingContext.comparablePerTravelerPrice}`);
  }

  if (!data.passengerPricingContext.mixedTravelerTypes) {
    throw new Error('Expected mixedTravelerTypes to be true for 1 adult + 1 child');
  }

  const missingFactors = data.recommendationExplanation?.missingFactors || [];
  if (!missingFactors.some((value: string) => /multiple travelers/i.test(value))) {
    throw new Error(`Expected recommendation explanation to mention multiple travelers, received ${JSON.stringify(missingFactors)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});