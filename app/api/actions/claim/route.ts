import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateClaimPDF } from '@/services/legal/pdfGenerator';
import { sendEmail } from '@/services/notifications/sender';
import { evaluateCompensation } from '@/lib/compensation/engine';
import { isClaimDocumentUploadEnabled } from '@/lib/featureFlags';
import { formatCompensationAmount, isRealPassengerName } from '@/lib/compensation/claimLetter';

export async function POST(req: Request) {
    // Collects an IBAN — gated with the other personal-document intake.
    if (!isClaimDocumentUploadEnabled()) {
        return NextResponse.json(
            { success: false, error: 'Claim submission is temporarily unavailable.' },
            { status: 503 },
        );
    }

    const session = await auth();
    if (!session?.user?.id && !session?.user?.email) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }

        const { tripId, iban } = body;
        if (!tripId || typeof tripId !== 'string') {
            return NextResponse.json({ success: false, error: 'tripId is required' }, { status: 400 });
        }

        if (!iban || typeof iban !== 'string') {
            return NextResponse.json({ success: false, error: 'iban is required' }, { status: 400 });
        }

        const sessionUserId = session.user.id || (
            session.user.email
                ? (await prisma.user.findUnique({
                    where: { email: session.user.email },
                    select: { id: true }
                }))?.id
                : null
        );

        if (!sessionUserId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const trip = await prisma.monitoredTrip.findUnique({
            where: { id: tripId },
            include: {
                segments: { orderBy: { segmentOrder: 'asc' } },
                snapshot: true,
                passengers: true,
                user: { select: { name: true, email: true } }
            }
        });

        if (!trip) {
            return NextResponse.json({ success: false, error: 'Trip not found' }, { status: 404 });
        }

        if (trip.userId !== sessionUserId) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        const firstSegment = trip.segments[0];
        if (!firstSegment) {
            return NextResponse.json(
                { success: false, error: 'Claim data is not ready: no flight segments on trip' },
                { status: 422 }
            );
        }

        const delayMinutes = trip.snapshot?.delayMinutes ?? null;
        const delayDuration = typeof delayMinutes === 'number' && delayMinutes > 0
            ? `${Math.floor(delayMinutes / 60)} hours ${delayMinutes % 60} minutes`
            : 'Unknown delay duration';

        // Amount comes only from the compensation engine (distance band + scope),
        // never from the delay length.
        const lastSegment = trip.segments[trip.segments.length - 1];
        const compensation = evaluateCompensation({
            disruption: trip.snapshot?.status === 'CANCELLED' ? 'CANCELLATION' : 'DELAY',
            carrierIata: firstSegment.airlineCode,
            originIata: firstSegment.origin,
            finalDestinationIata: lastSegment.destination,
            scheduledDepartureUtc: firstSegment.scheduledDepartureUtc?.toISOString() ?? null,
            arrivalDelayMinutes: delayMinutes,
        });
        const amount = formatCompensationAmount(compensation);
        if (!amount) {
            return NextResponse.json(
                { success: false, error: 'not_likely_eligible', status: compensation.status, reasons: compensation.reasons },
                { status: 422 }
            );
        }

        const passengerName = trip.passengers.find((p) => isRealPassengerName(p.name))?.name
            ?? (isRealPassengerName(trip.user?.name) ? trip.user?.name : null)
            ?? (isRealPassengerName(session.user.name) ? session.user.name : null);
        if (!passengerName) {
            return NextResponse.json(
                { success: false, error: 'passenger_name_required' },
                { status: 422 }
            );
        }

        const tripData = {
            userName: passengerName,
            pnr: trip.pnr || 'UNKNOWN',
            flightNumber: `${firstSegment.airlineCode}${firstSegment.flightNumber}`,
            date: firstSegment.departureDate.toLocaleDateString('en-GB'),
            route: `${firstSegment.origin} -> ${lastSegment.destination}`,
            delayDuration,
            amount,
            regime: compensation.regime,
            iban,
        };

        // 2. ⚖️ PDF DİLEKÇESİNİ OLUŞTUR (Execution)
        const pdfBuffer = await generateClaimPDF(tripData);
        if (!pdfBuffer || pdfBuffer.byteLength === 0) {
            return NextResponse.json({ success: false, error: 'Failed to generate claim PDF' }, { status: 500 });
        }

        // 3. 📤 HAVAYOLUNA E-POSTA AT (Simülasyon)
        // Gerçek hayatta burası: claims@turkishairlines.com olur.
        // Şimdilik test için konsola basıyoruz veya kullanıcıya CC atıyoruz.
        console.log(`[ACTION] PDF Dilekçe Oluşturuldu (${pdfBuffer.byteLength} bytes).`);
        const claimRecipient = process.env.CLAIM_DESTINATION_EMAIL
            || process.env.CLAIMS_DESTINATION_EMAIL
            || session.user.email
            || trip.user?.email
            || null;

        if (!claimRecipient) {
            console.error('[CLAIM_ACTION] No claim email recipient configured or available');
            return NextResponse.json(
                { success: false, error: 'No claim email recipient is configured' },
                { status: 422 }
            );
        }

        const filename = `claim-${trip.id}.pdf`;
        const subject = `EU261 claim package for ${tripData.flightNumber} / PNR ${tripData.pnr}`;

        console.info('[CLAIM_ACTION] Sending claim email', {
            tripId: trip.id,
            recipient: claimRecipient,
            filename,
        });

        const emailResult = await sendEmail(claimRecipient, subject, pdfBuffer, filename);
        if (!emailResult.success) {
            console.error('[CLAIM_ACTION] Claim email delivery failed', {
                tripId: trip.id,
                recipient: claimRecipient,
                error: emailResult.message,
            });
            return NextResponse.json(
                { success: false, error: `Failed to send claim email: ${emailResult.message}` },
                { status: 502 }
            );
        }

        console.info('[CLAIM_ACTION] Claim email delivered', {
            tripId: trip.id,
            recipient: claimRecipient,
            providerMessageId: emailResult.id,
        });

        // 4. Veritabanında durumu güncelle
        // await prisma.guardianAlert.update({ where: { ... }, data: { isActioned: true, status: 'SENT' }})

        const pdfBytes = new Uint8Array(pdfBuffer.byteLength);
        pdfBytes.set(pdfBuffer);
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        return new NextResponse(pdfBlob, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
            },
        });

    } catch (error) {
        console.error('[CLAIM_ACTION] Failed to process claim:', error);
        return NextResponse.json({ success: false, error: 'Failed to process claim' }, { status: 500 });
    }
}
