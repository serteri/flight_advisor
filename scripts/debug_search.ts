
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { mapDuffelToPremiumAgent } from '../lib/parser/duffelMapper';
import { searchDuffel } from '../services/search/providers/duffel';
import { searchSkyScrapper, searchAirScraper } from '../services/search/providers/rapidapi';
import { searchKiwi } from '../services/search/providers/kiwi';

async function testSearch() {
    const origin = 'BNE';
    const destination = 'IST';
    const date = '2026-03-08';

    console.log(`Testing Search: ${origin} -> ${destination} on ${date}`);

    try {
        console.log('--- DUFFEL CHECK ---');
        const token = process.env.DUFFEL_ACCESS_TOKEN;
        if (!token) {
            console.warn('⚠️ DUFFEL_ACCESS_TOKEN missing — skipping Duffel test');
        } else {
            const duffelStart = Date.now();
            const duffelRes = await searchDuffel({ origin, destination, date } as any);
            console.log(`Duffel Offers: ${duffelRes.length}`);
            console.log(`Duffel Time: ${Date.now() - duffelStart}ms`);
        }
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

    try {
        console.log('\n--- KIWI (Tequila) CHECK ---');
        const kiwiStart = Date.now();
        const kiwiRes = await searchKiwi({ origin, destination, date });
        console.log(`Kiwi Offers: ${kiwiRes.length}`);
        console.log(`Kiwi Time: ${Date.now() - kiwiStart}ms`);
    } catch (error: any) {
        console.error('Kiwi Error:', error.message || error);
    }
}

testSearch();
