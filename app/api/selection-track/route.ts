import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

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
        const session = await auth();
        const email = session?.user?.email?.toLowerCase();
        const user = email
            ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
            : null;

        const action = String(payload?.action || '').toUpperCase();
        if (action !== 'BOOK' && action !== 'DETAIL' && action !== 'IGNORE') {
            return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
        }

        const departureRaw = String(payload?.departTime || payload?.departureTime || '').trim();
        const departureDate = parseOptionalDate(payload?.departureDate);
        const departureHour = Number.isFinite(Number(payload?.departureHour))
            ? Math.max(0, Math.min(23, Number(payload.departureHour)))
            : departureRaw
                ? new Date(departureRaw).getUTCHours()
                : null;
        const isDirect = Boolean(payload?.isDirect);
        const isNight = Boolean(
            payload?.isNight ||
            (Number.isFinite(Number(departureHour)) && (Number(departureHour) >= 18 || Number(departureHour) < 6))
        );

        const model = (prisma as any)?.flightSelectionEvent;
        if (model) {
            await model.create({
                data: {
                    action,
                    flightId: payload?.flightId ? String(payload.flightId) : null,
                    flightNumber: payload?.flightNumber ? String(payload.flightNumber) : null,
                    provider: payload?.provider ? String(payload.provider).toUpperCase() : null,
                    origin: payload?.origin ? String(payload.origin).toUpperCase() : null,
                    destination: payload?.destination ? String(payload.destination).toUpperCase() : null,
                    departureDate,
                    selectedPrice: parseOptionalNumber(payload?.selectedPrice),
                    selectedScore: parseOptionalNumber(payload?.selectedScore),
                    competitorPrice: parseOptionalNumber(payload?.competitorPrice),
                    competitorScore: parseOptionalNumber(payload?.competitorScore),
                    rank: parseOptionalInt(payload?.rank),
                    totalResults: parseOptionalInt(payload?.totalResults),
                    currency: payload?.currency ? String(payload.currency).toUpperCase() : null,
                },
            });
        }

        const preferenceModel = (prisma as any)?.userPreference;
        if (preferenceModel) {
            await preferenceModel.create({
                data: {
                    userId: user?.id || null,
                    action,
                    airline: payload?.airline ? String(payload.airline) : null,
                    origin: payload?.origin ? String(payload.origin).toUpperCase() : null,
                    destination: payload?.destination ? String(payload.destination).toUpperCase() : null,
                    departureDate,
                    flightId: payload?.flightId ? String(payload.flightId) : null,
                    provider: payload?.provider ? String(payload.provider).toUpperCase() : null,
                    selectedPrice: parseOptionalNumber(payload?.selectedPrice),
                    selectedScore: parseOptionalNumber(payload?.selectedScore),
                    competitorPrice: parseOptionalNumber(payload?.competitorPrice),
                    competitorScore: parseOptionalNumber(payload?.competitorScore),
                    isDirect,
                    isNight,
                    departureHour: Number.isFinite(Number(departureHour)) ? Number(departureHour) : null,
                },
            });
        }

        return NextResponse.json({ ok: true, legacyLogged: Boolean(model), preferenceLogged: Boolean(preferenceModel) });
    } catch (error) {
        console.warn('[SELECTION_TRACK] persist failed:', error);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
