// lib/parser/aiParser.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ParsedFlightEmail {
    pnr: string | null;
    airlineCode: string | null;
    flightNumber: string | null;
    origin: string | null;
    destination: string | null;
    departureTime: string | null;
    arrivalTime: string | null;
    passengers: Array<{
        name: string;
        type: 'ADULT' | 'CHILD' | 'INFANT';
        age?: number;
    }>;
    bookingReference?: string;
    price?: number;
    currency?: string;
    confidence?: number;
}

/**
 * AI-Powered Flight Email Parser using Gemini 1.5 Flash
 * Supports multi-language emails and complex HTML templates
 */
export async function parseFlightEmail(
    emailContent: string,
    userLanguage: string = 'en'
): Promise<ParsedFlightEmail | null> {
    try {
        // 1. Gemini Flash-1.5 Modeli (Hızlı & Ucuz)
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1 // Düşük temperature = daha tutarlı sonuçlar
            }
        });

        // 2. Multi-Language Master Prompt
        const systemPrompts = {
            tr: "Aşağıdaki uçuş onay e-postasından bilgileri ayıkla ve SADECE saf JSON formatında dön.",
            en: "Extract flight information from the confirmation email below and return ONLY pure JSON.",
            de: "Extrahiere Fluginformationen aus der Bestätigungs-E-Mail und gib NUR reines JSON zurück."
        };

        const prompt = `
${systemPrompts[userLanguage as keyof typeof systemPrompts] || systemPrompts.en}

${userLanguage === 'tr' ? 'Eğer bir bilgi yoksa "null" bırak. Tarihleri ISO 8601 formatında ver.' :
                userLanguage === 'de' ? 'Wenn eine Information fehlt, lasse "null". Gib Daten im ISO 8601 Format an.' :
                    'If information is missing, leave as "null". Provide dates in ISO 8601 format.'}

Required JSON Schema:
{
  "pnr": "6-character booking code (e.g., ABC123)",
  "airlineCode": "IATA airline code (e.g., QF, TK, LH)",
  "flightNumber": "Flight number with airline code (e.g., QF52)",
  "origin": "Departure airport IATA code (e.g., BNE)",
  "destination": "Arrival airport IATA code (e.g., SIN)",
  "departureTime": "ISO 8601 datetime (e.g., 2026-06-15T14:30:00Z)",
  "arrivalTime": "ISO 8601 datetime",
  "passengers": [
    {
      "name": "Full name",
      "type": "ADULT | CHILD | INFANT",
      "age": "Only if mentioned (number)"
    }
  ],
  "price": "Total price (number only)",
  "currency": "Currency code (e.g., AUD, EUR, USD)",
  "confidence": "Your confidence in extraction accuracy (0-100)"
}

CRITICAL RULES:
- Extract passenger ages if mentioned (for Junior Guardian detection)
- Identify children by keywords: "child", "infant", "çocuk", "bebek", "kind", "säugling"
- If multiple flight segments exist, extract the FIRST departure flight
- Convert all dates to ISO 8601 format with timezone
- Return confidence score based on data completeness

Email Content:
${emailContent}
`;

        // 3. AI Analizi
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // 4. JSON Parse (Clean any markdown artifacts)
        const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsedData: ParsedFlightEmail = JSON.parse(cleanedResponse);

        // 5. Validation
        if (!parsedData.pnr || !parsedData.origin || !parsedData.destination) {
            console.warn('AI Parser: Missing critical fields', parsedData);
            return null;
        }

        // 6. Auto-detect Junior passengers (age < 12)
        parsedData.passengers = parsedData.passengers.map(p => {
            if (p.age && p.age < 12 && p.type === 'ADULT') {
                p.type = 'CHILD';
            }
            return p;
        });

        console.log('✅ AI Parser Success:', {
            pnr: parsedData.pnr,
            route: `${parsedData.origin} → ${parsedData.destination}`,
            passengers: parsedData.passengers.length,
            confidence: parsedData.confidence
        });

        return parsedData;

    } catch (error) {
        console.error("🚨 AI Parsing Error:", error);
        return null;
    }
}

/**
 * Batch parsing for multiple emails
 */
export async function parseBatchEmails(
    emails: Array<{ id: string; content: string }>,
    userLanguage: string = 'en'
): Promise<Array<{ id: string; data: ParsedFlightEmail | null }>> {
    const results = await Promise.allSettled(
        emails.map(async (email) => ({
            id: email.id,
            data: await parseFlightEmail(email.content, userLanguage)
        }))
    );

    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);
}
