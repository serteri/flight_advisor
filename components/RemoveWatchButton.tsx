'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellOff, Loader2 } from 'lucide-react';

interface RemoveButtonProps {
    flightId: string;
}

export function RemoveWatchButton({ flightId }: RemoveButtonProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleRemove = async () => {
        if (!confirm('Remove this flight from your watchlist?')) {
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`/api/track-flight?id=${flightId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                router.refresh();
            }
        } catch (error) {
            console.error('Remove error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleRemove}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
            title="Remove from watchlist"
        >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <BellOff className="h-4 w-4" />
            )}
            Remove
        </button>
    );
}
