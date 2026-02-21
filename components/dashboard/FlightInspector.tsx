'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AlertCircle, Search, Loader2 } from 'lucide-react';

interface InspectionResult {
  success: boolean;
  partial?: boolean;
  warning?: string;
  data: {
    flightNumber: string;
    date: string;
    origin: string;
    destination: string;
    aerodatabox: {
      status: string;
      medianDelay: number;
      delayPercentages: {
        veryLate: number;
        late: number;
        onTime: number;
      };
      cancelledPercentage: number;
      totalFlights: number;
    };
    offer: any;
    masterScore: number;
    scoreDetails: any;
    hiddenTraps: Array<{
      type: string;
      title: string;
      detail: string;
    }>;
    recommendation: string;
  };
}

interface FlightInspectorProps {
  locale: string;
}

export function FlightInspector({ locale }: FlightInspectorProps) {
  const router = useRouter();
  const [flightNumber, setFlightNumber] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InspectionResult | null>(null);

  const handleInspect = async () => {
    setError('');
    setResult(null);

    if (!flightNumber.trim()) {
      setError('Please enter a flight number (e.g., TK1999)');
      return;
    }

    if (!date) {
      setError('Please select a departure date');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/flights/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightNumber: flightNumber.toUpperCase(),
          date,
        }),
      });

      if (response.status === 403) {
        router.push(`/${locale}/pricing`);
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            'Failed to inspect flight. Please try again.'
        );
        return;
      }

      setResult(data);
    } catch (err) {
      setError('Connection error. Please try again.');
      console.error('Inspection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInspect();
    }
  };

  if (result) {
    return (
      <FlightInspectionResult
        result={result}
        locale={locale}
        onBack={() => setResult(null)}
      />
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto p-6 bg-slate-900 border-slate-700">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Flight Inspector
          </h2>
          <p className="text-slate-400">
            Inspect any flight before booking to see real-time pricing,
            historical delays, and booking recommendations.
          </p>
        </div>

        <div className="space-y-4">
          {/* Flight Number Input */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Flight Number
            </label>
            <Input
              type="text"
              placeholder="e.g., TK1999, AA100, LH411"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="bg-slate-800 border-slate-600 text-white placeholder-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Enter airline code + flight number
            </p>
          </div>

          {/* Date Input */}
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Departure Date
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
              className="bg-slate-800 border-slate-600 text-white"
            />
            <p className="text-xs text-slate-500 mt-1">
              Select the departure date
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex gap-3 p-3 bg-red-950/50 border border-red-700/50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}

          {/* Inspect Button */}
          <Button
            onClick={handleInspect}
            disabled={loading || !flightNumber || !date}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Inspecting...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Inspect Flight
              </>
            )}
          </Button>

          {/* Info Box */}
          <div className="p-3 bg-blue-950/30 border border-blue-700/30 rounded-lg">
            <p className="text-xs text-blue-200">
              💡
              <strong>Tip:</strong> Use this tool to verify flight reliability
              before booking. We show historical delays, price trends, and
              booking conditions to help you make informed decisions.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface FlightInspectionResultProps {
  result: InspectionResult;
  locale: string;
  onBack: () => void;
}

