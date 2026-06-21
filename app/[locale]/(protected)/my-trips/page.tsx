import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { Plane, Calendar } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { AUTH_SESSION_COOKIE, verifySessionCookieValue } from '@/lib/auth/magicLinkSession';

export default async function MyTripsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations('MyTrips');

    const cookieStore = await cookies();
    const userId = verifySessionCookieValue(cookieStore.get(AUTH_SESSION_COOKIE)?.value);

    if (!userId) {
        redirect({ href: '/magic-login', locale });
        return null;
    }

    const trips = await prisma.monitoredTrip.findMany({
        where: { userId },
        include: { segments: { orderBy: { segmentOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div className="container mx-auto px-4 md:px-6 py-10">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('title')}</h1>

            {trips.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    {t('empty')}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {trips.map((trip) => {
                        const segment = trip.segments[0] || null;
                        return (
                            <Link
                                key={trip.id}
                                href={`/trip/${trip.id}`}
                                className="block rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-sky-200 transition-shadow"
                            >
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Plane className="w-4 h-4 text-sky-600" />
                                    {trip.routeLabel}
                                </div>
                                {segment && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(segment.departureDate).toLocaleDateString()}
                                    </div>
                                )}
                                <div className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                                    {trip.status}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
