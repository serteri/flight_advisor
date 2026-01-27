'use client';

import { useState } from 'react';
import { Plus, Plane } from 'lucide-react';
import Link from 'next/link';
import { AddTripModal } from './AddTripModal';
import { WatchedFlightCard } from '@/components/WatchedFlightCard';

interface DashboardClientProps {
    trips: any[];           // MonitoredTrip[]
    trackedFlights: any[];  // WatchedFlight[]
    user: any;
}

export function DashboardClient({ trips, trackedFlights, user }: DashboardClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <div className="space-y-12">

            {/* --- SECTION 1: SEYAHATLERİM (GUARDIAN V2) --- */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Seyahatlerim</h2>
                        <p className="text-slate-500">Premium koruma altındaki uçuşlarınız.</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-emerald-200"
                    >
                        <Plus className="w-5 h-5" />
                        Yeni Seyahat Ekle
                    </button>
                </div>

                {trips.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center flex flex-col items-center">
                        <div className="p-3 bg-white rounded-full shadow-sm mb-3 text-slate-400">
                            <Plane className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">Seyahat Listeniz Boş</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-3 max-w-xs">
                            Yapay zeka asistanınızı aktif etmek için uçuşunuzu ekleyin.
                        </p>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-emerald-600 text-sm font-bold hover:underline"
                        >
                            + Seyahat Ekle
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {trips.map((trip) => (
                            <Link href={`/dashboard/guardian/${trip.id}`} key={trip.id}>
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center hover:shadow-md transition-shadow cursor-pointer group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-slate-100 rounded-lg text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                            <Plane className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-700 transition-colors">{trip.origin} ➝ {trip.destination}</h3>
                                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                                <span className="font-mono font-bold bg-slate-100 px-1 rounded text-slate-700">{trip.pnr}</span>
                                                <span>•</span>
                                                <span>{new Date(trip.departureDate).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span>{trip.flightNumber}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${trip.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            {trip.status === 'ACTIVE' ? 'KORUMA ALTINDA' : trip.status}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* --- SECTION 2: TAKİP EDİLEN UÇUŞLAR (TRACKED FLIGHTS) --- */}
            <div>
                <div className="mb-6 border-t pt-8">
                    <h2 className="text-2xl font-bold text-slate-900">Takip Edilen Fırsatlar</h2>
                    <p className="text-slate-500">Fiyatını izlediğiniz potansiyel uçuşlar.</p>
                </div>

                {trackedFlights.length === 0 ? (
                    <div className="text-center py-8 opacity-60">
                        <p>Henüz takip ettiğiniz bir uçuş yok.</p>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                        {trackedFlights.map((flight) => (
                            <WatchedFlightCard key={flight.id} flight={flight} />
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
