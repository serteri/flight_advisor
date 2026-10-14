'use client';
import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Plane, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import UpgradePrompt from '@/components/freemium/UpgradePrompt';
import type { FreemiumFeature } from '@/lib/freemium/limits';
import { parseFlightNumber } from '@/lib/flights/flightNumber';
import { validateFlightDate } from '@/lib/flights/flightDateRule';
import { airlineDisplayName, formatLocalDateTime } from '@/lib/flights/legFormat';
import type { FlightLegOption } from '@/lib/flightData/legs';
import {
    ADD_TRIP_ERRORS,
    ADD_TRIP_SUCCESS,
    FREE_PLAN_LIMIT_NOTE,
    classifyLookupResponse,
    classifySaveResponse,
    type AddTripErrorCode,
} from '@/lib/guardian/addTripErrors';

type AddTripUser = {
    id?: string;
    subscriptionPlan?: string;
};

type AddTripModalProps = {
    onClose: () => void;
    user: AddTripUser;
    onSuccess?: () => void;
};

type SavedFlight = { flightNumber: string; origin: string; destination: string; date: string };

// The one lookup source, shared with the home page: POST /api/flights/lookup.
const LOOKUP_URL = '/api/flights/lookup';

const airportLine = (airport: FlightLegOption['origin']) =>
    [airport.iata, airport.city || airport.name].filter(Boolean).join(' · ');

