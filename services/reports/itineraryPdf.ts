import PDFDocument from 'pdfkit';

type PremiumReportSection = {
    title: string;
    summary: string;
    bullets: string[];
};

export type PremiumReportPayload = {
    decision?: 'BUY' | 'WAIT' | 'WATCH';
    scoreTrust?: {
        reliabilityLabel?: string;
        reliabilityTier?: string;
        reliabilityExplanation?: string;
        dataSourceDisclosure?: {
            marketData?: string;
            priceInput?: string;
            baggageInput?: string;
        };
    };
    trackingPayload?: {
        trip?: {
            origin?: string;
            destination?: string;
            departureDate?: string;
            price?: number;
            currency?: string;
            cabin?: string;
            stops?: number;
            totalDurationMinutes?: number;
        };
        segments?: Array<{
            from?: string;
            to?: string;
            departureDateTime?: string;
            arrivalDateTime?: string;
            airline?: string;
            flightNumber?: string;
            aircraft?: string;
        }>;
    };
    premiumReport: {
        executiveSummary: PremiumReportSection;
        tripOverview: PremiumReportSection;
        recommendationSummary: PremiumReportSection;
        reliabilityAndVerification: PremiumReportSection;
        routeAndConnectionAnalysis: PremiumReportSection;
        airlineAndAircraftAnalysis: PremiumReportSection;
        baggageAndFareConditions: PremiumReportSection;
        riskAndDisruptionExposure: PremiumReportSection;
        comfortAndFatigueAnalysis: PremiumReportSection;
        pricingContext: PremiumReportSection;
        keyRisks: PremiumReportSection;
        whatWouldImproveThisItinerary: PremiumReportSection;
        finalRecommendation: PremiumReportSection;
    };
    generatedAt?: string;
};

type VerificationBuckets = {
    verified: string[];
    inferred: string[];
    unavailable: string[];
};

const ensureSpace = (doc: PDFKit.PDFDocument, minHeight: number) => {
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    if (doc.y + minHeight > bottomLimit) {
        doc.addPage();
    }
};

const drawPill = (
    doc: PDFKit.PDFDocument,
    text: string,
    x: number,
    y: number,
    opts: { bg: string; color: string },
) => {
    doc.font('Helvetica-Bold').fontSize(9);
    const w = Math.max(68, doc.widthOfString(text) + 16);
    doc.roundedRect(x, y, w, 16, 8).fill(opts.bg);
    doc.fillColor(opts.color).font('Helvetica-Bold').fontSize(9).text(text, x + 8, y + 4);
    return w;
};

const sectionAccent = (title: string): { strip: string; fill: string; title: string } => {
    const key = title.toLowerCase();
    if (key.includes('risk')) return { strip: '#fee2e2', fill: '#fff7f7', title: '#991b1b' };
    if (key.includes('pricing')) return { strip: '#e0e7ff', fill: '#f8faff', title: '#3730a3' };
    if (key.includes('reliability') || key.includes('verification')) return { strip: '#dbeafe', fill: '#f6fbff', title: '#1e3a8a' };
    if (key.includes('final recommendation')) return { strip: '#dcfce7', fill: '#f6fff9', title: '#166534' };
    return { strip: '#e2e8f0', fill: '#ffffff', title: '#1e293b' };
};

const safeDate = (value?: string): string => {
    if (!value) return 'N/A';
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) return 'N/A';
    return new Date(ts).toLocaleString();
};

const parseVerificationBuckets = (section?: PremiumReportSection): VerificationBuckets => {
    const base: VerificationBuckets = { verified: [], inferred: [], unavailable: [] };
    if (!section) return base;

    (section.bullets || []).forEach((raw) => {
        const item = raw.trim();
        const low = item.toLowerCase();
        if (low.startsWith('verified:') || low.startsWith('user provided:')) {
            base.verified.push(item.replace(/^(verified:|user provided:)\s*/i, ''));
            return;
        }
        if (low.startsWith('inferred:') || low.includes('estimated')) {
            base.inferred.push(item.replace(/^inferred:\s*/i, ''));
            return;
        }
        if (low.startsWith('unavailable') || low.includes('uncertain') || low.includes('missing')) {
            base.unavailable.push(item.replace(/^unavailable\/?uncertain:\s*/i, ''));
        }
    });

    return base;
};

