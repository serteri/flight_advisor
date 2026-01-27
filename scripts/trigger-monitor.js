
// const fetch = require('node-fetch'); // Native fetch is available in Node 18+

async function trigger() {
    try {
        console.log("Triggering Monitor...");
        const response = await fetch('http://localhost:3000/api/trips/monitor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pnr: 'TEST_PNR_' + Math.floor(Math.random() * 1000),
                airlineCode: 'TK',
                flightNumber: '1984',
                departureDate: new Date(Date.now() + 86400000).toISOString(),
                arrivalDate: new Date(Date.now() + 90000000).toISOString(),
                pricePaid: 1500,
                userId: 'user_clv4123',
                origin: 'IST',
                destination: 'JFK'
            })
        });
        const data = await response.json();
        console.log("Response:", data);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

trigger();
