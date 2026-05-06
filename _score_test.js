const https = require('http');

const itineraryText = `Istanbul (IST) -> Brisbane (BNE)
Round trip | 1 adult, 1 child | Economy | AUD 3500 total | 30 kg checked baggage

OUTBOUND
Turkish Airlines TK54
IST -> SIN | Tue 10 Jun 2026 | Departs 02:00 -> Arrives 17:45
Aircraft: Boeing 777-300ER

Layover SIN: 2h 25m

Singapore Airlines SQ245
SIN -> BNE | Tue 10 Jun 2026 | Departs 20:10 -> Arrives Wed 11 Jun 05:55
Aircraft: Airbus A350-900

INBOUND
Singapore Airlines SQ246
BNE -> SIN | Wed 15 Jul 2026 | Departs 23:50 -> Arrives Thu 16 Jul 05:45
Aircraft: Airbus A350-900

Layover SIN: 2h 30m

Turkish Airlines TK55
SIN -> IST | Thu 16 Jul 2026 | Departs 08:15 -> Arrives 14:10
Aircraft: Boeing 777-300ER`;

const payload = JSON.stringify({
    mode: 'paste',
    itineraryText,
    price: 3500,
    currency: 'AUD',
    adults: 1,
    children: 1,
    infants: 0,
    cabin: 'economy',
    checkedBaggageKg: 30,
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/score-flight',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
    },
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('HTTP STATUS:', res.statusCode);
        try {
            const parsed = JSON.parse(data);

            // --- Regression assertions for IST→BNE round-trip ---
            const segs = parsed.segments || [];
            const expectedFlights = ['TK54', 'SQ245', 'SQ246', 'TK55'];
            const expectedRoutes = ['IST|SIN', 'SIN|BNE', 'BNE|SIN', 'SIN|IST'];
            let pass = true;

            if (segs.length !== 4) {
                console.error(`FAIL: expected 4 segments, got ${segs.length}`);
                pass = false;
            }
            expectedFlights.forEach((fn, idx) => {
                const seg = segs[idx];
                if (!seg) { console.error(`FAIL: missing segment ${idx}`); pass = false; return; }
                const route = `${seg.from}|${seg.to}`;
                if (seg.flightNumber !== fn) { console.error(`FAIL seg[${idx}]: flightNumber expected ${fn} got ${seg.flightNumber}`); pass = false; }
                if (route !== expectedRoutes[idx]) { console.error(`FAIL seg[${idx}]: route expected ${expectedRoutes[idx]} got ${route}`); pass = false; }
            });
            if (parsed.tripType !== 'ROUND_TRIP') {
                console.error(`FAIL: tripType expected ROUND_TRIP got ${parsed.tripType}`);
                pass = false;
            }
            if (pass) console.log('REGRESSION PASS: 4 segments, correct flights, ROUND_TRIP');

            // Full output
            console.log(JSON.stringify(parsed, null, 2));
        } catch {
            console.log('RAW:', data);
        }
    });
});

req.on('error', (e) => { console.error('ERROR:', e.message); });
req.write(payload);
req.end();
