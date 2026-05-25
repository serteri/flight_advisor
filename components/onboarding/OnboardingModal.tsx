'use client';

import { useState } from 'react';

type OnboardingModalProps = {
  enabled: boolean;
};

const STORAGE_KEY = 'fa_onboarding_complete';

const STEPS = [
  {
    title: 'Paste any itinerary',
    description:
      'Found a flight on Google Flights or Skyscanner? Paste the details here. FlightAgent scores it for you.',
    visual: (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 h-2 w-24 rounded bg-slate-200" />
        <div className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-400 flex items-center">
          SYD -&gt; IST, 16 Jul, QF + TK, AUD 1480
        </div>
      </div>
    ),
  },
  {
    title: 'Get your decision score',
    description:
      'We analyze connection risk, fare context, and route quality. You get a BUY / WAIT / WATCH decision.',
    visual: (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
          8.4 - BUY
        </div>
      </div>
    ),
  },
  {
    title: 'Monitor after booking',
    description:
      "Add your confirmed trip. We'll watch for disruptions and tell you your passenger rights if things go wrong.",
    visual: (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Alert: TK198 delayed 95m. Compensation signal available.
      </div>
    ),
  },
] as const;

export function OnboardingModal({ enabled }: OnboardingModalProps) {
  const [completed, setCompleted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [step, setStep] = useState(0);

  if (!enabled || completed) return null;

  const current = STEPS[step];
  const lastStep = step === STEPS.length - 1;

  const handleNext = () => {
    if (!lastStep) {
      setStep((value) => value + 1);
      return;
    }

    localStorage.setItem(STORAGE_KEY, 'true');
    setCompleted(true);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-2 flex-1 rounded-full ${index <= step ? 'bg-slate-900' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <h2 className="text-2xl font-bold text-slate-900">{current.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{current.description}</p>

        <div className="mt-5">{current.visual}</div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {lastStep ? 'Start for free ->' : 'Next ->'}
          </button>
        </div>
      </div>
    </div>
  );
}
