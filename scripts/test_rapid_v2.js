
const https = require('https');

const options = {
    method: 'GET',
    hostname: 'flights-scraper-real-time.p.rapidapi.com',
    port: null,
    path: '/api/v1/flights/searchFlights?originSkyId=IST&destinationSkyId=LHR&date=2025-05-01&cabinClass=economy&adults=1&currency=USD',
    headers: {
        'x-rapidapi-key': 'a5019e6badmsh72c554c174620e5p18995ajsnd5606f30e000',
        'x-rapidapi-host': 'flights-scraper-real-time.p.rapidapi.com'
    }
};

const req = https.request(options, function (res) {
    const chunks = [];

    console.log(`STATUS: ${res.statusCode}`);

    res.on('data', function (chunk) {
        chunks.push(chunk);
    });

    res.on('end', function () {
        const body = Buffer.concat(chunks);
        console.log(body.toString());
    });
});

req.end();
