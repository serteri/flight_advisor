/**
 * Resend Inbound Email Parser
 *
 * Gelen e-postadan uçuş bilgilerini ayıklar:
 *  - PNR kodu: 6 haneli alfanümerik (ornek: ABC123, XY1234)
 *  - Ucus numarasi: IATA hava yolu kodu (2-3 harf) + rakamlar (1-4) (ornek: TK1979, JQ810)
 *
 * Onemli tasarim kararlari:
 *  - Regex'ler false-positive'leri azaltmak icin word boundary kullanir
 *  - PNR için büyük harf + rakam kombinasyonu zorunludur (saf rakam veya kelime engellenir)
 *  - Sonuclar tekil tutulmak icin Set kullanilir
 */

/** Resend Inbound payload'unun e-posta bolumu */
export interface ParsedEmailFields {
  from: string;
  subject: string;
  text: string;
  /** Resend, ekleri base64 encoded içerik olarak gönderir */
  attachments?: ResendAttachment[];
}

export interface ResendAttachment {
  filename?: string;
  content?: string;       // Base64
  contentType?: string;
  size?: number;
}

/** Ayiklama sonucu */
export interface FlightExtractionResult {
  pnrCodes: string[];
  flightNumbers: string[];
  hasFlightInfo: boolean;
}

// ─── Regex Tanımları ─────────────────────────────────────────────────────────

/**
 * PNR kodu: 6 haneli alfanumerik, en az bir harf ve en az bir rakam icermeli.
 * Ornek gecerli: ABC123, XY1234, A1B2C3
 * Ornek gecersiz: 123456 (saf rakam), ABCDEF (saf harf)
 */
const PNR_REGEX = /\b([A-Z]{1,3}[0-9]{1,5}|[0-9]{1,5}[A-Z]{1,3}|[A-Z][0-9][A-Z0-9]{4}|[A-Z0-9]{6})\b/g;

/**
 * Ucus numarasi: 2-3 buyuk harf (IATA/ICAO kodu) + 1-4 rakam
 * Ornek gecerli: TK1979, JQ810, QF1, AA100, EZY8833
 * Ornek gecersiz: ABC1234 (5 rakam = cok uzun)
 */
const FLIGHT_NUMBER_REGEX = /\b([A-Z]{2,3})(\d{1,4})\b/g;

/** PNR olarak yorumlanmamasi gereken bilinen yalanci pozitifler */
const PNR_BLACKLIST = new Set([
  'ECONOMY', 'BUSINESS', 'PREMIUM', 'FLIGHT', 'TICKET',
  'DEPART', 'ARRIVE', 'RETURN', 'DIRECT', 'NONSTOP',
]);

/** Ucus numarasi olarak yorumlanmamasi gereken IATA disi 2-3 harfli kisaltmalar */
const AIRLINE_CODE_BLACKLIST = new Set([
  'AM', 'PM', 'UTC', 'GMT', 'EST', 'PST', 'PDF', 'URL',
  'OK', 'NO', 'RE', 'TO', 'IN', 'AT', 'BY', 'DO',
  'HTTP', 'HTTPS', 'FWD', 'FW', 'CC', 'BCC',
]);

// ─── Yardimci Fonksiyonlar ────────────────────────────────────────────────────

/** Metin üzerinde PNR regex calistirir ve benzersiz sonuclari dondurur */
function extractPnrCodes(text: string): string[] {
  const uppercased = text.toUpperCase();
  const results = new Set<string>();

  let match: RegExpExecArray | null;
  // Regex global oldugu icin lastIndex sifirlanmali (reset)
  PNR_REGEX.lastIndex = 0;

  while ((match = PNR_REGEX.exec(uppercased)) !== null) {
    const candidate = match[1];
    // Tam alfanumerik mi kontrol et (6 karakter, en az 1 harf + 1 rakam)
    if (candidate.length === 6 && /[A-Z]/.test(candidate) && /[0-9]/.test(candidate)) {
      if (!PNR_BLACKLIST.has(candidate)) {
        results.add(candidate);
      }
    }
  }

  return Array.from(results);
}

/** Metin üzerinde ucus numarasi regex calistirir ve benzersiz sonuclari dondurur */
function extractFlightNumbers(text: string): string[] {
  const uppercased = text.toUpperCase();
  const results = new Set<string>();

  let match: RegExpExecArray | null;
  FLIGHT_NUMBER_REGEX.lastIndex = 0;

  while ((match = FLIGHT_NUMBER_REGEX.exec(uppercased)) !== null) {
    const airlineCode = match[1];
    const flightNum = match[2];

    if (AIRLINE_CODE_BLACKLIST.has(airlineCode)) continue;
    // Cok kisa veya cok uzun rakam dizilerini eleme
    if (flightNum.length < 1 || flightNum.length > 4) continue;

    results.add(`${airlineCode}${flightNum}`);
  }

  return Array.from(results);
}

// ─── Ana Fonksiyon ─────────────────────────────────────────────────────────

/**
 * Gelen e-postanin subject, text ve (varsa) attachment iceriklerinden
 * PNR kodlarini ve ucus numaralarini ayiklar.
 *
 * PDF eklerin icerigini parse etmiyoruz (sunucu tarafinda PDF decode
 * icin ek kutuphaneler gerekir); bunun yerine attachment'in filename'ini
 * de tarariz, cunku ozellikle bazi havayolu biletleri dosya adinda
 * PNR/ucus bilgisi icerir (ornek: "TK1979_ABC123_itinerary.pdf").
 */
export function extractFlightInfoFromEmail(
  fields: ParsedEmailFields,
): FlightExtractionResult {
  // Tum metin kaynaklarini birlestir
  const combined = [
    fields.subject,
    fields.text,
    ...(fields.attachments?.map((a) => a.filename ?? '') ?? []),
  ]
    .filter(Boolean)
    .join('\n');

  const pnrCodes = extractPnrCodes(combined);
  const flightNumbers = extractFlightNumbers(combined);

  return {
    pnrCodes,
    flightNumbers,
    hasFlightInfo: pnrCodes.length > 0 || flightNumbers.length > 0,
  };
}
