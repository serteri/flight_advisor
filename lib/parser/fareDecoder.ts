// lib/parser/fareDecoder.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface FareRulesAnalysis {
    isRefundable: boolean;
    refundPenalty: string;
    isChangeable: boolean;
    changePenalty: string;
    summary: string;
}

export async function decodeFareRules(rawRules: string): Promise<FareRulesAnalysis | null> {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    Aşağıdaki karmaşık havayolu bilet kurallarını analiz et. 
    Yolcu için en önemli 3 soruyu cevapla: İade, Değişim ve Bagaj.
    Yanıtı SADECE şu JSON formatında ver:
    {
      "isRefundable": boolean,
      "refundPenalty": "Ücret veya 'Yasak'",
      "isChangeable": boolean,
      "changePenalty": "Ücret veya 'Yasak'",
      "summary": "Tek cümlelik insan dili özeti (örn: Bu bilet yanar, değişim yapma.)"
    }

    Kurallar Metni:
    ${rawRules.substring(0, 4000)}
  `;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return JSON.parse(responseText) as FareRulesAnalysis;
    } catch (error) {
        console.error("Fare Decoder Hatası:", error);
        // Return a safe fallback instead of null to prevent UI crashes, 
        // or return null and handle it in UI. Returning null as per plan.
        return null;
    }
}
