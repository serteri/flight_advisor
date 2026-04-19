'use client';

import { ExternalLink } from 'lucide-react';
import { generateBookingLink } from '@/lib/booking/linkGenerator';
import type { ScoredFlight } from '@/types/unifiedFlight';

interface BookButtonProps {
    flight: ScoredFlight;
    label?: string; // Optional custom label
}

export default function BookButton({ flight, label }: BookButtonProps) {

    const handleBooking = () => {
        const link = generateBookingLink({
            origin: flight.from,
            destination: flight.to,
            departureDate: flight.departureTime,
            departureTime: flight.departureTime,
            source: flight.source,
            deepLink: flight.bookingLink || flight.deepLink
        });

        // Open in new tab (no-op if no link available)
        if (link) window.open(link, '_blank');
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <button
                onClick={handleBooking}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
            >
                <span>{label || "Fiyatı Gör & Satın Al"}</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
    );
}
