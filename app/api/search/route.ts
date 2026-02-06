// app/api/search/route.ts
import { NextResponse } from 'next/server';
import { analyzeUpgradeOpportunity } from '@/services/guardian/upgradeSniper';
import { analyzeDisruption } from '@/services/guardian/disruption';
import { analyzeSeatMapComfort } from '@/services/agents/seatSpy';

// Helper function to calculate Agent Score based on user's formula
function calculateAgentScore(flight: any, minPrice: number = 0): number {
    const flightPrice = flight.price?.raw || flight.price || 1;
    const stops = flight.legs ? flight.legs.length - 1 : 0;

    // Fallback logic if minPrice isn't calculated globally yet
    // In a real batch processing, minPrice comes from the batch. 
    // Here we approximate or expect it to be passed.
    // For single item calculation without context, we might assume this flight IS the context if checking relative to itself?
    // Actually, score depends on 'market context'.
    // Let's implement the formula structure:
    // Score = (PriceMin / PriceCurrent * 5) + (1 / (Stops + 1) * 3) + ComfortBonus

    // We'll trust the caller (batch processor) or use internal logic if needed.
    // But per user request, we are doing it inside the map. This implies we need the 'minPrice' of the BATCH first.
    // So we will calculate minPrice inside the handler before mapping.

    const priceScore = (minPrice / flightPrice) * 5;
    const stopScore = (1 / (stops + 1)) * 3;
    const comfortBonus = 2; // Placeholder for Sandbox Wi-Fi/Seat data

    let score = priceScore + stopScore + comfortBonus;
    return parseFloat(score.toFixed(1));
}

export async function POST(req: Request) {
    try {
        const { origin, destination, date } = await req.json();

        // 1. RapidAPI Air Scraper Çağrısı
        // Note: 'date' format for Air Scraper might need to be YYYY-MM-DD. Assumed correct input.
        const rapidApiKey = process.env.RAPID_API_KEY;
        if (!rapidApiKey) {
            return NextResponse.json({ error: "Configuration Error: RAPID_API_KEY missing" }, { status: 500 });
        }

        const scraperRes = await fetch(`https://air-scraper.p.rapidapi.com/flights/search?from=${origin}&to=${destination}&date=${date}`, {
            headers: {
                'X-RapidAPI-Key': rapidApiKey,
                'X-RapidAPI-Host': 'air-scraper.p.rapidapi.com'
            }
        });

        if (!scraperRes.ok) {
            console.error("RapidAPI Error:", await scraperRes.text());
            return NextResponse.json({ error: "Flight provider currently unavailable" }, { status: 502 });
        }

        const rawData = await scraperRes.json();
        // Air Scraper response structure varies, assuming 'data.flights' or similar list.
        // Adjusting based on common Scraper API structures (often explicitly 'flights' or similar).
        // If rawData is directly the array (as implied by user code), utilize it.
        const rawFlights = rawData.flights || rawData;

        if (!Array.isArray(rawFlights)) {
            return NextResponse.json({ error: "Invalid provider response format" }, { status: 502 });
        }

        // Calculate Batch Stats (Min Price) for Scoring
        const prices = rawFlights.map((f: any) => f.price?.raw || f.price).filter((p: any) => typeof p === 'number');
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;


        // 2. Travelpayouts ile Affiliate Linklerini Üret (Toplu İşlem)
        // Preparation: Extract deeplinks. 
        // Note: Travelpayouts /links/v1/create accepts a list of URLs.
        const linksToShorten = rawFlights.map((f: any) => ({ url: f.deepLink || f.url })); // 'deepLink' or 'url' depending on provider

        const tpToken = process.env.TRAVELPAYOUTS_TOKEN;
        const tpMarker = process.env.TRAVELPAYOUTS_MARKER;

        let affiliateLinks: string[] = [];

        if (tpToken && tpMarker) {
            try {
                const affiliateRes = await fetch("https://api.travelpayouts.com/links/v1/create", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Access-Token": tpToken
                    },
                    body: JSON.stringify({
                        trs: 197987, // Project ID as per user prompt (or use 197987) -> User said "Your Project ID"
                        marker: tpMarker,
                        shorten: true,
                        links: linksToShorten
                    })
                });

                if (affiliateRes.ok) {
                    const affiliateData = await affiliateRes.json();
                    // Map back results. affiliateData.result.links is array of objects { original, partner_url }
                    affiliateLinks = affiliateData.result?.links?.map((l: any) => l.partner_url) || [];
                }
            } catch (e) {
                console.error("Travelpayouts Link Gen Error:", e);
                // Fallback: use original links if TP fails
            }
        }

        // 3. Agent Score Hesapla ve Agent Modülleri ile Enrich Et
        const finalFlights = await Promise.all(rawFlights.map(async (flight: any, index: number) => {
            const score = calculateAgentScore(flight, minPrice);

            // Safe access to affiliate link (if generated successfully, otherwise original)
            const affiliateUrl = affiliateLinks[index] || flight.deepLink || flight.url;

            // 🎯 UPGRADE SNIPER
            const economyPrice = flight.price?.raw || flight.price || 0;
            const businessPrice = flight.businessPrice || (economyPrice * 2.5); // Mock for now
            const sniperResult = analyzeUpgradeOpportunity(economyPrice, businessPrice);

            // 🛡️ DISRUPTION HUNTER
            const delayMinutes = flight.delayMinutes || 0;
            const disruption = await analyzeDisruption(flight);

            // 💺 POOR MAN'S BUSINESS (Seat Spy)
            // Note: Would need seatmap data from Amadeus. For now, simulate or skip.
            // If flight has seatMapData property, analyze it:
            let poorMansBusiness = null;
            if (flight.seatMapData) {
                const seatAnalysis = analyzeSeatMapComfort(flight.seatMapData);
                poorMansBusiness = seatAnalysis.poorMansBusiness;
            }

            return {
                ...flight,
                affiliateUrl: affiliateUrl,
                agentScore: score,
                // Agent Module Enrichments
                sniperDeal: sniperResult.isSniperDeal ? sniperResult : null,
                disruptionLink: disruption.affiliateLink || null,
                delayMinutes: delayMinutes,
                poorMansBusiness: poorMansBusiness
            };
        }));

        // 4. Sort by Agent Score (Smart Sorting)
        finalFlights.sort((a: any, b: any) => (b.agentScore || 0) - (a.agentScore || 0));

        return NextResponse.json(finalFlights);

    } catch (error) {
        console.error("Hybrid Search Error:", error);
        return NextResponse.json({ error: "Motor ateşlenemedi" }, { status: 500 });
    }
}
