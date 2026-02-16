
const https = require('https');

const options = {
    method: 'GET',
    hostname: 'flights-scraper-real-time.p.rapidapi.com',
    port: null,
    path: '/flights/auto-complete?query=London',
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
            if (json.data && json.data.edges) {
                json.data.edges.forEach((edge, i) => {
                    const item = edge.node || edge;
                    const name = item.presentation ? item.presentation.title : item.name;
                    const type = item.navigation ? item.navigation.entityType : 'N/A';
                    console.log(`[${i}] Name: ${name}, ID: ${item.entityId}, SkyID: ${item.skyId}, Type: ${type}`);
                });
            } else {
                console.log("No edges:", Object.keys(json));
                if (json.data) console.log("Data keys:", Object.keys(json.data));
            }
        } catch (e) {
            console.log("Error:", e);
        }
    });
});
req.end();
