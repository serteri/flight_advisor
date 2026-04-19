import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseBookingLikeInput } from '@/lib/parser/bookingTextParser';
import { autoCreateMonitoredTripFromParsedBooking } from '@/services/guardian/inboxAutoTrack';

type EmailIngestPayload = {
    subject?: string;
    body?: string;
    from?: string;
    rawText?: string;
    metadata?: Record<string, unknown>;
};

const extractEmail = (from?: string): string | null => {
    if (!from || typeof from !== 'string') return null;
    const angleMatch = from.match(/<([^>]+)>/);
    const candidate = angleMatch?.[1] || from;
    const normalized = candidate.trim().toLowerCase();
    return normalized.includes('@') ? normalized : null;
};

const stripForwardPrefix = (value: string): string => {
    return value
        .replace(/^\s*(fwd?|fw)\s*:\s*/i, '')
        .trim();
};

const stripForwardingBoilerplate = (value: string): string => {
    return value
        .split('\n')
        .filter((line) => {
            const normalized = line.trim().toLowerCase();
            if (!normalized) return true;
            if (normalized.startsWith('forwarded message')) return false;
            if (normalized.startsWith('begin forwarded message')) return false;
            if (normalized.startsWith('from:') && normalized.includes('@')) return false;
            if (normalized.startsWith('sent:')) return false;
            if (normalized.startsWith('to:') && normalized.includes('@')) return false;
            return true;
        })
        .join('\n')
        .trim();
};

const normalizeEmailInput = (payload: EmailIngestPayload) => {
    const cleanSubject = stripForwardPrefix(String(payload.subject || ''));
    const cleanBody = stripForwardingBoilerplate(String(payload.body || ''));
    const cleanRawText = stripForwardingBoilerplate(String(payload.rawText || ''));

    return {
        subject: cleanSubject,
        body: cleanBody,
        rawText: cleanRawText,
        structured: payload.metadata,
    };
};

const resolveUserId = async (requestFrom: string | undefined, sessionUserId?: string) => {
    if (sessionUserId) return sessionUserId;

    const email = extractEmail(requestFrom);
    if (!email) return null;

    const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    return user?.id || null;
};

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const payload = (await request.json()) as EmailIngestPayload;

        const normalized = normalizeEmailInput(payload || {});
        const parseResult = parseBookingLikeInput(normalized);

        if (!parseResult.success) {
            return NextResponse.json({
                success: false,
                outcome: 'invalid',
                parseResult,
                autoTrack: {
                    created: false,
                    reason: 'No booking-like fields detected',
                },
            });
        }

        if (!parseResult.isTrackable) {
            return NextResponse.json({
                success: true,
                outcome: 'parsed_not_trackable',
                parseResult,
                autoTrack: {
                    created: false,
                    reason: `Missing required fields: ${parseResult.missingRequiredFields.join(', ')}`,
                },
            });
        }

        const userId = await resolveUserId(payload?.from, session?.user?.id);
        if (!userId) {
            return NextResponse.json({
                success: true,
                outcome: 'parsed_not_trackable',
                parseResult,
                autoTrack: {
                    created: false,
                    reason: 'No user mapping found for this payload',
                },
            });
        }

        const autoTrack = await autoCreateMonitoredTripFromParsedBooking({
            userId,
            parseResult,
        });

        return NextResponse.json({
            success: true,
            outcome: autoTrack.created ? 'trackable_created' : 'parsed_not_trackable',
            parseResult,
            autoTrack,
        });
    } catch (error) {
        console.error('[EMAIL_INGEST] Error:', error);
        return NextResponse.json(
            { error: 'Failed to ingest email payload' },
            { status: 500 }
        );
    }
}
