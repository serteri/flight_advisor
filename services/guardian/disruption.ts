// services/guardian/disruption.ts
import { buildAirHelpLink } from '@/lib/monetization/travelpayouts';

export function getAirHelpLink(flightDetails: { delayMinutes: number }): string | null {
    if (flightDetails.delayMinutes >= 180) {
        return buildAirHelpLink();
    }
    return null;
}

export interface DisruptionAnalysis {
    eligible: boolean;
    delayMinutes: number;
    compensationAmount: string;
    reason: string;
    affiliateLink?: string;
}

export function analyzeDisruption(flight: any): DisruptionAnalysis {
    const delayMinutes = flight.delayMinutes || 0;
    const status = flight.status || 'ON_TIME';
    const distance = flight.distance || 1000;

    let compensationAmount = '€0';
    let eligible = false;
    let reason = '';

    if (delayMinutes >= 180) {
        if (distance < 1500)      compensationAmount = '€250';
        else if (distance < 3500) compensationAmount = '€400';
        else                       compensationAmount = '€600';
        eligible = true;
        reason = `Delay > 3 hours (${delayMinutes} min)`;
    } else if (status === 'CANCELLED') {
        if (distance < 1500)      compensationAmount = 'up to €250';
        else if (distance < 3500) compensationAmount = 'up to €400';
        else                       compensationAmount = 'up to €600';
        eligible = true;
        reason = 'Flight cancelled';
    }

    const affiliateLink = eligible ? getAirHelpLink({ delayMinutes }) ?? undefined : undefined;

    return { eligible, delayMinutes, compensationAmount, reason, affiliateLink };
}
