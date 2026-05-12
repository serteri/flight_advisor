import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { POST as scoreFlightPost } from '../app/api/score-flight/route';
import { POST as reportPdfPost } from '../app/api/score-flight/report-pdf/route';
import type { ItineraryScoreInput } from '../lib/manualFlightToUnifiedFlight';

const istBneSample = `Istanbul (IST) -> Brisbane (BNE)
Round trip | 1 adult | Economy | AUD 3200 total | Fare includes 30 kg checked baggage

OUTBOUND
Turkish Airlines TK54
IST -> SIN | Tue 10 Jun 2026 | Departs 02:00 -> Arrives 17:45
Aircraft: Boeing 777-300ER

Singapore Airlines SQ245
SIN -> BNE | Tue 10 Jun 2026 | Departs 20:10 -> Arrives Wed 11 Jun 05:55
Aircraft: Airbus A350-900

INBOUND
Singapore Airlines SQ246
BNE -> SIN | Wed 15 Jul 2026 | Departs 23:50 -> Arrives Thu 16 Jul 05:45
Aircraft: Airbus A350-900

Turkish Airlines TK55
SIN -> IST | Thu 16 Jul 2026 | Departs 08:15 -> Arrives 14:10
Aircraft: Boeing 777-300ER`;

const requiredSections = [
    'executiveSummary',
    'tripOverview',
    'recommendationSummary',
    'reliabilityAndVerification',
    'routeAndConnectionAnalysis',
    'airlineAndAircraftAnalysis',
    'baggageAndFareConditions',
    'riskAndDisruptionExposure',
    'comfortAndFatigueAnalysis',
    'pricingContext',
    'keyRisks',
    'whatWouldImproveThisItinerary',
    'finalRecommendation',
] as const;

const estimatePageCount = (buffer: Buffer): number => {
    const matches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : 0;
};

(async () => {
    const scoringPayload: ItineraryScoreInput = {
        mode: 'paste',
        itineraryText: istBneSample,
        adults: 1,
        children: 0,
        infants: 0,
        checkedBaggageKg: 30,
    };

    const scoreResponse = await scoreFlightPost({ json: async () => scoringPayload } as any);
    if (!scoreResponse.ok) {
        const text = await scoreResponse.text();
        throw new Error(`Score route failed (${scoreResponse.status}): ${text}`);
    }
    const scoreResult = await scoreResponse.json();

    const reportPayload = {
        decision: scoreResult.decision,
        scoreTrust: scoreResult.scoreTrust,
        trackingPayload: scoreResult.trackingPayload,
        premiumReport: scoreResult.premiumReport,
        generatedAt: new Date().toISOString(),
    };

    const missingSections = requiredSections.filter((key) => !scoreResult?.premiumReport?.[key]);
    if (missingSections.length > 0) {
        throw new Error(`premiumReport missing required sections: ${missingSections.join(', ')}`);
    }

    const pdfResponse = await reportPdfPost({ json: async () => reportPayload } as any);
    if (!pdfResponse.ok) {
        const text = await pdfResponse.text();
        throw new Error(`PDF route failed (${pdfResponse.status}): ${text}`);
    }

    const arr = await pdfResponse.arrayBuffer();
    const pdfBuffer = Buffer.from(arr);

    const outputDir = join(process.cwd(), 'output', 'reports');
    await mkdir(outputDir, { recursive: true });

    const outputPath = join(outputDir, 'ist-bne-advisor-report.pdf');
    await writeFile(outputPath, pdfBuffer);

    const pageCount = estimatePageCount(pdfBuffer);
    const kbSize = (pdfBuffer.byteLength / 1024).toFixed(1);

    console.log('Sample PDF generated successfully');
    console.log(`- File: ${outputPath}`);
    console.log(`- Size: ${kbSize} KB`);
    console.log(`- Estimated page count: ${pageCount}`);
    console.log(`- Section completeness: ${requiredSections.length - missingSections.length}/${requiredSections.length}`);
    console.log(`- Recommendation: ${scoreResult.decision}`);
    console.log(`- Reliability: ${scoreResult.scoreTrust?.reliabilityLabel || 'N/A'}`);
})();
