
import { getSmartHubs } from '@/lib/massiveHubDB';
import { searchFlights } from '@/lib/amadeus'; // Using the amadeus wrapper directly
import { FlightForScoring } from '@/lib/flightScoreEngine';
import { getAirlineInfo } from '@/lib/airlineDB'; // Add this import

// Tarih ekleme yardımcısı (YYYY-MM-DD formatı için)
function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

interface RawFlightResult {
    data?: any[];
    dictionaries?: any;
    // Add other fields if necessary from the Amadeus response
}

function parseRawFlightsToScorable(
    rawResult: RawFlightResult,
    originOverride?: string,
    destinationOverride?: string
): FlightForScoring[] {
    if (!rawResult || !rawResult.data) return [];

    const carrierDictionaries = rawResult.dictionaries?.carriers || {};

    return rawResult.data.map((f: any): FlightForScoring => {
        const itinerary = f.itineraries[0];
        const segments = itinerary.segments;

        // Basic parsing similar to the main route handler
        // Simplified for internal usage
        const price = parseFloat(f.price.total);
        const currency = f.price.currency;

        // Parse duration
        const durationMatch = itinerary.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        let duration = 0;
        if (durationMatch) {
            const hours = parseInt(durationMatch[1] || '0');
            const minutes = parseInt(durationMatch[2] || '0');
            duration = hours * 60 + minutes;
        }

        const carrier = f.validatingAirlineCodes[0];

        // Map segments
        const parsedSegments = segments.map((seg: any) => ({
            from: seg.departure.iataCode,
            to: seg.arrival.iataCode,
            carrier: seg.carrierCode,
            carrierName: carrierDictionaries[seg.carrierCode] || getAirlineInfo(seg.carrierCode).name || seg.carrierCode,
            flightNumber: `${seg.carrierCode}${seg.number}`,
            departure: seg.departure.at,
            arrival: seg.arrival.at,
            duration: 0, // Not parsing segment duration here for simplicity unless needed
        }));

        // Baggage parsing (simplified)
        let baggageWeight = 0;
        let baggageQuantity = 0;
        let fareRestrictions = { refundable: false, changeable: false, seatSelection: false, mealIncluded: false };

        try {
            // Basic extraction if available
            const travelerPricing = f.travelerPricings?.[0];
            const checkedBags = travelerPricing?.fareDetailsBySegment?.[0]?.includedCheckedBags;
            if (checkedBags) {
                baggageWeight = checkedBags.weight || 0;
                baggageQuantity = checkedBags.quantity || 0;
            }
        } catch (e) { }

        // DB Fallback if API returned 0
        if (baggageWeight === 0 && baggageQuantity === 0) {
            const info = getAirlineInfo(carrier);
            if (info.hasFreeBag) {
                baggageWeight = 23;
            }
        }

        return {
            id: f.id,
            price,
            currency,
            duration,
            stops: segments.length - 1,
            carrier,
            carrierName: carrierDictionaries[carrier] || getAirlineInfo(carrier).name || carrier,
            departureTime: segments[0].departure.at,
            arrivalTime: segments[segments.length - 1].arrival.at,
            segments: parsedSegments,
            baggageWeight,
            baggageQuantity,
            fareRestrictions,
            // Original data needed for construction
            _raw: f
        };
    });
}

