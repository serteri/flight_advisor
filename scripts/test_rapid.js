
const https = require('https');

const options = {
    method: 'GET',
    hostname: 'flights-scraper-real-time.p.rapidapi.com',
    port: null,
    path: '/flights/search-oneway?originSkyId=IST&destinationSkyId=LHR&date=2026-05-01&cabinClass=economy&adults=1&currency=USD',
    headers: {
        'x-rapidapi-key': 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000',
        'x-rapidapi-host': 'flights-scraper-real-time.p.rapidapi.com'
    }
};

const req = https.request(options, function (res) {
    const chunks = [];

    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    res.on('data', function (chunk) {
        chunks.push(chunk);
    });

    res.on('end', function () {
        const body = Buffer.concat(chunks);
        try {
            const json = JSON.parse(body.toString());
            console.log("JSON PARSED SUCCESS:");
            // Print first itinerary if exists
            if (json.data && json.data.itineraries && json.data.itineraries.length > 0) {
                console.log(`Found ${json.data.itineraries.length} flights.`);
                console.log("First Flight Preview:", JSON.stringify(json.data.itineraries[0], null, 2).substring(0, 500) + "...");
            } else if (json.status === false || json.message) {
                console.log("API ERROR MESSAGE:", json.message || json);
            } else {
                console.log("Structure might be different:", Object.keys(json));
                console.log("Full Response:", body.toString());
            }
        } catch (e) {
            console.log("RAW BODY (Not JSON):", body.toString());
        }
    });
});

req.on('error', (e) => {
    console.error("REQUEST ERROR:", e);
});

req.end();
