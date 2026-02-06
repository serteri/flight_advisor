/**
 * Flight Insight Engine + Consultant AI
 * 
 * Generates:
 * - Badges (Best Deal, Cheapest, Fastest)
 * - Pros (Why choose this flight?)
 * - Risks (Red flags)
 * - Trade-Off Analysis (Time vs Money)
 * - Consultant Recommendation (Strong Yes / Conditional / Avoid)
 */

// ----------------------------
// INTERFACES
// ----------------------------

export interface FlightForInsights {
    id: string;
    price: number;
    duration: number; // minutes
    stops: number;
    carrier: string;
    carrierName: string;
    layoverHoursTotal?: number;
    score: number;
    baggageIncluded?: boolean;
    baggageWeight?: number;
    [key: string]: any;
}

export interface FlightBadge {
    label: string;
    color: 'green' | 'blue' | 'yellow' | 'red' | 'gray';
}

export interface TradeOff {
    title: string;
    titleEn: string;
    description: string;
    sentiment: 'positive' | 'neutral' | 'warning';
}

export interface ConsultantRecommendation {
    level: 'strong_yes' | 'conditional' | 'avoid';
    message: string;
    emoji: string;
}

export interface BaggageInfo {
    included: boolean;
    weight: number | null;
    quantity: number | null;
    display: string;
}

export interface FareRestriction {
    type: 'no_refund' | 'change_fee' | 'seat_fee' | 'meal_fee' | 'cabin_bag_only' | 'limited_baggage';
    icon: string;
    label: string;
    description: string;
}

export interface FlightInsights {
    badges: FlightBadge[];
    pros: string[];
    risks: string[];
    tradeOff: TradeOff | null;
    consultant: ConsultantRecommendation;
    baggageInfo: BaggageInfo;
    fareRestrictions: FareRestriction[];
    isCheapestTier: boolean;
}

// ----------------------------
// MAIN FUNCTION
// ----------------------------

