// app/api/webhooks/email/route.ts
import { NextResponse } from 'next/server';
import { parseFlightEmail } from '@/lib/parser/aiParser';
import { prisma } from '@/lib/prisma';

/**
 * Resend Email Webhook Handler
 * Receives forwarded flight confirmation emails and auto-adds to Guardian
 */
export async function POST(req: Request) {
    try {
        // 1. Parse Resend webhook payload
        const payload = await req.json();

        const {
            from,
            to,
            subject,
            html,
            text
        } = payload;

        console.log('📧 Incoming email:', { from, to, subject });

        // 2. Security: Verify email domain (only accept from checkin@flightagent.io)
        if (!to?.includes('checkin@flightagent.io')) {
            return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
        }

        // 3. Extract user from "from" email
        // Format: user+unique@gmail.com → find user by email
        const userEmail = from?.split('<')[1]?.split('>')[0] || from;

        const user = await prisma.user.findUnique({
            where: { email: userEmail }
        });

        if (!user) {
            console.warn('⚠️ User not found:', userEmail);
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 4. AI Parse Email Content (prefer HTML, fallback to text)
        const emailContent = html || text || '';
        const userLanguage = user.locale || 'en';

        const parsedFlight = await parseFlightEmail(emailContent, userLanguage);

        if (!parsedFlight) {
            console.error('❌ AI parsing failed');
            return NextResponse.json({ error: 'Could not parse flight details' }, { status: 422 });
        }

        // 5. Auto-add to Guardian (MonitoredTrip)
        const hasJuniorPassenger = parsedFlight.passengers.some(
            p => p.type === 'CHILD' || p.type === 'INFANT'
        );

        const monitoredTrip = await prisma.monitoredTrip.create({
            data: {
                userId: user.id,
                pnr: parsedFlight.pnr!,
                routeLabel: `${parsedFlight.origin} → ${parsedFlight.destination}`,
                originalPrice: parsedFlight.price || 0,
                currency: parsedFlight.currency || 'AUD',
                ticketClass: 'ECONOMY', // Default

                // Enable relevant modules
                watchDelay: true,
                watchSchedule: true,
                watchUpgrade: true,
                watchSeat: hasJuniorPassenger, // Auto-enable Seat Spy for children

                status: 'ACTIVE'
            }
        });

        // 6. Create Flight segment
        await prisma.flight.create({
            data: {
                monitoredTripId: monitoredTrip.id,
                carrier: parsedFlight.airlineCode!,
                flightNumber: parsedFlight.flightNumber!,
                origin: parsedFlight.origin!,
                destination: parsedFlight.destination!,
                departureTime: parsedFlight.departureTime!,
                arrivalTime: parsedFlight.arrivalTime!,
                status: 'SCHEDULED',
                delayMinutes: 0
            }
        });

        console.log('✅ Guardian activated:', {
            tripId: monitoredTrip.id,
            pnr: parsedFlight.pnr,
            hasJuniorPassenger
        });

        // 7. Send confirmation email to user (optional)
        // await sendConfirmationEmail(user.email, parsedFlight);

        return NextResponse.json({
            success: true,
            tripId: monitoredTrip.id,
            pnr: parsedFlight.pnr,
            message: hasJuniorPassenger
                ? '👦 Flight added with Junior Guardian active!'
                : '✅ Flight successfully added to Guardian'
        });

    } catch (error) {
        console.error('🚨 Email webhook error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
