'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Bell, Loader2, Check } from 'lucide-react';

interface FlightSegment {
    from: string;
    to: string;
    carrier: string;
    carrierName?: string;
    flightNumber: string;
    departure: string;
    arrival: string;
    duration: number; // minutes
    cabin?: string;
    baggageWeight?: number;
}

interface Layover {
    airport: string;
    city?: string;
    duration: number; // minutes
}

interface TrackButtonProps {
    flight: {
        flightNumber?: string;
        airline?: string;
        origin?: string;
        destination?: string;
        departureTime?: string;
        price: number;
        currency?: string;
        effectivePrice?: number;
        duration?: number; // total minutes
        stops?: number;
        segments?: FlightSegment[];
        layovers?: Layover[];
        baggageStatus?: {
            weight: number;
        };
        cabin?: string;
    };
    className?: string;
}

export function TrackButton({ flight, className = '' }: TrackButtonProps) {
    const [loading, setLoading] = useState(false);
    const [tracked, setTracked] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const { data: session, status } = useSession();

    const plan = (session?.user as any)?.subscriptionPlan?.toUpperCase();
    const hasPremium = plan === 'PRO' || plan === 'ELITE';

    // Extract locale from pathname (e.g., /en/flight-search -> en)
    const locale = pathname?.split('/')[1] || 'en';

    const handleTrack = async () => {
        // If not logged in, redirect to sign in
        if (status === 'unauthenticated') {
            router.push(`/${locale}/login?callbackUrl=` + encodeURIComponent(pathname || '/'));
            return;
        }

        if (!hasPremium) {
            router.push(`/${locale}/pricing`);
            return;
        }

        setLoading(true);

        // Prepare full flight data including segments
        const payload = {
            flightNumber: flight.flightNumber || flight.segments?.[0]?.flightNumber || 'Unknown',
            airline: flight.airline || flight.segments?.[0]?.carrierName || flight.segments?.[0]?.carrier || 'Unknown',
            origin: flight.origin || flight.segments?.[0]?.from || 'BNE',
            destination: flight.destination || flight.segments?.[flight.segments?.length ? flight.segments.length - 1 : 0]?.to || 'IST',
            departureDate: flight.departureTime || flight.segments?.[0]?.departure || new Date().toISOString(),
            price: flight.effectivePrice || flight.price,
            currency: flight.currency || 'TRY',
            // NEW: Full flight details
            totalDuration: flight.duration,
            stops: flight.stops,
            segments: flight.segments,
            layovers: flight.layovers,
            baggageWeight: flight.baggageStatus?.weight,
            cabin: flight.cabin || 'ECONOMY',
        };

        try {
            const res = await fetch('/api/track-flight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                setTracked(true);
                // Show success for 2 seconds, then redirect to tracked flights
                setTimeout(() => {
                    router.push(`/${locale}/dashboard/tracked-flights`);
                }, 1500);
            }
        } catch (error) {
            console.error('Track error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (tracked) {
        return (
            <button
                disabled
                className={`flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl font-bold text-sm w-full justify-center ${className}`}
            >
                <Check size={16} />
                Added to Watchlist!
            </button>
        );
    }

    return (
        <button
            onClick={handleTrack}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-sm w-full justify-center disabled:opacity-70 ${className}`}
        >
            {loading ? (
                <>
                    <Loader2 className="animate-spin" size={16} />
                    Saving...
                </>
            ) : (
                <>
                    <Bell size={16} />
                    Track This Flight
                </>
            )}
        </button>
    );
}