function FlightInspectionResult({
  result,
  locale,
  onBack,
}: FlightInspectionResultProps) {
  const [bookingPnr, setBookingPnr] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const router = useRouter();

  const handleTrackFlight = async () => {
    setTracking(true);
    setTrackingError('');

    try {
      const response = await fetch(
        `/${locale}/api/inspector/book-and-track`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flightNumber: result.data.flightNumber,
            date: result.data.date,
            origin: result.data.origin,
            destination: result.data.destination,
            price: result.data.offer?.price,
            pnr: bookingPnr || `AUTO-${Date.now()}`,
            offer: result.data.offer,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setTrackingError(
          data.error ||
            'Failed to start tracking. Please try again.'
        );
        return;
      }

      // Success - redirect to dashboard
      router.push(
        `/${locale}/dashboard?tripId=${data.tripId}&newTracking=true`
      );
    } catch (err) {
      setTrackingError('Connection error. Please try again.');
      console.error('Tracking error:', err);
    } finally {
      setTracking(false);
    }
  };

  const { data } = result;
  const scoreColor =
    data.masterScore >= 8
      ? 'text-green-400'
      : data.masterScore >= 6
        ? 'text-yellow-400'
        : data.masterScore >= 4
          ? 'text-orange-400'
          : 'text-red-400';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <Button
        onClick={onBack}
        variant="ghost"
        className="text-slate-400 hover:text-white"
      >
        ← Back to Inspector
      </Button>

      {/* Warning Banner */}
      {result.partial && (
        <div className="p-4 bg-yellow-950/50 border border-yellow-700/50 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-200">
              {result.warning}
            </p>
            <p className="text-sm text-yellow-300 mt-1">
              Showing historical data from AeroDataBox.
            </p>
          </div>
        </div>
      )}

      {/* Main Report Card */}
      <Card className="bg-slate-900 border-slate-700 p-6">
        <div className="space-y-6">
          {/* Flight Header */}
          <div className="border-b border-slate-700 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">
                  {data.flightNumber}
                </h1>
                <p className="text-slate-400">
                  {data.origin} → {data.destination} • {data.date}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-4xl font-bold ${scoreColor} mb-1`}>
                  {data.masterScore.toFixed(1)}
                </div>
                <p className="text-xs text-slate-400">Master Score</p>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <p className="text-slate-200">
              <strong>Overall Recommendation:</strong>
            </p>
            <p className="text-lg text-lime-400 font-medium mt-2">
              {data.recommendation}
            </p>
          </div>

          {/* Punctuality Section */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">
              📊 Punctuality Record
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-green-400">
                  {data.aerodatabox.delayPercentages?.onTime || 0}%
                </div>
                <p className="text-xs text-slate-400 mt-1">On Time</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-400">
                  {data.aerodatabox.delayPercentages?.late || 0}%
                </div>
                <p className="text-xs text-slate-400 mt-1">Minor Delay</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-red-400">
                  {data.aerodatabox.delayPercentages?.veryLate || 0}%
                </div>
                <p className="text-xs text-slate-400 mt-1">Major Delay</p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-lg">
                <div className="text-2xl font-bold text-purple-400">
                  {data.aerodatabox.cancelledPercentage || 0}%
                </div>
                <p className="text-xs text-slate-400 mt-1">Cancelled</p>
              </div>
            </div>
            {data.aerodatabox.totalFlights > 0 && (
              <p className="text-xs text-slate-500 mt-3">
                Based on {data.aerodatabox.totalFlights} recent flights
              </p>
            )}
          </div>

          {/* Hidden Traps Section */}
          {data.hiddenTraps.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                ⚠️ Hidden Traps
              </h3>
              <div className="space-y-2">
                {data.hiddenTraps.map((trap, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-orange-950/30 border border-orange-700/30 rounded-lg flex gap-3"
                  >
                    <div className="text-orange-400 font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-orange-200">
                        {trap.title}
                      </p>
                      <p className="text-sm text-orange-300 mt-1">
                        {trap.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing Section */}
          {data.offer && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                💰 Pricing
              </h3>
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 mb-1">Total Price</p>
                    <p className="text-3xl font-bold text-lime-400">
                      {data.offer.price}{' '}
                      {data.offer.currency}
                    </p>
                  </div>
                  {data.offer.duration && (
                    <div className="text-right">
                      <p className="text-slate-400 mb-1">Duration</p>
                      <p className="text-xl font-semibold text-white">
                        {data.offer.duration}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tracking CTA */}
          <div className="border-t border-slate-700 pt-4">
            <h3 className="text-lg font-semibold text-white mb-3">
              Ready to book?
            </h3>
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                After booking, click below to enable AI monitoring. We'll track
                delays, price changes, and help you claim compensation if
                needed.
              </p>

              {/* Optional PNR Input */}
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  PNR (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="Enter booking reference (optional)"
                  value={bookingPnr}
                  onChange={(e) => setBookingPnr(e.target.value)}
                  disabled={tracking}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  If empty, a tracking ID will be auto-generated
                </p>
              </div>

              {trackingError && (
                <div className="flex gap-3 p-3 bg-red-950/50 border border-red-700/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-200">{trackingError}</p>
                </div>
              )}

              <Button
                onClick={handleTrackFlight}
                disabled={tracking}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {tracking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Tracking...
                  </>
                ) : (
                  <>
                    ✓ I Booked This - Track for Delays
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