export function generateFlightInsights(
    flight: FlightForInsights,
    allFlights: FlightForInsights[],
    smartMinPrice: number,
    fastestDuration: number
): FlightInsights {
    // Determine if this is a cheapest tier flight
    const actualMinPrice = Math.min(...allFlights.map(f => f.price));
    const cheapestFlight = allFlights.find(f => f.price === actualMinPrice);
    const fastestFlight = allFlights.find(f => f.duration === fastestDuration);

    const isCheapestTier = flight.price <= actualMinPrice * 1.10; // Within 10% of cheapest

    const insights: FlightInsights = {
        badges: [],
        pros: [],
        risks: [],
        tradeOff: null,
        consultant: { level: 'conditional', message: '', emoji: '⚖️' },
        baggageInfo: {
            included: flight.baggageIncluded || false,
            weight: flight.baggageWeight || null,
            quantity: flight.baggageQuantity || null,
            display: ''
        },
        fareRestrictions: [],
        isCheapestTier: isCheapestTier
    };

    // Set baggage display text
    if (flight.baggageIncluded && flight.baggageWeight) {
        insights.baggageInfo.display = `🧳 ${flight.baggageWeight}kg bagaj dahil`;
    } else if (flight.baggageIncluded && flight.baggageQuantity) {
        insights.baggageInfo.display = `🧳 ${flight.baggageQuantity} parça bagaj dahil`;
    } else if (flight.baggageIncluded) {
        insights.baggageInfo.display = "🧳 Bagaj hakkı dahil";
    } else {
        insights.baggageInfo.display = "⚠️ Bagaj bilgisi mevcut değil";
    }

    // ========================================
    // FARE RESTRICTIONS ANALYSIS
    // ========================================

    // Check refundability
    if (flight.isRefundable === false || (isCheapestTier && flight.isRefundable !== true)) {
        insights.fareRestrictions.push({
            type: 'no_refund',
            icon: '🚫',
            label: 'İade Yok',
            description: 'Bu bilet iade edilemez. Planlarınız kesinse tercih edin.'
        });
    }

    // Check changeability
    if (flight.isChangeable === false || (isCheapestTier && flight.isChangeable !== true)) {
        insights.fareRestrictions.push({
            type: 'change_fee',
            icon: '💱',
            label: 'Değişiklik Ücretli',
            description: 'Tarih/uçuş değişikliği için ücret ödenebilir.'
        });
    }

    // Check seat selection
    if (flight.seatSelectionIncluded === false || (isCheapestTier && flight.seatSelectionIncluded !== true)) {
        insights.fareRestrictions.push({
            type: 'seat_fee',
            icon: '💺',
            label: 'Koltuk Seçimi Ücretli',
            description: 'Koltuk seçimi için ek ücret ödemeniz gerekebilir.'
        });
    }

    // Check meal
    if (flight.mealIncluded === false && flight.fareClass === 'ECONOMY') {
        insights.fareRestrictions.push({
            type: 'meal_fee',
            icon: '🍽️',
            label: 'Yemek Ücretli',
            description: 'Uçak içi yemek hizmeti ücretlidir.'
        });
    }

    // Check baggage
    if (!flight.baggageIncluded || flight.cabinBagOnly) {
        insights.fareRestrictions.push({
            type: 'cabin_bag_only',
            icon: '🎒',
            label: 'Sadece Kabin Bagajı',
            description: 'Check-in bagajı dahil değil. Ekstra bagaj için ücret ödenecek.'
        });
    } else if (flight.baggageWeight && flight.baggageWeight < 23) {
        insights.fareRestrictions.push({
            type: 'limited_baggage',
            icon: '⚖️',
            label: `Sınırlı Bagaj (${flight.baggageWeight}kg)`,
            description: `Standart 23kg yerine ${flight.baggageWeight}kg bagaj hakkı.`
        });
    }

    const priceDiff = flight.price - smartMinPrice;
    const priceDiffPercent = (priceDiff / smartMinPrice) * 100;
    const durationDiff = flight.duration - fastestDuration;
    const durationDiffHours = durationDiff / 60;



    // ========================================
    // 1. BADGES
    // ========================================

    if (flight.score >= 8.5) {
        insights.badges.push({ label: '🏆 Best Deal', color: 'green' });
    } else if (flight.score >= 8.0) {
        insights.badges.push({ label: '⭐ Top Pick', color: 'green' });
    }

    if (flight.price === actualMinPrice) {
        insights.badges.push({ label: '💰 En Ucuz', color: 'blue' });
    }

    if (flight.duration === fastestDuration) {
        insights.badges.push({ label: '⚡ En Hızlı', color: 'yellow' });
    }

    if (flight.baggageIncluded) {
        insights.badges.push({ label: '🧳 Bagaj Dahil', color: 'gray' });
    }

    // ========================================
    // 2. PROS (Neden Seçmeliyim?)
    // ========================================

    // Fiyat Analizi
    if (priceDiffPercent <= 0) {
        insights.pros.push("Pazardaki en uygun fiyat.");
    } else if (priceDiffPercent <= 10) {
        insights.pros.push("Referans fiyata çok yakın.");
    } else if (priceDiffPercent <= 20) {
        insights.pros.push("Makul fiyat aralığında.");
    }

    // Süre Analizi
    if (durationDiff === 0) {
        insights.pros.push("🚀 Pazardaki en hızlı seçenek.");
    } else if (durationDiffHours <= 1) {
        insights.pros.push("🚀 En hızlıya çok yakın süre.");
    } else if (durationDiffHours <= 3) {
        insights.pros.push("⏱️ Kabul edilebilir toplam süre.");
    }

    // Konfor (Stop)
    if (flight.stops === 0) {
        insights.pros.push("✅ Direkt uçuş konforu.");
    } else if (flight.stops === 1) {
        const layoverHours = flight.layoverHoursTotal || 0;
        if (layoverHours >= 1.5 && layoverHours <= 4) {
            insights.pros.push("✅ Tek aktarma, ideal bekleme süresi.");
        } else {
            insights.pros.push("✅ Sadece tek aktarma.");
        }
    }

    // Bagaj
    if (flight.baggageIncluded && flight.baggageWeight) {
        insights.pros.push(`🧳 ${flight.baggageWeight}kg bagaj dahil.`);
    } else if (flight.baggageIncluded) {
        insights.pros.push("🧳 Bagaj hakkı dahil.");
    }

    // ========================================
    // 3. RISKS (Kırmızı Bayraklar)
    // ========================================

    if (flight.stops >= 2) {
        insights.risks.push("🛑 2+ aktarma (Yorucu yolculuk).");
    }

    if (durationDiffHours > 10) {
        insights.risks.push("🐢 En hızlıdan +10 saat uzun.");
    } else if (durationDiffHours > 6) {
        insights.risks.push("🐢 Toplam süre uzun.");
    }

    if (priceDiffPercent > 80) {
        insights.risks.push("💸 Referans fiyatın %80+ üstünde.");
    } else if (priceDiffPercent > 50) {
        insights.risks.push("💸 Pahalı seçenek.");
    }

    const layoverHours = flight.layoverHoursTotal || 0;
    if (layoverHours > 8) {
        insights.risks.push("⏳ Uzun aktarma süresi (+8 saat).");
    } else if (layoverHours > 0 && layoverHours < 1.25) {
        insights.risks.push("⚠️ Riskli kısa aktarma (<1s 15dk).");
    }

    if (flight.duration > 35 * 60) { // 35 saat+
        insights.risks.push("⏰ 35 saatten uzun yolculuk.");
    }

    // ========================================
    // 4. TRADE-OFF ANALYSIS
    // ========================================

    if (flight.id === cheapestFlight?.id) {
        // Bu uçuş en ucuz - en hızlıyla kıyasla
        if (fastestFlight && flight.id !== fastestFlight.id) {
            const timeLost = (flight.duration - fastestFlight.duration) / 60;
            const moneySaved = fastestFlight.price - flight.price;

            if (timeLost > 3 && moneySaved > 0) {
                insights.tradeOff = {
                    title: "Ucuz ama Yavaş",
                    titleEn: "Cheap but Slow",
                    description: `₺${moneySaved.toLocaleString('tr-TR')} tasarruf ediyorsun ama ${timeLost.toFixed(1)} saat daha uzun süre.`,
                    sentiment: 'neutral'
                };
            } else if (timeLost <= 3) {
                insights.tradeOff = {
                    title: "Tam İsabet",
                    titleEn: "Perfect Match",
                    description: "Hem en ucuz hem makul süreli. Düşünmeden al.",
                    sentiment: 'positive'
                };
            }
        }
    } else if (flight.id === fastestFlight?.id) {
        // Bu uçuş en hızlı - en ucuzla kıyasla
        if (cheapestFlight && flight.id !== cheapestFlight.id) {
            const extraCost = flight.price - cheapestFlight.price;
            const timeSaved = (cheapestFlight.duration - flight.duration) / 60;

            if (timeSaved > 0 && extraCost > 0) {
                insights.tradeOff = {
                    title: "Zamanı Satın Al",
                    titleEn: "Buy Time",
                    description: `₺${extraCost.toLocaleString('tr-TR')} fazla ödüyorsun ama ${timeSaved.toFixed(1)} saat kazanıyorsun.`,
                    sentiment: extraCost / timeSaved < 5000 ? 'positive' : 'neutral'
                };
            }
        }
    } else {
        // Ortadaki bir uçuş - en ucuzla kıyasla
        if (cheapestFlight) {
            const extraCost = flight.price - cheapestFlight.price;
            const timeSaved = (cheapestFlight.duration - flight.duration) / 60;

            if (timeSaved > 0 && extraCost > 0) {
                const costPerHour = extraCost / timeSaved;
                insights.tradeOff = {
                    title: "Parayla Zaman Satın Alıyorsun",
                    titleEn: "Trading Money for Time",
                    description: `En ucuza göre ₺${extraCost.toLocaleString('tr-TR')} fazla ödüyorsun ama ${timeSaved.toFixed(1)} saat kazanıyorsun.`,
                    sentiment: costPerHour < 3000 ? 'positive' : costPerHour < 8000 ? 'neutral' : 'warning'
                };
            } else if (timeSaved <= 0 && extraCost > 0) {
                insights.tradeOff = {
                    title: "Dikkat",
                    titleEn: "Warning",
                    description: `Bu uçuş en ucuzdan ₺${extraCost.toLocaleString('tr-TR')} daha pahalı ve zaman kazancı yok.`,
                    sentiment: 'warning'
                };
            }
        }
    }

    // ========================================
    // 5. CONSULTANT RECOMMENDATION
    // ========================================

    const isReasonablyPriced = priceDiffPercent <= 15;
    const isReasonablyFast = durationDiffHours <= 3;
    const hasFewStops = flight.stops <= 1;
    const isFastestOrClose = durationDiffHours <= 1;
    const isCheapestOrClose = priceDiffPercent <= 5;

    if (flight.score >= 8.5 && isReasonablyPriced && isReasonablyFast && hasFewStops) {
        insights.consultant = {
            level: 'strong_yes',
            message: "Bu uçuşu öneriyorum: hem hızlı hem uygun fiyatlı hem de konforlu.",
            emoji: '👍'
        };
    } else if (isFastestOrClose && isReasonablyPriced && hasFewStops) {
        insights.consultant = {
            level: 'strong_yes',
            message: "Bu uçuşu öneriyorum: en hızlı seçeneklerden biri ve fiyatı makul.",
            emoji: '👍'
        };
    } else if (isCheapestOrClose && hasFewStops && durationDiffHours <= 6) {
        insights.consultant = {
            level: 'strong_yes',
            message: "Bu uçuşu öneriyorum: en uygun fiyat ve kabul edilebilir süre.",
            emoji: '👍'
        };
    } else if (isCheapestOrClose && (durationDiffHours > 6 || flight.stops >= 2)) {
        insights.consultant = {
            level: 'conditional',
            message: "Fiyat iyi ama süre uzun veya çok aktarma var. Bütçe kısıtlıysa değerlendir.",
            emoji: '⚖️'
        };
    } else if (priceDiffPercent > 50 && !isFastestOrClose) {
        insights.consultant = {
            level: 'avoid',
            message: "Bu uçuşu önermiyorum: hem pahalı hem de hız avantajı yok.",
            emoji: '🚫'
        };
    } else if (flight.stops >= 2 && durationDiffHours > 10) {
        insights.consultant = {
            level: 'avoid',
            message: "Bu uçuşu önermiyorum: çok uzun ve yorucu olacak.",
            emoji: '🚫'
        };
    } else if (priceDiffPercent > 30) {
        insights.consultant = {
            level: 'conditional',
            message: "Pahalı bir seçenek. Sadece zaman veya konfor kritikse düşün.",
            emoji: '⚖️'
        };
    } else if (durationDiffHours > 5) {
        insights.consultant = {
            level: 'conditional',
            message: "Makul fiyat ama uzun süre. Bütçe önemliyse değerlendir.",
            emoji: '⚖️'
        };
    } else {
        insights.consultant = {
            level: 'conditional',
            message: "Ortalama bir seçenek. Diğer alternatiflere de göz at.",
            emoji: '⚖️'
        };
    }

    return insights;
}

