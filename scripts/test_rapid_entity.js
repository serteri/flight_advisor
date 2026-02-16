
const https = require('https');

function testSearch(origin, dest, label) {
    const options = {
        method: 'GET',
        hostname: 'flights-scraper-real-time.p.rapidapi.com',
        port: null,
        path: `/flights/search-oneway?originSkyId=${origin}&destinationSkyId=${dest}&date=2026-04-01&cabinClass=ECONOMY&adults=1&currency=USD`,
        headers: {
            'x-rapidapi-key': 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000',
            'x-rapidapi-host': 'flights-scraper-real-time.p.rapidapi.com'
        }
    };

    const req = https.request(options, function (res) {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
            const body = Buffer.concat(chunks);
            console.log(`[${label}] STATUS: ${res.statusCode}`);
            console.log(`[${label}] Full Response:`, body.toString());
        });
    });
    req.end();
}

// Test 1: Entity ID (london_gb)
testSearch('london_gb', 'new-york_ny_us', 'ENTITY_LEGACY');

// Test 2: Station ID (Station:airport:LHR)
testSearch('Station:airport:LHR', 'Station:airport:JFK', 'ENTITY_STATION');
