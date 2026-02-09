"use client";

import { useState, useEffect } from 'react';
import FlightResultCard from '@/components/search/FlightResultCard';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { Search } from 'lucide-react';

interface ResultsPageProps {
    searchParams: {
        origin?: string;
        destination?: string;
        date?: string;
    };
}

export default function ResultsPage({ searchParams }: ResultsPageProps) {
    const [flights, setFlights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // URL'den arama parametrelerini al
    const { origin, destination, date } = searchParams;

    useEffect(() => {
        async function fetchResults() {
            if (!origin || !destination || !date) {
                setError("Eksik arama parametreleri");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ origin, destination, date }),
                });

                if (!response.ok) {
                    throw new Error('Arama motoru yanıt vermedi');
                }

                const data = await response.json();
                setFlights(data);
            } catch (err) {
                console.error("Arama motoru hatası:", err);
                setError("Arama motoru başlatılamadı. Lütfen tekrar deneyin.");
            } finally {
                setLoading(false);
            }
        }

        fetchResults();
    }, [origin, destination, date]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto py-10 px-4">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Search className="w-5 h-5 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900">
                            Uçuş Seçenekleri
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 text-lg">
                        <span className="font-bold text-blue-600">{origin}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-bold text-blue-600">{destination}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">{date}</span>
                    </div>
                    <p className="text-slate-500 mt-2">
                        Agent Score ve 9 farklı kriter analiz edilerek en mantıklı uçuşlar sıralandı.
                    </p>
                </header>

                {/* Loading State */}
                {loading && (
                    <div className="space-y-4">
                        <SkeletonLoader />
                        <SkeletonLoader />
                        <SkeletonLoader />
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                        <p className="text-red-700 font-semibold">{error}</p>
                    </div>
                )}

                {/* Results */}
                {!loading && !error && (
                    <div className="grid gap-6">
                        {flights.length > 0 ? (
                            flights.map((flight, index) => (
                                <FlightResultCard
                                    key={flight.id || index}
                                    flight={flight}
                                />
                            ))
                        ) : (
                            <div className="text-center py-20 border-2 border-dashed border-slate-300 rounded-xl bg-white">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="w-8 h-8 text-slate-400" />
                                </div>
                                <p className="text-lg font-bold text-slate-400 mb-2">
                                    Aradığın kriterlerde uçuş bulunamadı
                                </p>
                                <p className="text-sm text-slate-500">
                                    Farklı tarihler veya havaalanları deneyin
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
