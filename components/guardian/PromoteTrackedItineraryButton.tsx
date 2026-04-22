'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';

import { useRouter } from '@/i18n/routing';

type PromoteTrackedItineraryButtonProps = {
    locale: string;
    trackedItineraryId: string;
};

export function PromoteTrackedItineraryButton({
    locale,
    trackedItineraryId,
}: PromoteTrackedItineraryButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePromote = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/promote-itinerary-to-trip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ trackedItineraryId }),
            });

            const data = await response.json();
            if (!response.ok || !data?.monitoredTripId) {
                throw new Error(data?.error || 'Failed to promote itinerary');
            }

            router.push(`/${locale}/dashboard/guardian/${data.monitoredTripId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to promote itinerary');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={handlePromote}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-70"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Promoting to booked monitoring...
                    </>
                ) : (
                    <>
                        <ShieldCheck className="w-4 h-4" />
                        I booked this trip
                    </>
                )}
            </button>

            {error && (
                <p className="text-xs text-red-600">{error}</p>
            )}
        </div>
    );
}
