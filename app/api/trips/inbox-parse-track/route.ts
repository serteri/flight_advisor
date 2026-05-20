import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { parseBookingLikeInput } from '@/lib/parser/bookingParser';
import { autoCreateMonitoredTripFromParsedBooking } from '@/services/guardian/inboxAutoTrack';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            rawText,
            subject,
            messageBody,
            structured,
            autoCreate = true,
        } = body || {};

        const parseResult = parseBookingLikeInput({
            rawText: typeof rawText === 'string' ? rawText : '',
            subject: typeof subject === 'string' ? subject : '',
            body: typeof messageBody === 'string' ? messageBody : '',
            structured: structured && typeof structured === 'object' ? structured : undefined,
        });

        if (!autoCreate) {
            return NextResponse.json({
                success: parseResult.success,
                parseResult,
                autoTrack: {
                    created: false,
                    reason: 'autoCreate=false',
                },
            });
        }

        const autoTrack = await autoCreateMonitoredTripFromParsedBooking({
            userId: session.user.id,
            parseResult,
        });

        return NextResponse.json({
            success: parseResult.success,
            parseResult,
            autoTrack,
        });
    } catch (error) {
        console.error('[INBOX_PARSE_TRACK] Error:', error);
        return NextResponse.json(
            { error: 'Failed to parse booking input' },
            { status: 500 }
        );
    }
}
