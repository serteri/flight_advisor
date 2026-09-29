import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { redirect } from '@/i18n/routing';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { isOwnedBy } from '@/lib/auth/ownership';
import { TripDetailsClient } from './TripDetailsClient';

export default async function TripDetailsPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
    const { id, locale } = await params;

    const userId = await getCurrentUserId();
    if (!userId) redirect({ href: '/login', locale });

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
            alertEvents: {
                orderBy: {
                    detectedAt: 'desc',
                },
                include: {
                    deliveries: {
                        orderBy: {
                            updatedAt: 'desc',
                        },
                    },
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

    // Not found and not-yours look identical, so trip ids can't be probed.
    if (!trip || !isOwnedBy(trip, userId)) notFound();

    // 2. Client Component'e Gönder
    return <TripDetailsClient trip={trip} locale={locale} />;
}
