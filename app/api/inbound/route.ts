/**
 * POST /api/inbound
 *
 * Resend Inbound Webhook endpoint'i.
 *
 * Müsteriler biletlerini (e-posta veya PDF eki) sistemimize forward ettiginde
 * Resend bu endpoint'i tetikler. Is akisi:
 *
 *  1. Svix imzasini dogrula (yetkisiz spam'leri engelle)
 *  2. Payload'dan e-posta alanlarini (from, subject, text, attachments) al
 *  3. Regex ile PNR + ucus numarasini ayikla
 *  4. Gönderici e-postasina gore User bul
 *  5. MonitoredTrip.upsert ile takip kaydini ac
 *
 * Gerekli ortam degiskeni:
 *   RESEND_WEBHOOK_SECRET  - Resend Dashboard > Webhooks > Signing Secret
 *                            (whsec_... formatinda)
 *
 * Eger RESEND_WEBHOOK_SECRET tanimli degilse, endpoint imza dogrulamasi
 * olmadan kabul eder; FAKAT bu durum sadece gelistirme amaclidir ve
 * uretim ortaminda KESINLIKLE ayarlanmalidir.
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  extractSvixHeaders,
  verifyResendSignature,
} from '@/lib/inbound/resendWebhookVerifier';
import {
  extractFlightInfoFromEmail,
  type ParsedEmailFields,
  type ResendAttachment,
} from '@/lib/inbound/emailParser';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/**
 * Resend Inbound Webhook payload'u.
 * Referans: https://resend.com/docs/api-reference/webhooks/introduction
 */
interface ResendInboundPayload {
  type: string;           // ornegin "email.received"
  data: ResendEmailData;
}

interface ResendEmailData {
  from: string;           // "John Doe <john@example.com>"
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: RawAttachment[];
}

interface RawAttachment {
  filename?: string;
  content?: string;       // Base64 encoded
  contentType?: string;
  size?: number;
}

// ─── Yardimci Fonksiyonlar ────────────────────────────────────────────────────

/** "John Doe <john@example.com>" formatindan e-posta adresini cikarir */
function extractEmailAddress(from: string): string | null {
  if (!from || typeof from !== 'string') return null;
  const angleMatch = from.match(/<([^>]+)>/);
  const candidate = (angleMatch?.[1] ?? from).trim().toLowerCase();
  return candidate.includes('@') ? candidate : null;
}

/**
 * Gönderici e-postasina gore veritabaninda User arar.
 * Kullanici bulunamazsa null doner (kayit olusmaz).
 */
