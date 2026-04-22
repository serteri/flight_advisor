import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { TripDetailsClient } from './TripDetailsClient';

export default async function TripDetailsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
    const session = await auth();
    if (!session?.user) redirect('/login');

    const { id, locale } = await params;

    // 1. VERİ ÇEKME (JOIN İŞLEMİ)
    // Trip'i çekerken, içindeki 'segments'leri de çekiyoruz.
    const trip = await prisma.monitoredTrip.findUnique({
        where: { id: id },
        include: {
            segments: {
                orderBy: { segmentOrder: 'asc' } // Sıralama önemli! (1. uçak, 2. uçak)
            },
            alerts: {
                orderBy: {
                    createdAt: 'desc',
                },
            },
            snapshot: true,
            deliveries: {
                orderBy: {
                    updatedAt: 'desc',
                },
            },
            passengers: true,
        }
    });

    if (!trip) return <div className="p-8 text-center font-bold text-slate-500">Yolculuk bulunamadı veya silinmiş.</div>;

    // 2. Client Component'e Gönder
    return <TripDetailsClient trip={trip} locale={locale} />;
}
