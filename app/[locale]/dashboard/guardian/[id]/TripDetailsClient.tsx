'use client';
import { useState } from 'react';
import { Plane, ArrowRight, MapPin, Calendar, Clock, Armchair, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SeatMapVisualizer } from '@/components/SeatMapVisualizer';
import { DisruptionCard } from '@/components/guardian/DisruptionCard';
import { SeatAssignmentModal } from '@/components/dashboard/SeatAssignmentModal';
import { useTranslations } from 'next-intl';
import { getMockAircraftLayout } from '@/utils/mockSeatMap';
import { getLatestSeatMap } from '@/app/actions/flight';
import { getAircraftInfo, getAircraftBadge } from '@/lib/aircraftData';
import { Loader2, RefreshCw } from 'lucide-react';

export function TripDetailsClient({ trip }: { trip: any }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [showSeatModal, setShowSeatModal] = useState(false);

    // LIVE DATA STATE
    const [loadingMap, setLoadingMap] = useState(false);
    const [liveLayout, setLiveLayout] = useState<any>(null);
    const [liveAircraftInfo, setLiveAircraftInfo] = useState<any>(null);

    const t = useTranslations('Guardian');
    const tModules = useTranslations('Modules');

    const activeSegment = trip.segments[activeIndex];

    // Reset live data when tab changes
    // useEffect(() => { setLiveLayout(null); }, [activeIndex]);
    // Disable auto-reset if we want to keep cache? Better reset to avoid confusion.

    const handleCheckLive = async () => {
        setLoadingMap(true);
        const res = await getLatestSeatMap(activeSegment.id, activeSegment);
        setLoadingMap(false);

        if (res.success) {
            setLiveLayout(res.layout);
            setLiveAircraftInfo(res.aircraftInfo);
        } else {
            alert("Canlı harita şu an alınamıyor. Mock veri gösteriliyor.");
        }
    };

    // Determine which layout to show
    // 1. Live Layout (Priority)
    // 2. Mock Layout (Fallback)
    const mockLayout = getMockAircraftLayout(activeSegment.aircraftType || '738', activeSegment.userSeat);
    const displayLayout = liveLayout || mockLayout;

    // Aircraft Info Display
    const aircraftCode = activeSegment.aircraftType || '738';
    const staticInfo = getAircraftInfo(aircraftCode);
    const displayInfo = liveAircraftInfo || staticInfo;

    const formatDate = (date: string) => new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    // Filter alerts for the active segment
    const activeAlerts = trip.alerts?.filter((a: any) => a.segmentId === activeSegment.id) || [];

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8">

            {/* 1. HEADER (PNR & ROUTE) */}
            <div className="flex justify-between items-end mb-8 border-b border-slate-200 pb-4">
                <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">PNR: {trip.pnr}</div>
                    <h1 className="text-3xl font-black text-slate-900">{trip.routeLabel}</h1>
                </div>
                <div className="text-right hidden md:block">
                    <div className="text-sm font-medium text-slate-500">Durum</div>
                    <div className="text-lg font-bold text-slate-800">{trip.status}</div>
                </div>
            </div>

            {/* 2. TAB MENU (FLIGHT SELECTOR) */}
            <div className="flex gap-4 overflow-x-auto pb-4 mb-8 scrollbar-hide">
                {trip.segments.map((seg: any, index: number) => {
                    const isActive = index === activeIndex;
                    return (
                        <button
                            key={seg.id}
                            onClick={() => { setActiveIndex(index); setLiveLayout(null); }}
                            className={`
                relative min-w-[220px] p-4 rounded-2xl border-2 text-left transition-all
                ${isActive
                                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-100 shadow-lg scale-105 z-10'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 opacity-70 hover:opacity-100'}
              `}
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {index + 1}. UÇUŞ
                                </span>
                                <Plane className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                            </div>

                            <div className="text-lg font-black text-slate-900 flex items-center gap-2">
                                {seg.origin} <ArrowRight className="w-4 h-4 text-slate-300" /> {seg.destination}
                            </div>

                            <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(seg.departureDate)}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 3. ACTIVE CONTENT AREA */}
            <div key={activeSegment.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT: SEAT MAP (8 COL) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* SEAT INFO CARD */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-slate-900">
                                        {displayInfo ? displayInfo.name : `${activeSegment.airlineCode}${activeSegment.flightNumber}`}
                                    </h3>
                                    {displayInfo && (
                                        <span className="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                            {displayInfo.badge}
                                        </span>
                                    )}
                                </div>

                                {displayInfo ? (
                                    <div className="flex gap-3 text-xs text-slate-500">
                                        <span>📏 {displayInfo.pitch}</span>
                                        <span>{displayInfo.wifi ? '📶 WiFi Var' : '📶 WiFi Yok'}</span>
                                        <span>{displayInfo.power ? '🔌 USB' : ''}</span>
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">Uçak tipi: {activeSegment.aircraftType || 'Bilinmiyor'}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-4">
                                {/* Live Check Button */}
                                <button
                                    onClick={handleCheckLive}
                                    disabled={loadingMap}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors"
                                >
                                    {loadingMap ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    {liveLayout ? 'Canlı Veri' : 'Canlı Kontrol Et'}
                                </button>

                                {activeSegment.userSeat ? (
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Sizin Yeriniz</div>
                                        <div className="text-2xl font-black text-purple-600">{activeSegment.userSeat}</div>
                                    </div>
                                ) : null}

                                <button onClick={() => setShowSeatModal(true)} className="text-xs underline text-slate-500 hover:text-blue-600">
                                    {activeSegment.userSeat ? 'Değiştir' : 'Koltuk Seç'}
                                </button>
                            </div>
                        </div>

                        {/* SEAT VISUALIZER */}
                        <SeatMapVisualizer
                            layout={displayLayout}
                            userSeat={activeSegment.userSeat}
                        />
                        {liveLayout && <div className="text-center text-xs text-emerald-600 font-bold mt-2">✅ Amadeus verisiyle doğrulandı</div>}

                    </div>

                    {/* RIGHT: SHIELDS & MODULES (4 COL) */}
                    <div className="lg:col-span-4 space-y-4">
                        <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Aktif Korumalar</h3>

                        {/* DISRUPTION CARD */}
                        <DisruptionCard
                            segment={activeSegment}
                            alerts={activeAlerts || []}
                        />

                        {/* UPGRADE SNIPER CARD (Static for Demo) */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-xl">
                            <div className="flex justify-between items-start mb-4">
                                <h4 className="font-bold">Upgrade Sniper</h4>
                                <span className="bg-white/20 text-xs px-2 py-1 rounded">Active</span>
                            </div>
                            <p className="text-sm text-slate-300 mb-4">
                                Business class fiyatlarını izliyoruz. Düşüş olduğunda haber vereceğiz.
                            </p>
                        </div>

                        {/* MODULE STATUS */}
                        <div className="grid grid-cols-1 gap-2 mt-4">
                            <ModuleStatusLine title="Disruption Hunter" status="ACTIVE" color="emerald" />
                            <ModuleStatusLine title="Seat Spy" status={activeSegment.userSeat ? "ACTIVE" : "WAITING"} color={activeSegment.userSeat ? "emerald" : "amber"} />
                            <ModuleStatusLine title="Uçak Tipi" status={displayInfo ? "VERIFIED" : "ESTIMATED"} color={displayInfo ? "purple" : "slate"} />
                        </div>

                    </div>

                </div>
            </div>

            {/* SEAT MODAL */}
            {showSeatModal && (
                <SeatAssignmentModal
                    tripId={trip.id}
                    segmentId={activeSegment.id}
                    flightCode={`${activeSegment.airlineCode}${activeSegment.flightNumber}`}
                    onClose={() => setShowSeatModal(false)}
                />
            )}

        </div>
    );
}

function ModuleStatusLine({ title, status, color }: { title: string, status: string, color: string }) {
    const colors: any = {
        emerald: "text-emerald-600 bg-emerald-50",
        amber: "text-amber-600 bg-amber-50",
        purple: "text-purple-600 bg-purple-50",
        slate: "text-slate-600 bg-slate-50"
    };

    return (
        <div className={`flex justify-between items-center p-3 rounded-lg border border-slate-100 ${colors[color] || 'bg-slate-50'}`}>
            <span className="text-sm font-bold text-slate-700">{title}</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded ${colors[color]}`}>{status}</span>
        </div>
    )
}