async function findUserByEmail(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Ayiklanan ucus bilgilerinden MonitoredTrip upsert eder.
 *
 * Upsert mantigi:
 *   - PNR varsa: (userId + pnr) benzersiz anahtari kullan
 *   - PNR yoksa: (userId + routeLabel) ile eslestir
 *
 * MonitoredTrip olusturmak icin zorunlu alanlar:
 *   - userId, routeLabel, originalPrice (0 baslangic deger), currency, ticketClass
 *   - nextCheckAt (ilk kontrole zamanlama)
 */
async function upsertMonitoredTrip({
  userId,
  pnr,
  flightNumber,
  fromAddress,
}: {
  userId: string;
  pnr: string | null;
  flightNumber: string | null;
  fromAddress: string;
}): Promise<{ created: boolean; tripId: string }> {
  const routeLabel = flightNumber
    ? `Inbound: ${flightNumber}`
    : `Inbound from ${fromAddress}`;

  const now = new Date();
  const nextCheck = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 saat sonra

  // Upsert: pnr + userId kombinasyonu varsa var olani guncelle, yoksa yeni olustur
  const uniqueWhere = pnr
    ? { userId_pnr: { userId, pnr } as never }   // Composite unique index yok; fallback
    : undefined;

  // Prisma'da MonitoredTrip'te (userId, pnr) composite unique yok;
  // Bu nedenle once findFirst ile ara, yoksa create et.
  const existing = await prisma.monitoredTrip.findFirst({
    where: {
      userId,
      ...(pnr ? { pnr } : { routeLabel }),
    },
    select: { id: true },
  });

  // Bilinmeyen unique where'den kacin
  void uniqueWhere;

  if (existing) {
    // Mevcut kaydi guncelle - ucus numarasi degismis olabilir
    await prisma.monitoredTrip.update({
      where: { id: existing.id },
      data: {
        routeLabel,
        updatedAt: now,
      },
    });
    return { created: false, tripId: existing.id };
  }

  const trip = await prisma.monitoredTrip.create({
    data: {
      userId,
      pnr: pnr ?? undefined,
      routeLabel,
      subscriberEmail: fromAddress,
      consentGiven: true,      // Forward eden kullanici onay vermis sayilir
      originalPrice: 0,        // Bilet fiyati e-postadan alinamiyor; sonra guncellenebilir
      currency: 'AUD',
      ticketClass: 'ECONOMY',  // Varsayilan; sonra parse edilirse guncellenir
      watchPrice: false,       // Inbound ticket icin fiyat takibi baslangicta kapali
      watchDelay: true,
      watchSchedule: true,
      status: 'ACTIVE',
      nextCheckAt: nextCheck,
      checkFrequency: 360,     // 6 saat (dakika cinsinden)
    },
    select: { id: true },
  });

  return { created: true, tripId: trip.id };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Could not read request body' }, { status: 400 });
  }

  // ── 1. Imza Dogrulamasi ─────────────────────────────────────────────────────
  const signingSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (signingSecret) {
    const svixHdrs = extractSvixHeaders(request.headers);

    if (!svixHdrs) {
      console.warn('[INBOUND] Missing Svix signature headers');
      return NextResponse.json(
        { error: 'Missing webhook signature headers' },
        { status: 401 },
      );
    }

    const isValid = verifyResendSignature(rawBody, svixHdrs, signingSecret);
    if (!isValid) {
      console.warn('[INBOUND] Invalid or expired webhook signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 },
      );
    }
  } else {
    // Gelistirme modunda uyar ama devam et
    if (process.env.NODE_ENV === 'production') {
      console.error('[INBOUND] RESEND_WEBHOOK_SECRET not set in production!');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 },
      );
    }
    console.warn('[INBOUND] RESEND_WEBHOOK_SECRET not set — skipping signature verification (dev mode)');
  }

  // ── 2. Payload Parse ──────────────────────────────────────────────────────
  let payload: ResendInboundPayload;
  try {
    payload = JSON.parse(rawBody) as ResendInboundPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // Sadece e-posta olaylarini isle
  if (!payload.type?.startsWith('email.')) {
    return NextResponse.json({
      success: true,
      outcome: 'ignored',
      reason: `Unhandled event type: ${payload.type}`,
    });
  }

  const emailData: ResendEmailData = payload.data;
  const fromAddress = extractEmailAddress(emailData.from);

  if (!fromAddress) {
    return NextResponse.json({
      success: false,
      outcome: 'invalid',
      reason: 'Could not parse sender email address',
    });
  }

  // ── 3. Ucus Bilgisi Ayikla ──────────────────────────────────────────────────
  const emailFields: ParsedEmailFields = {
    from: fromAddress,
    subject: emailData.subject ?? '',
    text: emailData.text ?? '',
    attachments: (emailData.attachments ?? []).map((a: RawAttachment): ResendAttachment => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
      size: a.size,
    })),
  };

  const extracted = extractFlightInfoFromEmail(emailFields);

  console.info('[INBOUND] Parsed email from:', fromAddress, {
    subject: emailData.subject,
    pnrCodes: extracted.pnrCodes,
    flightNumbers: extracted.flightNumbers,
    hasFlightInfo: extracted.hasFlightInfo,
  });

  if (!extracted.hasFlightInfo) {
    return NextResponse.json({
      success: true,
      outcome: 'no_flight_info',
      from: fromAddress,
      subject: emailData.subject,
      message: 'No PNR or flight number found in email',
    });
  }

  // ── 4. Kullanici Bul ────────────────────────────────────────────────────────
  const userId = await findUserByEmail(fromAddress);

  if (!userId) {
    console.info('[INBOUND] No user found for email:', fromAddress);
    return NextResponse.json({
      success: true,
      outcome: 'user_not_found',
      from: fromAddress,
      extracted,
      message: 'No registered user found for this email address',
    });
  }

  // ── 5. MonitoredTrip Upsert ─────────────────────────────────────────────────
  // Birden fazla PNR/ucus numarasi bulunabilir; her biri icin ayri kayit acilir.
  // Pratikte genellikle 1 PNR + 1-2 ucus numarasi gelir.
  const primaryPnr = extracted.pnrCodes[0] ?? null;
  const primaryFlight = extracted.flightNumbers[0] ?? null;

  const upsertResult = await upsertMonitoredTrip({
    userId,
    pnr: primaryPnr,
    flightNumber: primaryFlight,
    fromAddress,
  });

  console.info(
    `[INBOUND] MonitoredTrip ${upsertResult.created ? 'created' : 'updated'}:`,
    upsertResult.tripId,
  );

  return NextResponse.json({
    success: true,
    outcome: upsertResult.created ? 'trip_created' : 'trip_updated',
    tripId: upsertResult.tripId,
    userId,
    from: fromAddress,
    extracted: {
      pnrCodes: extracted.pnrCodes,
      flightNumbers: extracted.flightNumbers,
    },
  });
}
