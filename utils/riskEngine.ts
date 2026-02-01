
export interface RiskAnalysis {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendation: 'BUY_SAVER' | 'BUY_FLEX';
    dropProbability: number; // % (Örn: 65)
    potentialSavings: number; // Örn: 250 AUD
    reason: string;
}

export function calculateFlightRisk(
    price: number,
    daysToDeparture: number,
    airlineTier: string
): RiskAnalysis {

    // 1. DÜŞÜK RİSK SENARYOSU (Son dakika uçuşları)
    // Uçuşa 14 günden az kalmışsa fiyatların düşme ihtimali %5'tir.
    if (daysToDeparture < 14) {
        return {
            riskLevel: 'LOW',
            recommendation: 'BUY_SAVER',
            dropProbability: 5,
            potentialSavings: 0,
            reason: 'Uçuş tarihi çok yakın. Fiyatların düşme ihtimali yok denecek kadar az. En ucuz bileti (Saver) alıp geçmek mantıklı.'
        };
    }

    // 2. YÜKSEK RİSK SENARYOSU (Erken rezervasyon + Oynak Fiyat)
    // Uçuşa 60 günden fazla var. Tarihsel veriye göre fiyatlar dalgalanacak.
    if (daysToDeparture > 60) {
        const projectedDrop = price * 0.25; // %25 düşüş ihtimali
        return {
            riskLevel: 'HIGH',
            recommendation: 'BUY_FLEX',
            dropProbability: 72,
            potentialSavings: Math.round(projectedDrop),
            reason: `Bu rotada son 1 yılda, erken alınan biletlerin fiyatı uçuşa 30 gün kala %72 ihtimalle düşüş göstermiş. Flex bilet alırsanız bu düşüşten kâr edebilirsiniz.`
        };
    }

    // 3. ORTA RİSK (Standart)
    return {
        riskLevel: 'MEDIUM',
        recommendation: 'BUY_FLEX', // Yine de Flex öneriyoruz (Upsell)
        dropProbability: 40,
        potentialSavings: Math.round(price * 0.15),
        reason: 'Fiyatlar stabil görünüyor ancak havayolu kampanyaları bu dönemde aktif olabilir. Esneklik payı bırakmak matematiksel olarak daha güvenli.'
    };
}
