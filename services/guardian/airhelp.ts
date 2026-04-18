import { buildAirHelpLink } from '@/lib/monetization/travelpayouts';

export function generateCompensationLink(
    _flightNumber: string,
    _date: string,
    _departureAirport: string,
    _arrivalAirport: string,
): string {
    return buildAirHelpLink();
}

export function checkDisruptionEligibility(flightStatus: any): { eligible: boolean; reason?: string } {
    if (!flightStatus) return { eligible: false };
    if (flightStatus.delayMinutes > 180) {
        return { eligible: true, reason: 'Delay > 3 hours' };
    }
    if (flightStatus.status === 'CANCELLED') {
        return { eligible: true, reason: 'Flight cancelled' };
    }
    return { eligible: false };
}
