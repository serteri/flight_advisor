import { CheckCircle2, Mail, Plane } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export default async function TripTrackingConfirmationPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
    const { id, locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('HomePage.guardian.heroForm.confirmation');

    const trip = await prisma.monitoredTrip.findUnique({
        where: { id },
        include: { segments: { orderBy: { segmentOrder: 'asc' } } },
    });

    if (!trip) return notFound();

    const segment = trip.segments[0] || null;

    return (
        <div className="container mx-auto px-4 md:px-6 py-16">
            <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-5">
                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
                <p className="text-slate-600">{t('subtitle')}</p>

                {segment && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <Plane className="w-4 h-4 text-sky-600" />
                            {segment.airlineCode}{segment.flightNumber} — {new Date(segment.departureDate).toLocaleDateString()}
                        </div>
                        {trip.subscriberEmail && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Mail className="w-4 h-4 text-slate-400" />
                                {trip.subscriberEmail}
                            </div>
                        )}
                    </div>
                )}

                <p className="text-sm text-slate-500">{t('nextSteps')}</p>

                <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-800"
                >
                    {t('backHome')}
                </Link>
            </div>
        </div>
    );
}
