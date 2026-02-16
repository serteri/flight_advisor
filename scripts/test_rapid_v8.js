
const https = require('https');

const options = {
    method: 'GET',
    hostname: 'flights-scraper-real-time.p.rapidapi.com',
    port: null,
    path: '/flights/auto-complete?query=LHR',
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
        try {
            const json = JSON.parse(body.toString());
            if (json.data && json.data.edges && json.data.edges.length > 0) {
                json.data.edges.slice(0, 5).forEach(item => {
                    console.log(`Name: ${item.name}, ID: ${item.id}, LegacyID: ${item.legacyId}, Code: ${item.code}, Type: ${item.__typename}`);
                });
            } else {
                console.log("No data found");
            }
        } catch (e) {
            console.log("Error:", e);
        }
    });
});
req.end();
