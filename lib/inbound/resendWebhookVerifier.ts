/**
 * Resend Inbound Webhook - Imza Dogrulama Yardimcisi
 *
 * Resend, her inbound webhook isteğine Svix tabanli bir imza gönderir.
 * Basliklar:
 *   svix-id        -> Benzersiz mesaj ID'si (idempotency icin)
 *   svix-timestamp -> Unix timestamp (replay attack korumasi)
 *   svix-signature -> HMAC-SHA256 imzasi (virgulle ayrilmis, v1 prefix'li)
 *
 * Dogrulama algoritmasi (Svix standart):
 *   msg      = `${svix-id}.${svix-timestamp}.${raw_body}`
 *   expected = Base64( HMAC-SHA256( Base64Decode(secret), msg ) )
 *   imzalar icinde "v1,{expected}" varsa -> gecerli
 *
 * Referans: https://docs.resend.com/changelog/inbound-emails
 */

import { createHmac } from 'crypto';

/** Svix basliklarindan parse edilen dogrulama verisi */
export interface SvixHeaders {
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
}

/** Maksimum kabul edilen zaman farki: 5 dakika */
const MAX_TIMESTAMP_DIFF_MS = 5 * 60 * 1000;

/**
 * Istekten Svix basliklarini cikarir.
 * Eksik baslik varsa null döner.
 */
export function extractSvixHeaders(headers: Headers): SvixHeaders | null {
  const svixId = headers.get('svix-id');
  const svixTimestamp = headers.get('svix-timestamp');
  const svixSignature = headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return null;
  }

  return { svixId, svixTimestamp, svixSignature };
}

/**
 * Svix timestamp'inin cok eski veya cok yeni olup olmadigini kontrol eder.
 * Replay saldirilarina karsi koruma saglar.
 */
function isTimestampFresh(svixTimestamp: string): boolean {
  const tsMs = parseInt(svixTimestamp, 10) * 1000;
  if (isNaN(tsMs)) return false;
  const diff = Math.abs(Date.now() - tsMs);
  return diff <= MAX_TIMESTAMP_DIFF_MS;
}

/**
 * Resend/Svix webhook imzasini dogrular.
 *
 * @param rawBody   - Ham request body string'i (duz metin)
 * @param svixHdrs  - extractSvixHeaders() ile alinan basliklar
 * @param secret    - Resend Dashboard'dan alinan webhook signing secret
 *                    (whsec_ prefix'i ile ya da Base64 encoded olabilir)
 * @returns true -> imza gecerli; false -> gecersiz veya suresi dolmus
 */
export function verifyResendSignature(
  rawBody: string,
  svixHdrs: SvixHeaders,
  secret: string,
): boolean {
  if (!isTimestampFresh(svixHdrs.svixTimestamp)) {
    return false;
  }

  // Svix secret'i Base64 decode et
  // Resend bazi ortamlarda "whsec_<base64>" formatinda verir
  const cleanSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(cleanSecret, 'base64');
  } catch {
    return false;
  }

  // Imzalanacak mesaji olustur
  const signedContent = `${svixHdrs.svixId}.${svixHdrs.svixTimestamp}.${rawBody}`;

  // HMAC-SHA256 hesapla ve Base64'e cevir
  const computedSignature = createHmac('sha256', keyBuffer)
    .update(signedContent)
    .digest('base64');

  // Resend birden fazla imza gonderebilir (key rotation icin), boslukla ayrilir
  const receivedSignatures = svixHdrs.svixSignature
    .split(' ')
    .map((sig) => sig.replace(/^v1,/, '').trim());

  return receivedSignatures.some((sig) => sig === computedSignature);
}
