// services/guardian/disruption.ts

export async function getAirHelpLink(flightDetails: any): Promise<string | null> {
    // Eğer gecikme 180 dakikadan fazlaysa
    if (flightDetails.delayMinutes >= 180) {
        try {
            const response = await fetch("https://api.travelpayouts.com/links/v1/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Access-Token": process.env.TRAVELPAYOUTS_TOKEN!
                },
                body: JSON.stringify({
                    trs: 197987, // Senin Proje ID'n
                    marker: process.env.TRAVELPAYOUTS_MARKER,
                    links: [{ url: "https://www.airhelp.com/en-int/" }] // AirHelp Ana Sayfası
                })
            });

            const data = await response.json();

            if (data.result && data.result.links && data.result.links[0]) {
                return data.result.links[0].partner_url; // Senin Marker ID'li para kazandıran linkin
            }

            // Fallback to direct link if API fails
            return `https://www.airhelp.com/en-int/?utm_source=flightagent&utm_medium=affiliate&utm_campaign=${process.env.TRAVELPAYOUTS_MARKER}`;
        } catch (error) {
            console.error("Travelpayouts API error:", error);
            // Fallback
            return `https://www.airhelp.com/en-int/?utm_source=flightagent&utm_medium=affiliate&utm_campaign=${process.env.TRAVELPAYOUTS_MARKER}`;
        }
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

export async function analyzeDisruption(flight: any): Promise<DisruptionAnalysis> {
    const delayMinutes = flight.delayMinutes || 0;
    const status = flight.status || 'ON_TIME';

    // EU 261 Compensation Rules
    let compensationAmount = '€0';
    let eligible = false;
    let reason = '';

    if (delayMinutes >= 180) {
        // Calculate compensation based on distance
        const distance = flight.distance || 1000; // km

        if (distance < 1500) {
            compensationAmount = '€250';
        } else if (distance < 3500) {
            compensationAmount = '€400';
        } else {
            compensationAmount = '€600';
        }

        eligible = true;
        reason = `Delay > 3 Hours (${delayMinutes} mins)`;
    } else if (status === 'CANCELLED') {
        compensationAmount = '€600';
        eligible = true;
        reason = 'Flight Cancelled';
    }

    const affiliateLink = eligible ? await getAirHelpLink({ delayMinutes, status }) : undefined;

    return {
        eligible,
        delayMinutes,
        compensationAmount,
        reason,
        affiliateLink
    };
}