const deriveRiskLabel = (section?: PremiumReportSection): 'LOW' | 'MODERATE' | 'HIGH' => {
    const source = `${section?.summary || ''} ${(section?.bullets || []).join(' ')}`.toLowerCase();
    if (/\bhigh\b|fragility|risky|tight/.test(source)) return 'HIGH';
    if (/\bmoderate\b|mixed|limited/.test(source)) return 'MODERATE';
    return 'LOW';
};

const drawHeader = (doc: PDFKit.PDFDocument, payload: PremiumReportPayload) => {
    doc.rect(0, 0, doc.page.width, 130).fill('#0b1120');
    doc.rect(0, 0, doc.page.width, 8).fill('#38bdf8');
    doc.fillColor('#e2e8f0');
    doc.font('Helvetica-Bold').fontSize(10).text('FLIGHT AI | ADVISOR SERIES', 50, 24);
    doc.font('Helvetica-Bold').fontSize(24).text('Premium Itinerary Intelligence Report', 50, 38);

    const trip = payload.trackingPayload?.trip;
    const route = trip?.origin && trip?.destination ? `${trip.origin} -> ${trip.destination}` : 'Itinerary Assessment';
    const recommendation = payload.decision || 'WATCH';
    const reliability = payload.scoreTrust?.reliabilityLabel || 'Reliability Not Available';

    doc.fillColor('#cbd5e1').font('Helvetica').fontSize(11);
    doc.text(`Route: ${route}`, 50, 74);
    doc.text(`Report purpose: Advisor-grade trip evaluation`, 50, 90);

    let pillX = 370;
    const recBg = recommendation === 'BUY' ? '#dcfce7' : recommendation === 'WAIT' ? '#fee2e2' : '#fef3c7';
    const recColor = recommendation === 'BUY' ? '#166534' : recommendation === 'WAIT' ? '#991b1b' : '#92400e';
    pillX += drawPill(doc, `Recommendation: ${recommendation}`, pillX, 74, { bg: recBg, color: recColor }) + 8;
    drawPill(doc, reliability, 370, 94, { bg: '#dbeafe', color: '#1e3a8a' });

    doc.fillColor('#0f172a');
    doc.y = 146;
};

const drawMetaStrip = (doc: PDFKit.PDFDocument, payload: PremiumReportPayload) => {
    const generatedAt = payload.generatedAt || new Date().toISOString();
    const trip = payload.trackingPayload?.trip;
    const priceText = typeof trip?.price === 'number' && trip.currency
        ? `${trip.price.toFixed(2)} ${trip.currency}`
        : 'Price not provided';

    ensureSpace(doc, 60);
    const x = 50;
    const y = doc.y;
    const width = doc.page.width - 100;

    doc.roundedRect(x, y, width, 50, 6).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#334155').font('Helvetica').fontSize(10);
    doc.text(`Generated: ${new Date(generatedAt).toLocaleString()}`, x + 10, y + 8);
    doc.text(`Fare context: ${priceText}`, x + 230, y + 8);
    doc.text(`Cabin: ${(trip?.cabin || 'unknown').toString()}`, x + 10, y + 24);
    doc.text(`Stops: ${typeof trip?.stops === 'number' ? trip.stops : 'N/A'}`, x + 230, y + 24);
    doc.text(`Duration: ${typeof trip?.totalDurationMinutes === 'number' ? `${trip.totalDurationMinutes} min` : 'N/A'}`, x + 430, y + 24);

    doc.y = y + 64;
    doc.fillColor('#0f172a');
};

