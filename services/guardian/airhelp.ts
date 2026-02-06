export const AIRHELP_AFFILIATE_ID = process.env.TRAVELPAYOUTS_MARKER || '701049'; // Fallback to user's marker

export function generateCompensationLink(flightNumber: string, date: string, departureAirport: string, arrivalAirport: string): string {
    // AirHelp Affiliate Link Generator Pattern
    // Typically: https://www.airhelp.com/en/?utm_source=travelpayouts&utm_medium=affiliate&utm_campaign=YOUR_MARKER
    // Or deep links if supported. Ideally we send them to the claim form.
    // For now, we point to the main landing page with the tracking params.

    // We can also use the Travelpayouts 'Deep Link' generator URL logic if we were strictly using that,
    // but a direct parameterized URL is often supported. 

    // Let's use the standard TP attribution link for AirHelp
    // Replace with correct deep link format if specific landing page for "Check Flight" exists.

    const baseUrl = "https://www.airhelp.com/en/";
    return `https://tp.media/r?marker=${AIRHELP_AFFILIATE_ID}&trs=197987&p=323&u=${encodeURIComponent(baseUrl)}`;
}

export function checkDisruptionEligibility(flightStatus: any): { eligible: boolean, reason?: string } {
    if (!flightStatus) return { eligible: false };

    // EU 261 Rule: > 3 hours delay
    if (flightStatus.delayMinutes > 180) {
        return { eligible: true, reason: 'Delay > 3 Hours' };
    }

    if (flightStatus.status === 'CANCELLED') {
        const warningDays = 14;
        // Logic to check if cancellation was < 14 days before would need 'announcement date'.
        // Simplified for now:
        return { eligible: true, reason: 'Flight Cancelled' };
    }

    return { eligible: false };
}
