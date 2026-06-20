'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PlusCircle } from 'lucide-react';

import { AddTripModal } from '@/components/dashboard/AddTripModal';

type GuardianOverviewActionsProps = {
    user: {
        id?: string;
        subscriptionPlan?: string;
    };
};

export function GuardianOverviewActions({ user }: GuardianOverviewActionsProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();
    const t = useTranslations('Dashboard');

    return (
        <>
            <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-800 transition-colors"
            >
                <PlusCircle size={18} /> {t('addTripShort')}
            </button>

            {isModalOpen && (
                <AddTripModal
                    user={user}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={() => router.refresh()}
                />
            )}
        </>
    );
}