
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { segmentId, seatNumber } = await req.json();

    if (!segmentId || !seatNumber) {
        return NextResponse.json({ error: 'Segment ID ve Koltuk numarası gereklidir.' }, { status: 400 });
    }

    // Basit Doğrulama: Koltuk formatı (Örn: 1A, 24F, 100K)
    // 1-3 basamaklı sayı + 1 harf
    const seatRegex = /^([1-9][0-9]{0,2})([A-K])$/;
    if (!seatRegex.test(seatNumber)) {
        return NextResponse.json({ error: 'Geçersiz koltuk numarası (Örn: 24A)' }, { status: 400 });
    }

    try {
        // Verify ownership via Trip -> User relationship which might be expensive to query directly on update.
        // Instead, we can do a quick check or just trust the segment ID if we want speed, 
        // but for security let's check ownership.
        const segment = await prisma.flightSegment.findUnique({
            where: { id: segmentId },
            include: { trip: true }
        });

        if (!segment || segment.trip.userId !== session.user.id) {
            return NextResponse.json({ error: 'Uçuş bulunamadı veya yetkisiz erişim.' }, { status: 403 });
        }

        const updatedSegment = await prisma.flightSegment.update({
            where: { id: segmentId },
            data: { userSeat: seatNumber }
        });

        return NextResponse.json({ success: true, seat: updatedSegment.userSeat });
    } catch (error) {
        console.error('Koltuk güncelleme hatası:', error);
        return NextResponse.json({ error: 'Koltuk kaydedilemedi.' }, { status: 500 });
    }
}
