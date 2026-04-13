import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const parseOptionalNumber = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const parseOptionalInt = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
};

const parseOptionalDate = (value: unknown): Date | null => {
    const text = String(value || '').trim();
    if (!text) return null;
    const parsed = text.includes('T') ? new Date(text) : new Date(`${text}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
};

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const action = String(payload?.action || '').toUpperCase();
        if (action !== 'BOOK' && action !== 'DETAIL') {
            return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
        }

        const model = (prisma as any)?.flightSelectionEvent;
        if (!model) {
            return NextResponse.json({ ok: true, skipped: true });
        }

        await model.create({
            data: {
                action,
                flightId: payload?.flightId ? String(payload.flightId) : null,
                flightNumber: payload?.flightNumber ? String(payload.flightNumber) : null,
                provider: payload?.provider ? String(payload.provider).toUpperCase() : null,
                origin: payload?.origin ? String(payload.origin).toUpperCase() : null,
                destination: payload?.destination ? String(payload.destination).toUpperCase() : null,
                departureDate: parseOptionalDate(payload?.departureDate),
                selectedPrice: parseOptionalNumber(payload?.selectedPrice),
                selectedScore: parseOptionalNumber(payload?.selectedScore),
                competitorPrice: parseOptionalNumber(payload?.competitorPrice),
                competitorScore: parseOptionalNumber(payload?.competitorScore),
                rank: parseOptionalInt(payload?.rank),
                totalResults: parseOptionalInt(payload?.totalResults),
                currency: payload?.currency ? String(payload.currency).toUpperCase() : null,
            },
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.warn('[SELECTION_TRACK] persist failed:', error);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
