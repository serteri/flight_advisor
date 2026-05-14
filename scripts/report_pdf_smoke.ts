import { NextRequest } from 'next/server';

import { POST as scoreFlight } from '../app/api/score-flight/route';
import { POST as generateReportPdf } from '../app/api/score-flight/report-pdf/route';

const itineraryText = `Istanbul (IST) -> Brisbane (BNE)
Round trip | 1 adult, 1 child | Economy | AUD 3500 total | 30kg checked baggage

OUTBOUND
Turkish Airlines TK54
IST -> SIN | Tue 10 Jun 2026 | Departs 02:00 -> Arrives 17:45
Aircraft: Boeing 777-300ER

Layover SIN: 2h 25m

Singapore Airlines SQ245
SIN -> BNE | Tue 10 Jun 2026 | Departs 20:10 -> Arrives Wed 11 Jun 2026 05:55
Aircraft: Airbus A350-900

INBOUND
Singapore Airlines SQ246
BNE -> SIN | Wed 15 Jul 2026 | Departs 23:50 -> Arrives Thu 16 Jul 2026 05:45
Aircraft: Airbus A350-900

Layover SIN: 2h 30m

Turkish Airlines TK55
SIN -> IST | Thu 16 Jul 2026 | Departs 08:15 -> Arrives 14:10
Aircraft: Boeing 777-300ER`;

const jsonRequest = (url: string, body: unknown) => new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

async function main() {
    const scoreResponse = await scoreFlight(jsonRequest('http://localhost/api/score-flight', {
        mode: 'paste',
        itineraryText,
        price: 3500,
        currency: 'AUD',
        cabin: 'economy',
        adults: 1,
        children: 1,
        infants: 0,
        checkedBaggageKg: 30,
        refundable: false,
    }));

    if (!scoreResponse.ok) {
        throw new Error(`Score route failed: ${scoreResponse.status} ${await scoreResponse.text()}`);
    }

    const scoreResult = await scoreResponse.json();
    const reportPayload = {
        decision: scoreResult.decision,
        scoreTrust: scoreResult.scoreTrust,
        trackingPayload: scoreResult.trackingPayload,
        premiumReport: scoreResult.premiumReport,
        generatedAt: new Date().toISOString(),
    };

    const pdfResponse = await generateReportPdf(jsonRequest('http://localhost/api/score-flight/report-pdf', reportPayload));
    if (!pdfResponse.ok) {
        throw new Error(`Report PDF route failed: ${pdfResponse.status} ${await pdfResponse.text()}`);
    }

    const contentType = pdfResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/pdf')) {
        throw new Error(`Expected application/pdf response, received ${contentType || 'missing content type'}`);
    }

    const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
    if (pdfBytes.byteLength < 1000 || pdfBytes.subarray(0, 5).toString('utf8') !== '%PDF-') {
        throw new Error(`Invalid PDF output: ${pdfBytes.byteLength} bytes`);
    }

    const invalidResponse = await generateReportPdf(jsonRequest('http://localhost/api/score-flight/report-pdf', {
        decision: scoreResult.decision,
    }));
    if (invalidResponse.status !== 400) {
        throw new Error(`Expected invalid report payload to return 400, received ${invalidResponse.status}`);
    }

    console.log(JSON.stringify({
        status: 'PASS',
        pdfBytes: pdfBytes.byteLength,
        contentType,
        validationStatus: invalidResponse.status,
    }, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
