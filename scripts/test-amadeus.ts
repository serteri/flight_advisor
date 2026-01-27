
import { getAmadeusClient } from '../lib/amadeus';
import dotenv from 'dotenv';

dotenv.config();

async function testAmadeus() {
    try {
        const client = getAmadeusClient();

        console.log("Testing City Search for 'BRISBANE'...");
        const brisbane = await client.searchCity('BRISBANE');
        console.log('Brisbane Results:', JSON.stringify(brisbane, null, 2));

        console.log("\nTesting City Search for 'BNE'...");
        const bne = await client.searchCity('BNE');
        console.log('BNE Results:', JSON.stringify(bne, null, 2));

        // Test Geolocation (Approx. Brisbane Coordinates: -27.4705, 153.0260)
        console.log("\nTesting Nearest Airport for Brisbane (-27.47, 153.02)...");
        const nearest = await client.getNearestAirport(-27.4705, 153.0260);
        console.log('Nearest Airport Results:', JSON.stringify(nearest, null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAmadeus();
