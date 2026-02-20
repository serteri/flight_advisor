/**
 * Test AeroDataBox Integration
 * Tests real-time flight status fetching
 */

import { getFlightStatus } from '../services/flightStatusService';

async function main() {
    console.log('🔬 Testing AeroDataBox Flight Status Service...\n');
    
    // Test with Turkish Airlines flight (adjust date to today or upcoming)
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1); // Tomorrow
    const dateStr = testDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log(`Testing with flight TK1999 on ${dateStr}...\n`);
    
    const result = await getFlightStatus('TK1999', dateStr);
    
    if ('error' in result) {
        console.error('❌ Error:', result.message);
        console.error('Code:', result.code);
    } else {
        console.log('✅ Flight Status Retrieved:');
        console.log(`Flight: ${result.flightNumber}`);
        console.log(`Status: ${result.status}`);
        console.log(`Departure: ${result.scheduledDeparture} → ${result.actualDeparture || 'Not departed yet'}`);
        console.log(`Arrival: ${result.scheduledArrival} → ${result.actualArrival || result.estimatedArrival || 'TBD'}`);
        
        if (result.departureDelayMinutes) {
            console.log(`⏱️ Departure Delay: ${result.departureDelayMinutes} minutes`);
        }
        
        if (result.arrivalDelayMinutes) {
            console.log(`⏱️ Arrival Delay: ${result.arrivalDelayMinutes} minutes`);
        }
        
        if (result.isEU261Eligible) {
            console.log(`\n🚨 EU261 COMPENSATION ELIGIBLE!`);
            console.log(`💰 Potential Amount: €${result.compensationAmount}`);
        }
        
        console.log('\n📋 Full Status Object:');
        console.log(JSON.stringify(result, null, 2));
    }
}

main().catch(console.error);
