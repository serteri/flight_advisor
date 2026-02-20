/**
 * Test AeroDataBox Integration (CommonJS for quick testing)
 */

require('dotenv').config();

async function getFlightStatus(flightNumber, date) {
    const RAPID_API_KEY = process.env.RAPID_API_KEY;
    const RAPID_API_HOST = process.env.RAPID_API_HOST_AERODATABOX;
    
    console.log('[DEBUG] API Key:', RAPID_API_KEY ? `${RAPID_API_KEY.slice(0, 10)}...` : 'MISSING');
    console.log('[DEBUG] API Host:', RAPID_API_HOST || 'MISSING');
    
    if (!RAPID_API_KEY || !RAPID_API_HOST) {
        throw new Error('AeroDataBox API credentials not configured');
    }
    
    const url = `https://${RAPID_API_HOST}/flights/number/${flightNumber}/${date}`;
    console.log(`[AeroDataBox] URL: ${url}`);
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': RAPID_API_KEY,
            'X-RapidAPI-Host': RAPID_API_HOST
        }
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AeroDataBox] HTTP ${response.status}:`, errorText);
        throw new Error(`API Error (${response.status}): ${errorText}`);
    }
    
    const responseText = await response.text();
    console.log('[AeroDataBox] Raw Response Text:');
    console.log(responseText);
    console.log('[AeroDataBox] Response Headers:', Object.fromEntries(response.headers.entries()));
    
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        console.error('[AeroDataBox] JSON Parse Error:', e.message);
        console.error('Response was:', responseText.slice(0, 500));
        throw new Error('Failed to parse JSON response');
    }
    
    console.log('[AeroDataBox] ✅ PARSED DATA:');
    console.log(JSON.stringify(data, null, 2));
    
    return data;
}

async function main() {
    console.log('🔬 Testing AeroDataBox...\n');
    
    // Try today's date (more likely to have data)
    const testDate = new Date();
    const dateStr = testDate.toISOString().split('T')[0];
    
    console.log(`Testing TK15 (IST-JFK) on ${dateStr}...\n`);
    
    try {
        const result = await getFlightStatus('TK15', dateStr);
        console.log('\n✅ Success! Flight data retrieved.');
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        // Try alternative flight
        console.log('\n🔄 Trying alternative: LH400 (FRA-JFK)...\n');
        try {
            const result2 = await getFlightStatus('LH400', dateStr);
            console.log('\n✅ Success with LH400!');
        } catch (error2) {
            console.error('❌ Also failed:', error2.message);
        }
    }
}

main();