export function AddTripModal({ onClose, onSuccess }: AddTripModalProps) {
    const router = useRouter();
    const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);

    const [flightNo, setFlightNo] = useState('');
    const [date, setDate] = useState(''); // YYYY-MM-DD
    const [pnr, setPnr] = useState('');
    const [errorCode, setErrorCode] = useState<AddTripErrorCode | null>(null);
    const [limitNote, setLimitNote] = useState(false);
    const [upgradePrompt, setUpgradePrompt] = useState<{ feature: FreemiumFeature; current?: number; limit?: number } | null>(null);

    const [options, setOptions] = useState<FlightLegOption[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [saved, setSaved] = useState<{ tripId: string | null; flight: SavedFlight } | null>(null);

    const fail = (code: AddTripErrorCode) => setErrorCode(code);

    const handleFindFlight = async () => {
        if (searching) return;
        setErrorCode(null);
        setLimitNote(false);

        const parsed = parseFlightNumber(flightNo);
        if (!parsed) return fail('INVALID_FLIGHT_FORMAT');
        const dateCheck = validateFlightDate(date);
        if (!dateCheck.ok) return fail(dateCheck.code);

        setSearching(true);
        try {
            const res = await fetch(LOOKUP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flightNumber: parsed.full, date }),
            });
            const data = await res.json().catch(() => null);
            const outcome = classifyLookupResponse(res.status, data);
            if (outcome.kind === 'ERROR') return fail(outcome.code);
            setOptions(outcome.options);
            // One leg: it is the flight. Several: the user must choose, never a silent pick.
            setSelectedKey(outcome.options.length === 1 ? outcome.options[0].key : null);
            setStep('confirm');
        } catch {
            fail('NETWORK_ERROR');
        } finally {
            setSearching(false);
        }
    };

    const handleSave = async () => {
        if (saving || !selectedKey) return;
        setErrorCode(null);
        setLimitNote(false);
        setSaving(true);
        try {
            // Only the leg KEY is sent: the server resolves route and times from its own lookup.
            const res = await fetch('/api/trips/monitor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    flightNumber: parseFlightNumber(flightNo)?.full ?? flightNo,
                    date,
                    legKey: selectedKey,
                    pnr: pnr.trim() ? pnr.trim().toUpperCase() : undefined,
                }),
            });
            const data = await res.json().catch(() => null);
            const outcome = classifySaveResponse(res.status, data);

            if (outcome.kind === 'LIMIT') {
                setLimitNote(true);
                setUpgradePrompt({ feature: outcome.feature as FreemiumFeature, current: outcome.current, limit: outcome.limit });
                return;
            }
            if (outcome.kind === 'ERROR') {
                if (outcome.code === 'INVALID_SEGMENT' || outcome.code === 'FLIGHT_NOT_FOUND') {
                    // The lookup behind the selection is gone: back to the form, input kept.
                    setStep('form');
                    setOptions([]);
                    setSelectedKey(null);
                }
                return fail(outcome.code);
            }

            const leg = options.find((o) => o.key === selectedKey);
            const flight = (data && typeof data === 'object' && (data as { flight?: SavedFlight }).flight) || {
                flightNumber: parseFlightNumber(flightNo)?.full ?? flightNo,
                origin: leg?.origin.iata ?? '',
                destination: leg?.destination.iata ?? '',
                date,
            };
            setSaved({ tripId: outcome.tripId, flight });
            setStep('done');
            onSuccess?.();
            router.refresh();
        } catch {
            fail('NETWORK_ERROR');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        router.refresh();
        onClose();
    };

    const editDetails = () => {
        setErrorCode(null);
        setLimitNote(false);
        setStep('form');
    };

    const errorCopy = errorCode ? ADD_TRIP_ERRORS[errorCode] : null;
    const multiple = options.length > 1;
    const inputClass = 'w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {upgradePrompt && (
                <UpgradePrompt
                    feature={upgradePrompt.feature}
                    current={upgradePrompt.current}
                    limit={upgradePrompt.limit}
                    onDismiss={() => setUpgradePrompt(null)}
                />
            )}

            <div role="dialog" aria-modal="true" aria-label="Add booked trip" className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
                <button onClick={handleClose} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 z-10">
                    <X className="w-5 h-5" />
                </button>

                {errorCopy && (
                    <div role="alert" className="mb-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-bold">{errorCopy.title}</p>
                            <p className="text-sm">{errorCopy.message}</p>
                            {errorCopy.note && <p className="mt-1 text-xs text-red-700">{errorCopy.note}</p>}
                        </div>
                    </div>
                )}

                {limitNote && (
                    <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                        {FREE_PLAN_LIMIT_NOTE}
                    </div>
                )}

                {/* STEP 1: ENTER FLIGHT */}
                {step === 'form' && (
                    <form
                        className="space-y-4"
                        onSubmit={(e) => { e.preventDefault(); void handleFindFlight(); }}
                        noValidate
                    >
                        <h3 className="text-xl font-bold text-slate-900">Add Booked Trip</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="add-trip-flight" className="text-xs font-bold text-slate-500 uppercase">Flight Number</label>
                                <input
                                    id="add-trip-flight"
                                    value={flightNo}
                                    onChange={(e) => { setFlightNo(e.target.value.toUpperCase()); setErrorCode(null); }}
                                    placeholder="e.g. QF549"
                                    autoComplete="off"
                                    aria-invalid={errorCode === 'INVALID_FLIGHT_FORMAT' || undefined}
                                    className={`${inputClass} font-bold`}
                                />
                            </div>
                            <div>
                                <label htmlFor="add-trip-date" className="text-xs font-bold text-slate-500 uppercase">Flight Date</label>
                                <input
                                    id="add-trip-date"
                                    type="date"
                                    value={date}
                                    onChange={(e) => { setDate(e.target.value); setErrorCode(null); }}
                                    aria-invalid={errorCode === 'INVALID_DATE' || errorCode === 'DATE_PAST' || errorCode === 'DATE_TOO_FAR' || undefined}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="add-trip-pnr" className="text-xs font-bold text-slate-500 uppercase">PNR (Optional)</label>
                            <input
                                id="add-trip-pnr"
                                value={pnr}
                                onChange={(e) => { setPnr(e.target.value.toUpperCase()); setErrorCode(null); }}
                                placeholder="Booking reference"
                                maxLength={8}
                                autoComplete="off"
                                aria-invalid={errorCode === 'INVALID_PNR' || undefined}
                                className={inputClass}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                PNR helps connect monitoring records to your booking when available.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={searching || !flightNo.trim() || !date}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex justify-center gap-2 items-center hover:bg-slate-800 disabled:opacity-50"
                        >
                            {searching ? <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" /> : <Search className="w-4 h-4" aria-hidden="true" />}
                            {searching ? 'Finding flight…' : 'Find Flight'}
                        </button>
                    </form>
                )}

                {/* STEP 2: CONFIRM THE FLIGHT */}
                {step === 'confirm' && (
                    <div>
                        <h3 className="text-lg font-bold mb-2">{multiple ? ADD_TRIP_ERRORS.MULTIPLE_LEGS.title : 'Is this your flight?'}</h3>
                        {multiple && (
                            <p role="status" className="mb-3 text-sm text-slate-600">{ADD_TRIP_ERRORS.MULTIPLE_LEGS.message}</p>
                        )}

                        <div className="space-y-3 mb-4" role={multiple ? 'radiogroup' : undefined} aria-label={multiple ? 'Available flights' : undefined}>
                            {options.map((leg) => {
                                const airline = airlineDisplayName(leg.airlineCode, leg.airlineName) ?? '';
                                const selected = selectedKey === leg.key;
                                const card = (
                                    <>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-black text-lg text-slate-800">
                                                {[airline, parseFlightNumber(flightNo)?.full ?? flightNo].filter(Boolean).join(' ')}
                                            </span>
                                            <Plane className="w-5 h-5 text-slate-400 rotate-90" aria-hidden="true" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800">
                                            {airportLine(leg.origin)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {airportLine(leg.destination)}
                                        </p>
                                        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <dt className="text-xs font-bold uppercase text-slate-500">Departs</dt>
                                                <dd className="text-slate-800">{formatLocalDateTime(leg.departureLocal) ?? 'Time not yet published'}</dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs font-bold uppercase text-slate-500">Arrives</dt>
                                                <dd className="text-slate-800">{formatLocalDateTime(leg.arrivalLocal) ?? 'Time not yet published'}</dd>
                                            </div>
                                        </dl>
                                    </>
                                );
                                return multiple ? (
                                    <button
                                        type="button"
                                        key={leg.key}
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => { setSelectedKey(leg.key); setErrorCode(null); }}
                                        className={`w-full text-left rounded-xl border-2 p-4 ${selected ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                                    >
                                        {card}
                                    </button>
                                ) : (
                                    <div key={leg.key} className="bg-slate-50 border border-slate-200 p-4 rounded-xl">{card}</div>
                                );
                            })}
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={saving || !selectedKey}
                            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold mb-2 hover:bg-emerald-700 disabled:opacity-50 flex justify-center gap-2 items-center"
                        >
                            {saving && <Loader2 className="animate-spin w-4 h-4" aria-hidden="true" />}
                            {saving ? 'Starting monitoring…' : 'Yes, monitor this trip'}
                        </button>
                        <button onClick={editDetails} disabled={saving} className="w-full text-slate-500 py-2 font-bold hover:text-slate-800">
                            No, edit details
                        </button>
                    </div>
                )}

                {/* STEP 3: SUCCESS */}
                {step === 'done' && saved && (
                    <div className="p-4 text-center" role="status">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8" aria-hidden="true" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">{ADD_TRIP_SUCCESS.title}</h3>
                        <p className="text-slate-500 mt-2 text-sm">{ADD_TRIP_SUCCESS.message}</p>
                        <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                            <div><dt className="text-xs font-bold uppercase text-slate-500">Flight</dt><dd className="font-bold text-slate-900">{saved.flight.flightNumber}</dd></div>
                            <div><dt className="text-xs font-bold uppercase text-slate-500">Route</dt><dd className="font-bold text-slate-900">{saved.flight.origin} → {saved.flight.destination}</dd></div>
                            <div><dt className="text-xs font-bold uppercase text-slate-500">Date</dt><dd className="font-bold text-slate-900">{formatLocalDateTime(`${saved.flight.date}T00:00`)?.split(',')[0] ?? saved.flight.date}</dd></div>
                        </dl>
                        {saved.tripId && (
                            <Link
                                href={`/dashboard/guardian/${saved.tripId}`}
                                className="mt-6 block w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700"
                            >
                                {ADD_TRIP_SUCCESS.primary}
                            </Link>
                        )}
                        <button onClick={handleClose} className="mt-3 text-slate-900 font-bold underline">
                            {ADD_TRIP_SUCCESS.secondary}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
