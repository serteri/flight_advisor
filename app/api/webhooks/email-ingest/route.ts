import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseBookingLikeInput } from '@/lib/parser/bookingParser';
import { autoCreateMonitoredTripFromParsedBooking } from '@/services/guardian/inboxAutoTrack';

type EmailIngestPayload = {
    userId?: string;
    subject?: string;
    body?: string;
    text?: string;
    html?: string;
    from?: string;
    rawText?: string;
    structured?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
};

const htmlToText = (html?: string): string => {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();
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
    const cleanBody = stripForwardingBoilerplate(String(payload.body || payload.text || ''));
    const cleanRawText = stripForwardingBoilerplate(String(payload.rawText || htmlToText(payload.html) || ''));

    const structuredPayload = payload.structured && typeof payload.structured === 'object'
        ? payload.structured
        : payload.metadata && typeof payload.metadata === 'object'
            ? payload.metadata
            : undefined;

    return {
        subject: cleanSubject,
        body: cleanBody,
        rawText: cleanRawText,
        structured: structuredPayload,
    };
};

const extractBearerToken = (value: string | null): string | null => {
    if (!value) return null;
    if (!value.startsWith('Bearer ')) return null;
    return value.slice('Bearer '.length).trim() || null;
};

const isInboundAuthorized = (request: NextRequest): boolean => {
    const configuredSecret = process.env.EMAIL_INGEST_SECRET || process.env.CRON_SECRET;
    if (!configuredSecret) return false;

    const secretHeader = request.headers.get('x-email-ingest-secret') || request.headers.get('x-webhook-secret');
    const bearerToken = extractBearerToken(request.headers.get('authorization'));

    return secretHeader === configuredSecret || bearerToken === configuredSecret;
};

const resolveUserId = async (
    requestFrom: string | undefined,
    payloadUserId?: string,
    sessionUserId?: string,
) => {
    if (sessionUserId) return sessionUserId;
    if (payloadUserId) return payloadUserId;

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
        const payload = (await request.json()) as EmailIngestPayload;
        const inboundAuthorized = isInboundAuthorized(request);
        const session = inboundAuthorized ? null : await auth();

        if (!inboundAuthorized && !session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        const payloadUserId = typeof payload?.userId === 'string'
            ? payload.userId
            : typeof normalized.structured?.userId === 'string'
                ? normalized.structured.userId
                : undefined;

        const userId = await resolveUserId(payload?.from, payloadUserId, session?.user?.id);
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
    } finally {
        await prisma.$disconnect();
    }
}