const drawItineraryTable = (doc: PDFKit.PDFDocument, payload: PremiumReportPayload) => {
    const segments = payload.trackingPayload?.segments || [];
    if (!segments.length) return;

    ensureSpace(doc, 130);
    const x = 50;
    const width = doc.page.width - 100;
    const columns = [x, x + 86, x + 182, x + 292, x + 410, x + 502];

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Itinerary Segment Overview', x, doc.y);
    doc.moveDown(0.25);
    const top = doc.y;

    doc.roundedRect(x, top, width, 22, 4).fill('#eef2ff');
    doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(9);
    doc.text('From', columns[0] + 6, top + 7);
    doc.text('To', columns[1] + 6, top + 7);
    doc.text('Departure', columns[2] + 6, top + 7);
    doc.text('Arrival', columns[3] + 6, top + 7);
    doc.text('Carrier/Flight', columns[4] + 6, top + 7);

    let rowY = top + 26;
    segments.slice(0, 8).forEach((segment, idx) => {
        ensureSpace(doc, 24);
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(x, rowY, width, 20).fillAndStroke(rowBg, '#e2e8f0');
        doc.fillColor('#334155').font('Helvetica').fontSize(8.5);
        doc.text(segment.from || 'N/A', columns[0] + 6, rowY + 6);
        doc.text(segment.to || 'N/A', columns[1] + 6, rowY + 6);
        doc.text(safeDate(segment.departureDateTime), columns[2] + 6, rowY + 6, { width: 102 });
        doc.text(safeDate(segment.arrivalDateTime), columns[3] + 6, rowY + 6, { width: 112 });
        const carrier = `${segment.airline || 'Unknown'} ${segment.flightNumber || ''}`.trim();
        doc.text(carrier, columns[4] + 6, rowY + 6, { width: width - (columns[4] - x) - 12 });
        rowY += 20;
    });

    doc.y = rowY + 8;
};

const drawPricingTable = (doc: PDFKit.PDFDocument, payload: PremiumReportPayload) => {
    const trip = payload.trackingPayload?.trip;
    const disclosure = payload.scoreTrust?.dataSourceDisclosure;

    ensureSpace(doc, 86);
    const x = 50;
    const y = doc.y;
    const width = doc.page.width - 100;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Pricing Summary', x, y);
    const tableY = y + 16;
    doc.roundedRect(x, tableY, width, 58, 5).fillAndStroke('#f8fafc', '#cbd5e1');

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b');
    doc.text('Metric', x + 10, tableY + 8);
    doc.text('Value', x + 210, tableY + 8);

    doc.font('Helvetica').fontSize(9).fillColor('#334155');
    const fare = typeof trip?.price === 'number' && trip.currency ? `${trip.price.toFixed(2)} ${trip.currency}` : 'Not provided';
    doc.text('Total fare input', x + 10, tableY + 24);
    doc.text(fare, x + 210, tableY + 24);
    doc.text('Benchmark source', x + 10, tableY + 40);
    doc.text(disclosure?.marketData || 'Not disclosed', x + 210, tableY + 40);

    doc.y = tableY + 68;
};

const drawVerificationBlocks = (doc: PDFKit.PDFDocument, section: PremiumReportSection) => {
    const buckets = parseVerificationBuckets(section);
    ensureSpace(doc, 96);
    const x = 50;
    const y = doc.y;
    const width = doc.page.width - 100;
    const col = (width - 12) / 3;

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Verification Snapshot', x, y);
    const top = y + 16;

    const block = (
        bx: number,
        title: string,
        bg: string,
        color: string,
        items: string[],
    ) => {
        doc.roundedRect(bx, top, col, 68, 5).fillAndStroke(bg, '#cbd5e1');
        doc.fillColor(color).font('Helvetica-Bold').fontSize(9).text(title, bx + 8, top + 8);
        doc.fillColor('#334155').font('Helvetica').fontSize(8.5);
        const lines = items.length > 0 ? items : ['No explicit item'];
        doc.text(`- ${lines[0]}`, bx + 8, top + 24, { width: col - 16 });
        if (lines[1]) {
            doc.text(`- ${lines[1]}`, bx + 8, top + 38, { width: col - 16 });
        }
    };

    block(x, 'Verified / User-Provided', '#ecfeff', '#155e75', buckets.verified);
    block(x + col + 6, 'Inferred / Estimated', '#fff7ed', '#9a3412', buckets.inferred);
    block(x + (col + 6) * 2, 'Unavailable / Uncertain', '#fef2f2', '#991b1b', buckets.unavailable);

    doc.y = top + 76;
};

