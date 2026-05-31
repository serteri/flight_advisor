'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type DeleteTripButtonProps = {
    tripId: string;
};

export function DeleteTripButton({ tripId }: DeleteTripButtonProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (isDeleting) return;

        const confirmed = window.confirm('Stop monitoring this trip?\nAll alert history will be deleted.');
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/guardian/${tripId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete trip.');
            }

            router.refresh();
        } catch (error) {
            console.error('[GUARDIAN] Failed to delete trip', error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-300 bg-white text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            title="Stop monitoring this trip"
            aria-label="Stop monitoring this trip"
        >
            <Trash2 className="h-4 w-4" />
        </button>
    );
}