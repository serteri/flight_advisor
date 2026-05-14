'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AirlineClaimHistory } from './AirlineClaimHistory';
import { CompensationBadge, type CompensationBadgeStatus } from './CompensationBadge';

export type CompensationTierView = {
  scenario: string;
  minDelayMinutes: number;
  amount: number | null;
  currency: 'EUR' | 'GBP' | 'AUD';
  eligible: boolean;
  note: string;
};

export type CompensationDetailModalProps = {
  claimId?: string | null;
  passengerName?: string;
  flightNumber: string;
  origin: string;
  destination: string;
  scheduledDate: string;
  carrier: string;
  status: CompensationBadgeStatus;
  regulation: 'EU261' | 'UK261' | 'DGCA' | 'NONE';
  distanceKm?: number | null;
  delayMinutes?: number | null;
  amount?: number | null;
  currency?: 'EUR' | 'GBP' | 'AUD' | null;
  tiers: CompensationTierView[];
};

const regulationCopy: Record<CompensationDetailModalProps['regulation'], string> = {
  EU261: 'EU261/2004 may apply to flights departing the EU, or flights arriving in the EU on an EU carrier.',
  UK261: 'UK261 is the UK passenger-rights equivalent for eligible UK departures and some UK-carrier arrivals.',
  DGCA: 'Australian rules focus on care obligations such as meals, hotel, and rebooking. Cash compensation is not mandatory.',
  NONE: 'This route/carrier combination does not appear to fall under EU261, UK261, or Australian DGCA care rules.',
};

const learnMoreHref: Record<CompensationDetailModalProps['regulation'], string> = {
  EU261: 'https://transport.ec.europa.eu/transport-themes/passenger-rights/air_en',
  UK261: 'https://www.caa.co.uk/passengers/resolving-travel-problems/delays-and-cancellations/',
  DGCA: 'https://www.infrastructure.gov.au/infrastructure-transport-vehicles/aviation/aviation-consumer-protection',
  NONE: 'https://www.flightagent.io',
};

export function CompensationDetailModal(props: CompensationDetailModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const delayHours = props.delayMinutes ? Math.round((props.delayMinutes / 60) * 10) / 10 : undefined;

  const generateLetter = async () => {
    setCopyState('idle');
    const response = await fetch('/api/compensation/generate-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimId: props.claimId,
        passengerName: props.passengerName || 'Passenger',
        flightDetails: {
          flightNumber: props.flightNumber,
          origin: props.origin,
          destination: props.destination,
          scheduledDate: props.scheduledDate,
          delayHours,
          compensationAmount: props.amount ?? undefined,
          currency: props.currency ?? undefined,
          regulation: props.regulation,
        },
      }),
    });

    if (!response.ok) {
      setCopyState('failed');
      return;
    }

    const letter = await response.text();
    await navigator.clipboard.writeText(letter);
    setCopyState('copied');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <CompensationBadge
          status={props.status}
          amount={props.amount}
          currency={props.currency}
        />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compensation intelligence</DialogTitle>
          <DialogDescription>
            Estimated from scheduled times, supplied delay data, route distance, and static regulatory rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{props.flightNumber} {props.origin} to {props.destination}</p>
                <p className="text-xs text-slate-500">
                  {props.distanceKm ? `${props.distanceKm} km` : 'Distance unavailable'} · {props.regulation}
                </p>
              </div>
              <CompensationBadge status={props.status} amount={props.amount} currency={props.currency} />
            </div>
            <p className="mt-3 text-sm text-slate-600">{regulationCopy[props.regulation]}</p>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Amount breakdown</p>
              <p className="text-xs text-slate-500">Potential values are estimates, not guaranteed airline payment outcomes.</p>
            </div>
            <div className="divide-y rounded-md border border-slate-200">
              {props.tiers.map((tier) => (
                <div key={tier.scenario} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{tier.scenario}</p>
                    <p className="text-xs text-slate-500">{tier.note}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {tier.amount ? `${tier.currency} ${tier.amount}` : 'No mandatory cash amount'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <AirlineClaimHistory carrier={props.carrier} />

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <a
              href={learnMoreHref[props.regulation]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
            >
              Learn more about {props.regulation}
            </a>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {copyState === 'copied' ? 'Claim letter copied.' : copyState === 'failed' ? 'Could not generate letter.' : ''}
              </span>
              <Button type="button" onClick={generateLetter} disabled={props.regulation === 'DGCA' || props.regulation === 'NONE'}>
                Generate Claim Letter
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
