import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isClaimDocumentUploadEnabled } from '@/lib/featureFlags';
import { LegalDisclaimer } from '@/components/legal/LegalDisclaimer';
import { redirect } from '@/i18n/routing';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { ClaimProcessForm } from '@/components/claims/ClaimProcessForm';

export default async function ClaimProcessPage({
    params,
}: {
    params: Promise<{ locale: string; tripId: string }>;
}) {
    const { locale, tripId } = await params;
    setRequestLocale(locale);
    const t = await getTranslations('ClaimProcess');
    const tLegal = await getTranslations('Legal');

    const userId = await getCurrentUserId();
    if (!userId) {
        redirect({ href: '/magic-login', locale });
        return null;
    }

    const trip = await prisma.monitoredTrip.findUnique({
        where: { id: tripId },
        include: { segments: { orderBy: { segmentOrder: 'asc' } } },
    });

    if (!trip || trip.userId !== userId) {
        return notFound();
    }

    const firstSegment = trip.segments[0] || null;
    const lastSegment = trip.segments[trip.segments.length - 1] || null;

    return (
        <div className="container mx-auto px-4 md:px-6 py-10">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
                    <p className="text-sm text-slate-600 mt-1">{t('subtitle')}</p>
                </div>

                <LegalDisclaimer className="rounded-xl border border-slate-200 bg-slate-50 p-3" />

                {!isClaimDocumentUploadEnabled() ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        {tLegal('claimUnavailable')}
                    </p>
                ) : (
                <ClaimProcessForm
                    tripId={trip.id}
                    flightSummary={{
                        routeLabel: trip.routeLabel,
                        flightNumber: firstSegment ? `${firstSegment.airlineCode}${firstSegment.flightNumber}` : null,
                        origin: firstSegment?.origin ?? null,
                        destination: lastSegment?.destination ?? null,
                        departureDate: firstSegment ? firstSegment.departureDate.toISOString() : null,
                    }}
                    defaultEmail={trip.subscriberEmail || ''}
                />
                )}
            </div>
        </div>
    );
}
