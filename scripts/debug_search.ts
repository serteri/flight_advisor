
import dotenv from 'dotenv';
import { duffel } from '../lib/duffel'; // Adjust path
import { mapDuffelToPremiumAgent } from '../lib/parser/duffelMapper'; // Adjust path
// Mocking RapidAPI call locally or importing if possible. 
// Since RapidAPI is a service function, I can try to import it if I use ts-node or similar.
// For simplicity, I will use fetch directly here to emulate RapidAPI if the import is tricky.
import { searchRapidApi } from '../services/search/providers/rapidapi';

dotenv.config({ path: '.env' });

async function testSearch() {
    const origin = 'BNE';
    const destination = 'IST';
    const date = '2026-03-08';

    console.log(`Testing Search: ${origin} -> ${destination} on ${date}`);
    console.log(`Duffel Token: ${process.env.DUFFEL_ACCESS_TOKEN ? 'Set' : 'Missing'}`);
    console.log(`RapidAPI Key: ${process.env.RAPID_API_KEY ? 'Set' : 'Missing'}`);

    try {
        console.log('--- DUFFEL CHECK ---');
        const duffelStart = Date.now();
        const duffelRes = await duffel.offerRequests.create({
            slices: [{
                origin,
                destination,
                departure_date: date
            }],
            passengers: [{ type: "adult" }],
            cabin_class: "economy"
        } as any) as any;
        console.log(`Duffel Status: ${duffelRes.status}`);
        console.log(`Duffel Offers: ${duffelRes.data.offers.length}`);
        console.log(`Duffel Time: ${Date.now() - duffelStart}ms`);

    } catch (error: any) {
        console.error('Duffel Error:', error.message || error);
        if (error.meta) console.error('Duffel Meta:', JSON.stringify(error.meta));
    }

    try {
        console.log('\n--- RAPID API CHECK ---');
        const rapidStart = Date.now();
        const rapidRes = await searchRapidApi({ origin, destination, date });
        console.log(`RapidAPI Offers: ${rapidRes.length}`);
        console.log(`RapidAPI Time: ${Date.now() - rapidStart}ms`);
    } catch (error: any) {
        console.error('RapidAPI Error:', error.message || error);
    }
}

testSearch();
