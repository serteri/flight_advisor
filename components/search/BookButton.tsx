'use client';

import { ExternalLink } from 'lucide-react';
import { generateBookingLink } from '@/lib/booking/linkGenerator';
import { FlightResult } from '@/types/hybridFlight';

interface BookButtonProps {
    flight: FlightResult;
}

export default function BookButton({ flight }: BookButtonProps) {

    const handleBooking = () => {
        const link = generateBookingLink({
            origin: flight.from,
            destination: flight.to,
            departureDate: flight.departTime,
            source: flight.source,
            deepLink: flight.bookingLink
        });

        // Open in new tab
        window.open(link, '_blank');
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <button
                onClick={handleBooking}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
            >
                <span>Fiyatı Gör & Satın Al</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <p className="text-[10px] text-center text-slate-400">
                En iyi fiyat için partnerimize yönlendirileceksiniz.
            </p>
        </div>
    );
}