const drawSection = (doc: PDFKit.PDFDocument, section: PremiumReportSection, index: number) => {
    ensureSpace(doc, 102);

    const x = 50;
    const width = doc.page.width - 100;
    const titleY = doc.y;
    const accent = sectionAccent(section.title);

    doc.roundedRect(x, titleY, width, 28, 5).fill(accent.strip);
    doc.fillColor(accent.title).font('Helvetica-Bold').fontSize(11);
    doc.text(`${index}. ${section.title}`, x + 10, titleY + 7, { width: width - 20 });

    if (section.title.toLowerCase().includes('risk')) {
        const risk = deriveRiskLabel(section);
        const riskBg = risk === 'HIGH' ? '#fecaca' : risk === 'MODERATE' ? '#fde68a' : '#bbf7d0';
        const riskColor = risk === 'HIGH' ? '#991b1b' : risk === 'MODERATE' ? '#92400e' : '#166534';
        drawPill(doc, `Severity: ${risk}`, x + width - 118, titleY + 6, { bg: riskBg, color: riskColor });
    }

    if (section.title.toLowerCase().includes('recommendation') || section.title.toLowerCase().includes('executive')) {
        const rec = section.summary.match(/\b(BUY|WAIT|WATCH)\b/i)?.[0]?.toUpperCase();
        if (rec) {
            const recBg = rec === 'BUY' ? '#dcfce7' : rec === 'WAIT' ? '#fee2e2' : '#fef3c7';
            const recColor = rec === 'BUY' ? '#166534' : rec === 'WAIT' ? '#991b1b' : '#92400e';
            drawPill(doc, rec, x + width - 60, titleY + 6, { bg: recBg, color: recColor });
        }
    }

    doc.roundedRect(x, titleY + 30, width, 6, 3).fill(accent.fill);

    doc.fillColor('#0f172a').font('Helvetica').fontSize(10.5);
    doc.text(section.summary, x, titleY + 40, {
        width,
        align: 'left',
        lineGap: 3,
    });

    doc.moveDown(0.45);
    (section.bullets || []).slice(0, 8).forEach((bullet) => {
        ensureSpace(doc, 22);
        doc.fillColor('#334155').fontSize(10).text(`- ${bullet}`, x + 8, doc.y, {
            width: width - 8,
            lineGap: 2,
        });
        doc.moveDown(0.22);
    });

    doc.moveDown(0.7);
};

export const generateItineraryAdvisorPDF = (payload: PremiumReportPayload): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 40, left: 50, right: 50, bottom: 46 },
                bufferPages: true,
            });
            const buffers: Buffer[] = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            drawHeader(doc, payload);
            drawMetaStrip(doc, payload);
            drawItineraryTable(doc, payload);
            drawPricingTable(doc, payload);

            drawSection(doc, payload.premiumReport.executiveSummary, 1);
            drawSection(doc, payload.premiumReport.tripOverview, 2);
            drawSection(doc, payload.premiumReport.recommendationSummary, 3);
            drawSection(doc, payload.premiumReport.reliabilityAndVerification, 4);
            drawVerificationBlocks(doc, payload.premiumReport.reliabilityAndVerification);

            const sections: PremiumReportSection[] = [
                payload.premiumReport.routeAndConnectionAnalysis,
                payload.premiumReport.airlineAndAircraftAnalysis,
                payload.premiumReport.baggageAndFareConditions,
                payload.premiumReport.riskAndDisruptionExposure,
                payload.premiumReport.comfortAndFatigueAnalysis,
                payload.premiumReport.pricingContext,
                payload.premiumReport.keyRisks,
                payload.premiumReport.whatWouldImproveThisItinerary,
                payload.premiumReport.finalRecommendation,
            ];

            sections.forEach((section, idx) => drawSection(doc, section, idx + 5));

            const range = doc.bufferedPageRange();
            for (let i = 0; i < range.count; i += 1) {
                doc.switchToPage(i);
                doc.fillColor('#64748b').font('Helvetica').fontSize(9);
                doc.text(`Page ${i + 1} of ${range.count}`, 50, doc.page.height - 30, {
                    width: doc.page.width - 100,
                    align: 'right',
                });
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};