// ----------------------------
// HELPER: Batch Process All Flights
// ----------------------------

export function generateAllFlightInsights(
    flights: FlightForInsights[],
    smartMinPrice: number,
    fastestDuration: number
): Map<string, FlightInsights> {
    const insightsMap = new Map<string, FlightInsights>();

    for (const flight of flights) {
        const insights = generateFlightInsights(flight, flights, smartMinPrice, fastestDuration);
        insightsMap.set(flight.id, insights);
    }

    return insightsMap;
}
// ----------------------------
// 6. SCENARIO STORYTELLING (AI Simulation)
// ----------------------------

export interface FlightChapter {
    timeOfDay: string;
    title: string;
    description: string;
    emoji: string;
    tip?: string;
}

export interface FlightStory {
    summary: string;
    chapters: FlightChapter[];
}

export function getScenarioStory(flight: any): FlightStory {
    const chapters: FlightChapter[] = [];
    const depTime = new Date(flight.departureDate);
    const arrTime = new Date(flight.arrivalDate);
    const durationHours = flight.duration / 60;

    // CHAPTER 1: DEPARTURE
    chapters.push({
        timeOfDay: depTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        title: `Kalkış: ${flight.origin}`,
        description: `Yolculuk ${flight.origin} havalimanında başlıyor. ${depTime.getHours() < 8 ? 'Erken saat, kahve şart.' : 'Rahat bir saatte havaalanına geçiş.'}`,
        emoji: '🛫',
        tip: 'Online check-in yaparak 45dk kazanabilirsin.'
    });

    // CHAPTER 2: IN-FLIGHT / LAYOVER
    if (flight.stops > 0 && flight.segments && flight.segments[0]) {
        const firstSegment = flight.segments[0];
        const layoverCity = firstSegment.destination;
        chapters.push({
            timeOfDay: 'Yolculuk Sırası',
            title: `Aktarma: ${layoverCity}`,
            description: `${layoverCity} şehrinde bir mola. Bacaklarını esnetmek için fırsat.`,
            emoji: '🛑',
            tip: 'Bu havalimanında ücretsiz Wi-Fi genellikle mevcuttur.'
        });
    } else {
        chapters.push({
            timeOfDay: 'Uçuşta',
            title: 'Bulutların Üzerinde',
            description: `${durationHours.toFixed(1)} saatlik kesintisiz bir uçuş.`,
            emoji: '☁️',
            tip: 'Gürültü önleyici kulaklığını tak ve filmin tadını çıkar.'
        });
    }

    // CHAPTER 3: ARRIVAL
    chapters.push({
        timeOfDay: arrTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        title: `Varış: ${flight.destination}`,
        description: `${flight.destination} şehrine hoş geldin. Yolculuk tamamlandı.`,
        emoji: '🛬',
        tip: 'Şehir merkezine UBER veya metro ile geçiş yapabilirsin.'
    });

    let summary = "Standart bir yolculuk.";
    if (flight.score > 8) summary = "Bu uçuş seni yormayacak, harika bir seçim.";
    else if (flight.score < 5) summary = "Biraz yorucu olabilir ama hedefe varacaksın.";

    return { chapters, summary };
}
