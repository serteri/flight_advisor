// lib/jetLagPredictor.ts

export interface JetLagAnalysis {
    impactScore: number;
    advice: string;
}

export function calculateJetLagImpact(departureTime: string, arrivalTime: string, originTZ: number, destTZ: number): JetLagAnalysis {
    const tzDiff = Math.abs(destTZ - originTZ);
    const direction = destTZ > originTZ ? 1.5 : 1.0; // Doğuya uçuş (örn: IST -> TYO) daha zordur

    // Basit formül: Saat farkı / 3 * Yön Faktörü
    // Maksimum 10 puan
    const rawScore = (tzDiff / 3) * direction;
    const impactScore = Math.min(10, parseFloat(rawScore.toFixed(1)));

    let advice = "";
    if (impactScore > 6) {
        advice = "⚠️ Aşırı Jet-Lag riski. Varışta hemen uyuma, güneş ışığı al. İlk 24 saat önemli toplantı planlama.";
    } else if (impactScore > 3) {
        advice = "⚖️ Orta seviye yorgunluk. Uçakta uyumaya çalış ve varış saatine göre hareket et.";
    } else {
        advice = "✅ Hafif etki. Hızlı toparlanacaksın, endişelenme.";
    }

    return { impactScore, advice };
}
