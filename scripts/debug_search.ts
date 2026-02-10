
import dotenv from 'dotenv';
import { duffel } from '../lib/duffel';
import { mapDuffelToPremiumAgent } from '../lib/parser/duffelMapper';
import { searchSkyScrapper, searchAirScraper } from '../services/search/providers/rapidapi';

dotenv.config({ path: '.env' });

async function testSearch() {
    const origin = 'BNE';
    const destination = 'IST';
    const date = '2026-03-08';

    console.log(`Testing Search: ${origin} -> ${destination} on ${date}`);

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
    }

    try {
        console.log('\n--- SKY SCRAPPER CHECK ---');
        const skyStart = Date.now();
        const skyRes = await searchSkyScrapper({ origin, destination, date });
        console.log(`Sky Offers: ${skyRes.length}`);
        console.log(`Sky Time: ${Date.now() - skyStart}ms`);
    } catch (error: any) {
        console.error('Sky Error:', error.message || error);
    }

    try {
        console.log('\n--- AIR SCRAPER CHECK ---');
        const airStart = Date.now();
        const airRes = await searchAirScraper({ origin, destination, date });
        console.log(`Air Offers: ${airRes.length}`);
        console.log(`Air Time: ${Date.now() - airStart}ms`);
    } catch (error: any) {
        console.error('Air Error:', error.message || error);
    }
}

testSearch();
