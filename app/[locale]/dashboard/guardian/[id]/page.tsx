import { airportSchedule } from '@/lib/guardian/flightScheduleDisplay';
import type { FlightLegOption } from '@/lib/flightData/legs';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { redirect } from '@/i18n/routing';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { isOwnedBy } from '@/lib/auth/ownership';
import { evaluateTripCompensation } from '@/lib/compensation/tripCompensation';
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

    // Same engine result the claim letter uses; the client only displays it.
    const { regime, status, amount, currency } = evaluateTripCompensation(trip);
    const compensation = { regime, status, amount, currency };

    const segments = await Promise.all(trip.segments.map(async segment => {
        const cache = await prisma.flightLookupCache.findUnique({
            where: { flightNumber_flightDate: {
                flightNumber: `${segment.airlineCode}${segment.flightNumber}`.toUpperCase().replace(/\s/g, ''),
                flightDate: segment.departureDate.toISOString().slice(0, 10),
            } },
            select: { options: true },
        });
        const options = Array.isArray(cache?.options) ? cache.options as unknown as FlightLegOption[] : [];
        return { ...segment, ...airportSchedule(segment, options) };
    }));

    // 2. Client Component'e Gönder
    return <TripDetailsClient trip={{ ...trip, segments }} locale={locale} compensation={compensation} />;
}
