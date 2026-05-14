import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { generateItineraryAdvisorPDF } from '@/services/reports/itineraryPdf';

export const runtime = 'nodejs';

const reportSectionSchema = z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    bullets: z.array(z.string()).default([]),
});

const payloadSchema = z.object({
    decision: z.enum(['BUY', 'WAIT', 'WATCH']),
    generatedAt: z.string().optional(),
    scoreTrust: z.object({
        reliabilityLabel: z.string().optional(),
        reliabilityTier: z.string().optional(),
        reliabilityExplanation: z.string().optional(),
        dataSourceDisclosure: z.object({
            marketData: z.string().optional(),
            priceInput: z.string().optional(),
            baggageInput: z.string().optional(),
        }).optional(),
    }),
    trackingPayload: z.object({
        trip: z.object({
            origin: z.string().optional(),
            destination: z.string().optional(),
            departureDate: z.string().optional(),
            price: z.number().optional(),
            currency: z.string().optional(),
            cabin: z.string().optional(),
            stops: z.number().optional(),
            totalDurationMinutes: z.number().optional(),
        }).optional(),
        segments: z.array(z.object({
            from: z.string().optional(),
            to: z.string().optional(),
            departureDateTime: z.string().optional(),
            arrivalDateTime: z.string().optional(),
            airline: z.string().optional(),
            flightNumber: z.string().optional(),
            aircraft: z.string().optional(),
        })).optional(),
    }),
    premiumReport: z.object({
        executiveSummary: reportSectionSchema,
        tripOverview: reportSectionSchema,
        recommendationSummary: reportSectionSchema,
        reliabilityAndVerification: reportSectionSchema,
        routeAndConnectionAnalysis: reportSectionSchema,
        airlineAndAircraftAnalysis: reportSectionSchema,
        baggageAndFareConditions: reportSectionSchema,
        riskAndDisruptionExposure: reportSectionSchema,
        comfortAndFatigueAnalysis: reportSectionSchema,
        pricingContext: reportSectionSchema,
        keyRisks: reportSectionSchema,
        whatWouldImproveThisItinerary: reportSectionSchema,
        finalRecommendation: reportSectionSchema,
    }),
});

export async function POST(request: NextRequest) {
    try {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({
                error: 'Invalid JSON payload',
                issues: [{ path: 'body', message: 'Request body must be valid JSON.' }],
            }, { status: 400 });
        }

        const payload = payloadSchema.parse(body);
        const pdfBuffer = await generateItineraryAdvisorPDF(payload);
        if (!pdfBuffer.byteLength) {
            throw new Error('PDF renderer returned an empty buffer');
        }

        const origin = payload.trackingPayload?.trip?.origin || 'TRIP';
        const destination = payload.trackingPayload?.trip?.destination || 'REPORT';
        const fileName = `advisor-report-${origin}-${destination}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': String(pdfBuffer.byteLength),
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json({
                error: 'Invalid report payload',
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            }, { status: 400 });
        }

        console.error('[REPORT_PDF] Failed to generate advisor PDF:', error);
        return NextResponse.json({ error: 'Failed to generate advisor PDF' }, { status: 500 });
    }
}
