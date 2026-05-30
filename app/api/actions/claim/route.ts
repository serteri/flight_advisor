import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateClaimPDF } from '@/services/legal/pdfGenerator';
// import { sendEmailWithAttachment } from '@/services/notifications/sender'; // (Varsayımsal sender fonksiyonu)

export async function POST(req: Request) {
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
                user: { select: { name: true } }
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

        const amount = delayMinutes && delayMinutes >= 180
            ? '600 EUR'
            : delayMinutes && delayMinutes >= 120
                ? '400 EUR'
                : delayMinutes && delayMinutes >= 60
                    ? '250 EUR'
                    : 'Unknown amount';

        const tripData = {
            userName: trip.user?.name || session.user.name || 'Passenger',
            pnr: trip.pnr,
            flightNumber: `${firstSegment.airlineCode}${firstSegment.flightNumber}`,
            date: firstSegment.departureDate.toLocaleDateString('en-GB'),
            route: `${firstSegment.origin} -> ${firstSegment.destination}`,
            delayDuration,
            amount,
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
        console.log(`[ACTION] Sending email to airline for PNR: ${tripData.pnr}...`);

        // await sendEmailWithAttachment(...) 

        // 4. Veritabanında durumu güncelle
        // await prisma.guardianAlert.update({ where: { ... }, data: { isActioned: true, status: 'SENT' }})

        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="claim-${trip.id}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });

    } catch (error) {
        console.error('[CLAIM_ACTION] Failed to process claim:', error);
        return NextResponse.json({ success: false, error: 'Failed to process claim' }, { status: 500 });
    }
}
