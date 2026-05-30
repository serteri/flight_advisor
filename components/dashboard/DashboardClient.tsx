'use client';

import { useState } from 'react';
import { FileText, Plus, Plane } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { AddTripModal } from './AddTripModal';

interface DashboardClientProps {
    trips: Array<{
        id: string | number;
        origin?: string;
        destination?: string;
        pnr?: string;
        departureDate?: string | Date;
        flightNumber?: string;
        status?: string;
        [key: string]: unknown;
    }>;
    user: {
        id?: string;
        subscriptionPlan?: string;
        isPremium?: boolean;
        trialEndsAt?: string | Date | null;
        subscriptionStatus?: string | null;
        [key: string]: unknown;
    };
}

export function DashboardClient({ trips, user }: DashboardClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const pathname = usePathname();
    const locale = pathname?.split('/')[1] || 'en';

    const t = useTranslations('Dashboard');

    return (
        <div className="space-y-12">
            <div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{t('myTrips')}</h2>
                        <p className="text-slate-500">{t('myTripsDesc')}</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-200"
                    >
                        <Plus className="w-5 h-5" />
                        {t('addTrip')}
                    </button>
                </div>

                {trips.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col items-center">
                        <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400">
                            <Plane className="w-6 h-6" />
                        </div>
                            <h3 className="text-sm font-bold text-slate-900">{t('emptyTitle')}</h3>
                            <p className="text-xs text-slate-500 mt-1 mb-3 max-w-xs">
                                {t('emptyDesc')}
                            </p>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                            >
                                <Plus className="w-4 h-4" />
                                {t('addTripShort')}
                            </button>
                            <Link
                                href={`/${locale}/dashboard/guardian`}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                            >
                                <FileText className="w-4 h-4" />
                                Open Guardian dashboard
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {trips.map((trip) => (
                            <Link href={`/${locale}/dashboard/guardian/${String(trip.id)}`} key={String(trip.id)}>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                            <Plane className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-700 transition-colors">{trip.origin || '-'} ➝ {trip.destination || '-'}</h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <span className="font-mono font-bold bg-slate-100 px-1 rounded text-slate-700">{trip.pnr || '-'}</span>
                                                <span>•</span>
                                                <span>{trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('tr-TR') : '-'}</span>
                                                <span>•</span>
                                                <span>{trip.flightNumber || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${trip.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            {trip.status === 'ACTIVE' ? t('monitored') : (trip.status || '-')}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <AddTripModal user={user} onClose={() => setIsModalOpen(false)} />
            )}
        </div>
    );
}