export async function findVirtualInterlineFlights(
    origin: string,
    destination: string,
    date: string,
    adults: number = 1
): Promise<FlightForScoring[]> {
    console.log(`🕵️♂️ Hacker Fare aranıyor: ${origin} -> ${destination}`);

    // 1. YENİ AKILLI SİSTEMDEN HUB SEÇ
    const potentialHubs = getSmartHubs(origin, destination);

    // API kotasını korumak için en stratejik 3 hub'ı seçiyoruz
    const selectedHubs = potentialHubs.slice(0, 3);

    const hackerResults: FlightForScoring[] = [];

    // Her Hub için SIRALI (Sequential) arama başlat (Rate Limit'ten kaçınmak için)
    // Eski paralel sistem 429 hatası verdiği için yavaş ama güvenli metoda geçtik.
    for (const hub of selectedHubs) {
        // Hub, kalkış veya varış yeriyle aynıysa atla (Saçma rota olmasın)
        if (hub === origin || hub === destination) continue;

        try {
            // Küçük bir bekleme (Rate Limit nezaketi)
            await new Promise(r => setTimeout(r, 800));

            // -----------------------------------------------------------
            // BACAK 1: Origin -> Hub (Örn: BNE -> KUL)
            // -----------------------------------------------------------
            const leg1Raw = await searchFlights({
                origin,
                destination: hub,
                departureDate: date,
                adults
            });
            const leg1Flights = parseRawFlightsToScorable(leg1Raw);

            if (leg1Flights.length === 0) continue;

            // -----------------------------------------------------------
            // BACAK 2: Hub -> Destination (Örn: KUL -> IST)
            // 🔥 GÜNCELLEME: Hem aynı günü hem de ERTESİ günü tara!
            // -----------------------------------------------------------
            const nextDate = addDays(date, 1);

            // Bacak 2 aramalarını da biraz ayırabiliriz veya paralel bırakabiliriz.
            // Şimdilik 2 isteği paralel yapalım, hublar arası seri olsun.
            const [leg2TodayRaw, leg2TomorrowRaw] = await Promise.all([
                searchFlights({ origin: hub, destination, departureDate: date, adults }),
                searchFlights({ origin: hub, destination, departureDate: nextDate, adults })
            ]);

            // ID Çakışmasını önlemek için tarih bazlı suffix ekle
            const leg2Today = parseRawFlightsToScorable(leg2TodayRaw).map(f => ({ ...f, id: `${f.id}-D0` }));
            // Ertesi gün uçuşlarının ID'sine -D1 ekle
            const leg2Tomorrow = parseRawFlightsToScorable(leg2TomorrowRaw).map(f => ({ ...f, id: `${f.id}-D1` }));

            const leg2Flights = [...leg2Today, ...leg2Tomorrow];

            // -----------------------------------------------------------
            // STITCHING (DİKİŞ) MANTIĞI
            // -----------------------------------------------------------
            for (const f1 of leg1Flights) {
                for (const f2 of leg2Flights) {

                    const arrival1 = new Date(f1.arrivalTime).getTime();
                    const departure2 = new Date(f2.departureTime).getTime();
                    const layoverMs = departure2 - arrival1;
                    const layoverHours = layoverMs / (1000 * 60 * 60);

                    // ⚠️ KURAL: En az 4 saat (Risk payı), En fazla 24 saat (Sürünme payı)
                    if (layoverHours >= 4 && layoverHours <= 24) {

                        // YENİ UÇUŞ OLUŞTUR 🧟♂️
                        const combinedFlight: FlightForScoring = {
                            id: `hacker-${hub}-${f1.id}-${f2.id}`, // Unique ID
                            airline: `${f1.carrier} + ${f2.carrier}`,
                            carrier: 'MIX',
                            carrierName: `${f1.carrierName} + ${f2.carrierName}`,

                            price: f1.price + f2.price,
                            currency: f1.currency, // Assuming same currency!

                            duration: f1.duration + f2.duration + (layoverHours * 60),
                            stops: f1.stops + f2.stops + 1, // Hub stop

                            departureTime: f1.departureTime,
                            arrivalTime: f2.arrivalTime,

                            segments: [...(f1.segments || []), ...(f2.segments || [])],

                            // Layover info needs to be explicitly merged
                            layovers: [
                                ...(f1.layovers || []),
                                {
                                    airport: hub,
                                    duration: Math.round(layoverHours * 60),
                                    city: hub // Can be refined later
                                },
                                ...(f2.layovers || [])
                            ],

                            // Use worst baggage
                            baggageWeight: Math.min(f1.baggageWeight || 0, f2.baggageWeight || 0),
                            baggageQuantity: Math.min(f1.baggageQuantity || 0, f2.baggageQuantity || 0),

                            // Flag for UI - ONLY True if BOTH legs have confirmed baggage
                            baggageIncluded: ((f1.baggageWeight || 0) > 0 && (f2.baggageWeight || 0) > 0) || (f1.baggageIncluded && f2.baggageIncluded),

                            // Flag for UI
                            isSelfTransfer: true,
                            fareRestrictions: {
                                refundable: false,
                                changeable: false,
                                seatSelection: false,
                                mealIncluded: false
                            }
                        };

                        hackerResults.push(combinedFlight);
                    }
                }
            }

        } catch (error) {
            console.error(`Hub hatası (${hub}):`, error);
        }
    }

    console.log(`✅ Toplam ${hackerResults.length} adet Hacker Fare bulundu.`);
    return hackerResults;
}
