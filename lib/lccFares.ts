import { FlightForScoring } from "@/lib/flightScoreEngine";

// Helper for date manipulation
function addHours(date: Date, hours: number) {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
}

// BNE -> IST LCC Rotaları (Manuel Tanımlı 'Mock' LCC Verisi)
// Gerçek dünyada burası Puppeteer veya özel API'ler (Travelfusion vb.) ile çalışır.
export async function searchLCCFares(origin: string, destination: string, date: string): Promise<FlightForScoring[]> {
    console.log(`🦜 LCC (Pegasus/AirAsia) Taranıyor: ${origin} -> ${destination}`);

    // Sadece demo rotası (BNE -> IST) için 'Hardcoded' mantık
    if (!['BNE', 'SYD', 'MEL'].includes(origin) || destination !== 'IST') {
        return [];
    }

    const departureBase = new Date(date);
    departureBase.setHours(10, 0, 0, 0); // Sabah 10:00 baz alalım

    // Rota 1: AirAsia (BNE -> KUL) + Turkish/Pegasus (KUL -> IST)
    // Fiyat: ~650 AUD (Çok ucuz)
    const flight1: FlightForScoring = {
        id: `lcc-aa-pc-1`,
        price: 645.50,
        currency: "AUD",
        effectivePrice: 750.00, // Bagaj eklenince artar
        duration: 26 * 60, // 26 saat
        stops: 1,
        carrier: "D7", // AirAsia X
        carrierName: "AirAsia X + Pegasus",
        carriers: ["D7", "PC"],
        carrierNames: ["AirAsia X", "Pegasus Airlines"],
        departureTime: addHours(departureBase, 2).toISOString(), // 12:00
        arrivalTime: addHours(departureBase, 28).toISOString(), // Ertesi gün 14:00
        segments: [
            {
                from: origin,
                to: "KUL",
                carrier: "D7",
                carrierName: "AirAsia X",
                flightNumber: "D7 201",
                departure: addHours(departureBase, 2).toISOString(),
                arrival: addHours(departureBase, 10).toISOString(),
                duration: 8 * 60,
                baggageWeight: 0,
                baggageQuantity: 0,
                cabin: "ECONOMY",
                baggageDisplay: "0kg"
            },
            {
                from: "KUL",
                to: "IST",
                carrier: "PC",
                carrierName: "Pegasus",
                flightNumber: "PC 4122",
                departure: addHours(departureBase, 16).toISOString(), // 6 saat layover
                arrival: addHours(departureBase, 28).toISOString(),
                duration: 12 * 60,
                baggageWeight: 0,
                baggageQuantity: 0,
                cabin: "ECONOMY", // Pegasus Economy
                baggageDisplay: "0kg"
            }
        ],
        layovers: [
            { airport: "KUL", duration: 6 * 60, city: "Kuala Lumpur" }
        ],
        layoverHoursTotal: 6,
        isSelfTransfer: true, // KRİTİK: Bu bir Hacker Fare!
        baggageIncluded: false,
        cabinBagOnly: true,
        fareRestrictions: {
            refundable: false,
            changeable: false,
            mealIncluded: false,
            seatSelection: false
        },
        analysis: {
            scoreSentiment: "neutral",
            headlineKey: "flightConsultant.headlines.superCheap", // "İnanılmaz Ucuz!"
            pros: [{ key: "flightConsultant.pros.price", params: {} }],
            cons: [{ key: "flightConsultant.cons.selfTransfer", params: {} }, { key: "flightConsultant.cons.noBaggage", params: {} }]
        }
    };

    // Rota 2: Scoot (BNE -> SIN) + Scoot/Others (SIN -> IST)
    const flight2: FlightForScoring = {
        id: `lcc-scoot-mixed-1`,
        price: 712.90,
        currency: "AUD",
        effectivePrice: 820.00,
        duration: 23 * 60,
        stops: 1,
        carrier: "TR",
        carrierName: "Scoot + AJet",
        carriers: ["TR", "VF"],
        carrierNames: ["Scoot", "AJet"],
        departureTime: addHours(departureBase, -1).toISOString(), // 09:00
        arrivalTime: addHours(departureBase, 22).toISOString(), // Ertesi gün 08:00
        segments: [
            {
                from: origin,
                to: "SIN",
                carrier: "TR",
                carrierName: "Scoot",
                flightNumber: "TR 19",
                departure: addHours(departureBase, -1).toISOString(),
                arrival: addHours(departureBase, 7).toISOString(),
                duration: 8 * 60,
                baggageWeight: 0,
                baggageQuantity: 0,
                cabin: "ECONOMY",
                baggageDisplay: "0kg"
            },
            {
                from: "SIN",
                to: "IST",
                carrier: "VF",
                carrierName: "AJet", // Eski Anadolujet
                flightNumber: "VF 55",
                departure: addHours(departureBase, 11).toISOString(), // 4 saat layover
                arrival: addHours(departureBase, 22).toISOString(),
                duration: 11 * 60,
                baggageWeight: 0,
                baggageQuantity: 0,
                cabin: "ECONOMY",
                baggageDisplay: "0kg"
            }
        ],
        layovers: [
            { airport: "SIN", duration: 4 * 60, city: "Singapore" }
        ],
        layoverHoursTotal: 4,
        isSelfTransfer: true,
        baggageIncluded: false,
        cabinBagOnly: true,
        fareRestrictions: {
            refundable: false,
            changeable: false,
            mealIncluded: false,
            seatSelection: false
        }
    };

    return [flight1, flight2];
}
