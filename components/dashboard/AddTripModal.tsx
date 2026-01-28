'use client';
import { useState } from 'react';
import { Loader2, Plane, AlertTriangle, Search, X, CheckCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { PricingTable } from './PricingTable';

export function AddTripModal({ onClose, user }: { onClose: () => void, user: any }) {
    const t = useTranslations('addTrip');
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Inputs
    const [flightNo, setFlightNo] = useState(''); // e.g. TK59
    const [date, setDate] = useState(''); // YYYY-MM-DD
    const [pnr, setPnr] = useState('');

    // Verified Data
    const [verifiedFlight, setVerifiedFlight] = useState<any>(null);

    const handleVerifyFlight = async () => {
        setLoading(true);

        // 1. Parse Flight Code (TK59 -> Airline: TK, Number: 59)
        const match = flightNo.match(/([a-zA-Z]+)(\d+)/);

        if (!match) {
            alert("Please enter a valid flight code (e.g. TK59)");
            setLoading(false);
            return;
        }

        const airlineCode = match[1].toUpperCase();
        const flightNumber = match[2];

        try {
            // 2. ASK BACKEND: "Does this flight exist?"
            const res = await fetch('/api/flights/verify-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ airlineCode, flightNumber, date })
            });

            const data = await res.json();

            if (data.exists) {
                setVerifiedFlight(data.flight); // { origin: 'BKK', dest: 'IST', ... }
                setStep(2);
            } else {
                alert("Flight not found on this date. Please check the code and date.");
            }
        } catch (e) {
            alert("System error.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // 3. SAVE VERIFIED DATA
        try {
            const res = await fetch('/api/trips/monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...verifiedFlight, // Includes Origin, Dest, Times
                    pnr: pnr.toUpperCase(), // User provided (optional logic in UI, but sent to backend)
                    userId: user.id || 'mock_user'
                })
            });

            if (res.ok) {
                setStep(3); // Success
                router.refresh();
            } else {
                alert("Failed to save trip.");
            }
        } catch (e) {
            alert("Connection error");
        }
    };

    // Close Handler
    const handleClose = () => {
        router.refresh();
        onClose();
    }

    // Feature Gate
    // @ts-ignore
    if (!user.isPremium) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="relative w-full max-w-md">
                    <button onClick={onClose} className="absolute -top-10 right-0 text-white hover:text-slate-300 font-bold flex items-center gap-1">
                        <X className="w-5 h-5" /> {t('close')}
                    </button>
                    <PricingTable />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
                <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
                    <X className="w-5 h-5" />
                </button>

                {/* STEP 1: ENTER FLIGHT */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-900">Add Trip</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Flight Code</label>
                                <input
                                    value={flightNo}
                                    onChange={e => setFlightNo(e.target.value.toUpperCase())}
                                    placeholder="e.g. TK59"
                                    className="w-full p-3 border border-slate-300 rounded-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">PNR (Optional)</label>
                            <input
                                value={pnr}
                                onChange={e => setPnr(e.target.value.toUpperCase())}
                                placeholder="6-Character Booking Ref"
                                maxLength={6}
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                PNR is only used for compensation claims if needed.
                            </p>
                        </div>

                        <button
                            onClick={handleVerifyFlight}
                            disabled={loading || !flightNo || !date}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex justify-center gap-2 items-center hover:bg-slate-800 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                            Find Flight
                        </button>
                    </div>
                )}

                {/* STEP 2: VERIFY */}
                {step === 2 && verifiedFlight && (
                    <div>
                        <h3 className="text-lg font-bold mb-2">Is this your flight?</h3>

                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-black text-xl text-slate-800">{verifiedFlight.airlineCode}{verifiedFlight.flightNumber}</span>
                                <span className="text-sm font-medium text-slate-500">{verifiedFlight.date}</span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <div className="text-2xl font-black text-slate-900">{verifiedFlight.origin}</div>
                                    <div className="text-xs text-slate-500">{verifiedFlight.departureTime}</div>
                                </div>
                                <div className="flex-1 border-t-2 border-dashed border-slate-300 relative h-0">
                                    <Plane className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 text-slate-400 fill-slate-50 rotate-90" />
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-black text-slate-900">{verifiedFlight.destination}</div>
                                    <div className="text-xs text-slate-500">{verifiedFlight.arrivalTime}</div>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSave} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold mb-2 hover:bg-emerald-700">
                            Yes, Track This Trip
                        </button>
                        <button onClick={() => setStep(1)} className="w-full text-slate-500 py-2 font-bold hover:text-slate-800">
                            No, Edit Details
                        </button>
                    </div>
                )}

                {/* STEP 3: SUCCESS */}
                {step === 3 && (
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">Trip Added!</h3>
                        <p className="text-slate-500 mt-2 text-sm">We are now monitoring this flight for price drops and delays.</p>
                        <button onClick={handleClose} className="mt-6 text-slate-900 font-bold underline">
                            Return to Dashboard
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
