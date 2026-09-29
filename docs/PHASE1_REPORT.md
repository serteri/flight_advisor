# FlightAgent.io — Faz 1 Bitiş Raporu

**Tarih:** 2026-09-30
**Referans:** `docs/STATUS_REPORT.md`
**Durum:** 1.1–1.6 tamamlandı ve commit'lendi (push yok). Şema **hiçbir veritabanına uygulanmadı** (bkz. §4).

---

## 0. Özet

| Commit | Alt görev | tsc | Test |
|---|---|---|---|
| `ce03264` | 1.1 Güvenlik | 0 hata | (test altyapısı yoktu) |
| `8f95505` | 1.2 E-posta teslimatı | 0 hata | — |
| `3d3e7cd` | 1.3 İzleme motoru (QStash, AeroDataBox, kota) | 0 hata | 32/32 |
| `d862f95` | 1.4 Tek EU261/UK261 motoru | 0 hata | 70/70 |
| `cf71c12` | **security:** sahiplik kontrolleri, ADMIN_EMAILS bypass | 0 hata | 77/77 |
| `9087e9a` | 1.5 Hukuki metin temizliği | 0 hata | 83/83 |
| `c24d2fe` | 1.6 Site metni, fiyatlandırma, rate limit, double opt-in | 0 hata | 89/89 |

Son durum: `npx tsc --noEmit` → 0 hata. `npm test` → **89 test, 89 geçti, 0 kaldı** (11 dosya: compensationEngine 34, aerodatabox 11, checkpoints 8, flightNumber 7, ownership 6, quotaPolicy 6, legalText 6, trackRateLimit 5, workerRules 4, featureFlags 1, freemium 1).

Kod çalıştırılmadı. `next build` ve tarayıcı testi yapılmadı. Doğrulama tsc ve birim testleriyle sınırlı.

---

## 1. Yapılan işler

### 1.1 Güvenlik — `ce03264`
- `app/api/guardian/monitor/route.ts` silindi (auth'suz demo trip oluşturma).
- `app/api/notify-visit/route.ts` ve `proxy.ts` içindeki tetikleyicisi silindi.
- `scripts/test_tp.js` ve `scripts/test_tp_live.js` silindi (hardcoded Travelpayouts token). Git geçmişi temizliği için §5'e bakın.
- `app/api/compensation/generate-letter/route.ts`: claim sahibi değilse 404 (IDOR).
- Stripe secret key ve webhook secret prefix logları kaldırıldı. `/api/health` artık maskelenmiş token parçası döndürmüyor.

### 1.2 E-posta — `8f95505`
- `lib/config/runtimeEnv.ts`: `getNotificationFromEmail`, `getAppBaseUrl`, `appUrl` fallback'siz. Fail-fast kontrolü `app/[locale]/layout.tsx:15` ve `app/api/guardian/check/route.ts:72` içinde.
- `onboarding@resend.dev` fallback'i üç göndericiden kaldırıldı.
- Eski domain'ler `APP_BASE_URL`'e bağlandı:
  - `flight-guardian.com`: `services/notifications/channels/email.ts:44-45` ve `app/api/cron/trial-reminder/route.ts:29`
  - `www.flightagent.io`: `components/compensation/CompensationDetailModal.tsx:53`
  - `localhost:3000`: `lib/email/sender.ts`, iki checkout route'u, `billing-portal`
- Resend hataları loglanıyor ve kayda işleniyor (`MonitoredTrip.lastEmailError/lastEmailErrorAt`, `LoginToken.emailError`). `/api/trips/track` onay e-postası gitmezse 502 dönüyor.
- `scripts/send-test-alert.ts`: gerçek `DisruptionAlertEmail` şablonuyla tek bir test maili gönderir, Resend id'sini veya hatasını yazdırır.

### 1.3 İzleme motoru — `3d3e7cd`
- Tek uçuş numarası kuralı `^[A-Z0-9]{2}\d{1,4}[A-Z]?$` (`lib/flights/flightNumber.ts`). U2/W6/3K kabul ediliyor, tamamen rakamdan oluşan kodlar reddediliyor. Form, `/api/trips/track` ve veri istemcisi aynı kuralı kullanıyor.
- Vercel cron'u (`vercel.json`, `/api/cron/guardian`) kaldırıldı. Yerine QStash checkpoint'leri geldi: dep-24h, dep-3h, dep, arr+1h, arr+4h ve tahmini gecikme ≥150 dk ise bir ek kontrol. Varıştan +48 saat sonra `COMPLETE`. Trip başına en fazla 7 sağlayıcı çağrısı.
- Aviationstack tamamen çıkarıldı. Rota, saat ve uçak bilgisi aynı AeroDataBox yanıtından geliyor. Rota çözülemezse `routeUnknown=true` yazılıyor, EU261 hesabı ve proaktif claim e-postası atlanıyor.
- Kota koruması: `AERODATABOX_MONTHLY_QUOTA` / `AERODATABOX_UNITS_PER_CALL` env'leri ve RapidAPI `x-ratelimit-*` başlıkları. Eşikler %80, %95 ve %100; her eşikte admin'e bir e-posta.
- Dev ve preview ortamında sağlayıcı yerine mock ve fixture kullanılıyor. Canlı çağrı yalnızca `VERCEL_ENV=production` ya da `AERODATABOX_FORCE_LIVE=true` iken yapılıyor.

### 1.4 EU261/UK261 motoru — `d862f95`
- `lib/compensation/engine.ts` tek saf fonksiyon: `evaluateCompensation()` → `{ regime, status, amount, currency, distanceKm, reasons[] }`. Eski `services/guardian/eu261Rules.ts` ve `lib/compensation/regulations.ts` silindi.
- Kapsam, UK261 ayrımı, son varış noktasına mesafe, ≥180 dk varış gecikmesi, >3500 km'de 180–239 dk için %50, iptalde 14 gün kuralı, her pozitif sonuçta "olağanüstü koşul" uyarısı. DGCA kaldırıldı; AU iç hat `NOT_ELIGIBLE` + `no statutory compensation scheme`.
- Bulunan hata: eski worker ülkeyi `airports` paketinin `.country` alanından okuyordu. Bu alan her zaman boştu, dolayısıyla kapsam fiilen sadece taşıyıcı listesine bakıyordu. Düzeltildi.
- Worker: gecikme kovaları 15/30/60/180/240, 60 dk tavanı yok. 180 dk'nın altında "hakkınız var" e-postası gönderilmiyor.
- `app/api/actions/claim/route.ts`: tutar artık gecikme süresinden türetilmiyor.
- 34 senaryo §6'da.

### Güvenlik taraması — `cf71c12` (kalıcı kural gereği ayrı commit)
Dinamik segment (`[id]` vb.) alan tüm page ve route'lar, ayrıca body/query'den id alan API'ler ve server action'lar tarandı.

| Dosya | Önceki durum | Düzeltme |
|---|---|---|
| `app/[locale]/dashboard/guardian/[id]/page.tsx:50` | Oturum var, sahiplik kontrolü yok. Giriş yapan herkes, id'sini bildiği trip'in yolcu, alert ve teslimat verisini görebiliyordu (IDOR) | `getCurrentUserId` + `isOwnedBy`, sahip değilse `notFound()` (404) |
| `app/[locale]/dashboard/guardian/[id]/amenity/page.tsx:21` | Kimlik doğrulama yok, PNR sızıyordu | Oturum yoksa login'e yönlendirme, sahip değilse 404 |
| `app/api/playbook/[monitoredTripId]/route.ts:37` | Kimlik doğrulama yok, playbook okunabiliyordu | Oturum yoksa 401, sahip değilse 404 |
| `app/api/playbook/generate/route.ts:65` | Kimlik doğrulama yok, herhangi bir trip için upsert yapılabiliyordu | Oturum yoksa 401, sahip değilse 404 |
| `app/api/admin/experiments/route.ts:15`, `…/experiments/[id]/route.ts:15` | `ADMIN_EMAILS` tanımsızken `"".split(",")` → `[""]` sonucu, e-postası olmayan (oturumsuz) herkesi admin sayıyordu | `lib/auth/adminEmails.ts` `isListedAdminEmail()`, boş girdiler atılıyor |
| `app/api/admin/decision-config/route.ts:8` | `filter(Boolean)` vardı, açık yoktu | Aynı ortak helper'a taşındı |
| `app/[locale]/(public)/trip/[id]/page.tsx:9` | Oturumsuz erişilebilir, `subscriberEmail` tam gösteriliyordu | E-posta maskelendi (`a***@domain`) |
| `app/actions/flight.ts:10` `getLatestSeatMap` | Oturumsuz server action, ücretli Amadeus kotası harcıyordu | Oturum zorunlu |
| `app/api/compensation/generate-letter/route.ts:60,94` | (1.5'te yeniden yazıldı) | `tripId` ve `claimId` için `isOwnedBy` |
| Sorunsuz bulunanlar | `api/guardian/[tripId]`, `api/guardian/[tripId]/alerts/stale`, `api/track-route/[id]`, `(protected)/claim-process/[tripId]`, `api/admin/claims/[id]/status`, `actions/delete-route`, `actions/deleteWatchedFlight`, `api/actions/claim`, `api/guardian/check` (QStash imzası), `blog/[slug]` (public içerik) | — |

- `lib/auth/ownership.ts:7` `isOwnedBy()`: sahibi `null` olan lead trip'leri, çağıran da `null` olsa bile asla eşleşmez.
- Testler: `tests/ownership.test.ts` (6).
- Tarama sınırı: yalnızca `[param]`, `searchParams.get('id'|'tripId'|…)` ve `body.tripId` benzeri kalıplar arandı. Farklı adlandırılmış id alanları gözden kaçmış olabilir.

### 1.5 Hukuki metin temizliği — `9087e9a`
- **Upload flag:** `lib/featureFlags.ts:59` `isClaimDocumentUploadEnabled()`. Varsayılan kapalı, açmak için `CLAIM_DOCUMENT_UPLOAD_ENABLED=true`. Kapalıyken `app/api/claims/route.ts:15` ve `app/api/actions/claim/route.ts:12` 503 dönüyor. `claim-process/[tripId]/page.tsx:48` formu gizleyip bir bilgilendirme gösteriyor. Kod silinmedi.
- **PDF** (`services/legal/pdfGenerator.ts`): "Represented by: Travel Guardian Legal Tech", "not caused by extraordinary circumstances", "FORMAL NOTICE" ve "PAYMENT DEMAND" kaldırıldı. Yeni dil: "I believe I may be entitled…" (`:51`). Sayfa sonuna "not legal advice" notu eklendi. Rejim (EU261/UK261) motordan geliyor.
- **Mektup:** `lib/compensation/claimLetter.ts:73` `buildClaimLetter()`. Motor `LIKELY_ELIGIBLE` demedikçe mektup üretilmiyor. Tutar yalnızca motordan geliyor.
  - `generate-letter` (`:49` `loadSource`): `tripId`, `claimId` veya uçuş bilgisi kabul ediyor. İstemcinin gönderdiği `compensationAmount/currency/regulation` artık şemada yok.
  - Yolcu adı trip'teki `Passenger` kaydından ya da kullanıcı adından alınıyor. "Passenger" placeholder'ı reddediliyor; ad yoksa 422 `passenger_name_required` dönüyor ve arayüz adı soruyor (`TripDetailsClient.tsx:433`).
- `app/api/actions/claim/route.ts:94,102`: gerçek yolcu adı, motor tutarı ve son varış noktası. Uygun değilse 422.
- **E-posta uyarısı:** `lib/email/legalFooter.ts:15` `withLegalFooter()`. Üç Resend gönderim noktasında uygulanıyor: `lib/email/sender.ts:55`, `services/notifications/providers/resend.ts:21`, `services/notifications/sender.ts`. Böylece şablon fark etmeksizin tüm e-postalar uyarıyı taşıyor.
- **UI uyarısı:** `components/legal/LegalDisclaimer.tsx` şu yerlerde gösteriliyor: `components/Footer.tsx:50`, claim-process sayfası, `TripDetailsClient.tsx:673` (claim kartı), `CompensationDetailModal.tsx:126`. en/de/tr çevirileri `messages/*.json` → `Legal`.
- **`/terms` ve `/privacy`:** `app/[locale]/(public)/{terms,privacy}/page.tsx`. Placeholder içerik, `noindex`, dosyada `TODO(owner)` var. Footer'a linkleri eklendi.
- Playbook ve kullanılmayan eski şablonlardaki kesin ifadeler yumuşatıldı (`lib/playbook/generator.ts`, `services/guardianEnginePro.ts`, `services/notifications/templates.{ts,js}`).
- Testler: `tests/legalText.test.ts` (6), `tests/featureFlags.test.ts` (1).

### 1.6 Site metni ve fiyatlandırma — `c24d2fe`
- **İç dil kaldırıldı (en/de/tr):**
  - "Guardian mode is active" → "Flight disruption monitoring" (`messages/en.json:389`)
  - "FlightAgent now focuses on Guardian workflows…" → ürünü anlatan yeni metin (`:393`)
  - Footer "Trip decision intelligence…" → `:110`
  - About sayfasının alt başlığı, misyon ve hikâye metinleri yeniden yazıldı (de sürümündeki bozuk `?` karakterleri de düzeldi)
- **Pricing** (`app/[locale]/pricing/page.tsx`): Pro'dan "Priority disruption alerts", "EU261 claim letter + PDF" ve "Email to airline (automated)" çıkarıldı. Pro'da "Monitor unlimited flights" ve "Alert history" kaldı. Alt başlıktaki "get compensated" vaadi kaldırıldı.
- **Pro checkout gizli:** `lib/featureFlags.ts:73` `isProCheckoutEnabled()`, `NEXT_PUBLIC_PRO_CHECKOUT_ENABLED` (varsayılan kapalı), `pricing/page.tsx:88`. Buton yerine "Pro is coming soon" yazıyor. `/api/checkout` route'una dokunulmadı.
- **Free "basic claim letter" çalışıyor:** `lib/freemium/limits.ts:8` `compensationLetters: true` → 402 artık dönmüyor. `generate-letter` magic-link oturumunu da kabul ediyor (`:135`). Lead kullanıcılar bu yolla geliyor.
- **Rate limit** (`app/api/trips/track/route.ts:80`, `lib/guardian/trackRateLimit.ts:20`):
  - E-posta başına saatte 3, IP başına saatte 10 istek. Aşılırsa 429 + `Retry-After`.
  - Sayaç, `MonitoredTrip` satırlarından (`subscriberEmail/requestIpHash + createdAt`) tutuluyor. Redis gerektirmiyor ve serverless'ta çalışıyor. Ayrı bir tablo olmadığı için temizlik de gerekmiyor.
  - IP ham olarak saklanmıyor, `NEXTAUTH_SECRET` ile HMAC'lenmiş hâli tutuluyor.
- **Double opt-in:**
  - Form trip'leri `PENDING_CONFIRMATION` olarak oluşuyor (`:109`). QStash planı ve AeroDataBox çağrısı yok.
  - E-postadaki link açılınca `app/api/auth/verify/route.ts:48` → `lib/guardian/tripConfirmation.ts:11` kullanıcının bekleyen tüm trip'lerini `ACTIVE` yapıyor, `confirmedAt` yazıyor ve izlemeyi başlatıyor.
  - Link 24 saat geçerli (`:17`). Link, trip panelini (`/dashboard/guardian/:id`) açıyor.
  - E-posta metni (`WelcomeTripEmail.tsx:30`) ve onay sayfası metni "e-postanızı onaylayın" diyecek şekilde güncellendi.
- **Şema:** `MonitoredTrip.confirmedAt`, `requestIpHash` ve iki index (`prisma/schema.prisma:540`, `:597-598`).
- Testler: `tests/trackRateLimit.test.ts` (5), `tests/freemium.test.ts` (1).

---

## 2. Deploy sırası

Sıra önemlidir. Kod en son gider, çünkü yeni kod hem yeni kolonları okur hem de env eksikse açılışta hata fırlatır (fail-fast).

### Adım 1 — Şema
1. Neon'da bir branch oluştur ve connection string'ini `.env.local` içine `DATABASE_URL` olarak yaz.
2. Host'u teyit et (§4). Ardından branch'e karşı gerçek fark:
   `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
   Beklenen çıktı `docs/phase1_schema.sql` ile aynıdır. Fazlası çıkarsa bu, migration kaymasıdır (STATUS_REPORT #17). DROP görürsen dur.
3. Branch'e uygula, branch üzerinde uygulamayı test et, sonra aynı SQL'i prod'a uygula.
4. Değişikliklerin hepsi eklemelidir: nullable ya da default'lu kolon, yeni tablo, yeni enum değeri, index. Veri kaybı yoktur. Eski kod yeni şemayla çalışmaya devam eder, bu yüzden şemayı önce uygulamak güvenlidir.

### Adım 2 — Environment variables (Vercel, Production)
| Değişken | Zorunlu | Not |
|---|---|---|
| `NOTIFICATION_FROM_EMAIL` | Evet (fail-fast) | Resend'de doğrulanmış domain'den bir adres |
| `APP_BASE_URL` | Evet (fail-fast) | Örn. `https://flightagent.io`. E-posta linkleri ve QStash callback'i bunu kullanır |
| `RESEND_API_KEY` | Evet (fail-fast) | Rotasyon sonrası yeni key |
| `NEXTAUTH_SECRET` veya `AUTH_SECRET` | Evet (fail-fast) | Magic-link imzası ve IP hash anahtarı |
| `QSTASH_TOKEN` | Prod'da evet | Checkpoint yayınlama |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Prod'da evet | `/api/guardian/check` imza doğrulaması |
| `RAPID_API_KEY`, `RAPID_API_HOST_AERODATABOX` | Prod'da evet | AeroDataBox |
| `AERODATABOX_MONTHLY_QUOTA`, `AERODATABOX_UNITS_PER_CALL` | Önerilir | Kota koruması. Planına göre ayarla |
| `AERODATABOX_FORCE_LIVE` | Hayır | Sadece preview'da canlı veri gerekiyorsa `true` |
| `ADMIN_EMAIL` / `ADMIN_EMAILS` | Önerilir | Kota uyarısı ve admin route'ları. Boşsa kimse admin değildir |
| `CLAIM_DOCUMENT_UPLOAD_ENABLED` | Hayır | Tanımlama (kapalı kalmalı) |
| `NEXT_PUBLIC_PRO_CHECKOUT_ENABLED` | Hayır | Tanımlama. Build sırasında gömülür, değiştirince yeniden build gerekir |

Fail-fast listesindeki bir değişken eksikse `app/[locale]/layout.tsx` her sayfada hata fırlatır ve **tüm site açılmaz**. Bu yüzden env'ler koddan önce girilmelidir.

### Adım 3 — Kod
1. `main`'i push et ve Vercel deploy'unu bekle.
2. Deploy sonrası kontrol:
   - `npx tsx scripts/send-test-alert.ts <adres>` ile e-posta teslimatı
   - Formdan bir test trip'i oluştur → onay e-postası → linke tıkla → trip `ACTIVE` olmalı ve QStash'te checkpoint'ler görünmeli
3. **Eski ACTIVE trip'ler:** cron kaldırıldığı için deploy öncesinde oluşmuş aktif trip'lerin QStash planı yok ve kendiliğinden kontrol edilmeyecekler. Bir backfill script'i yazılmadı (§7). Bu trip'ler için `initializeTripMonitoring(tripId)` bir kez çağrılmalı.

### Şema uygulanmadan kod deploy edilirse ne kırılır
Prisma varsayılan olarak modelin tüm skaler kolonlarını SELECT eder. Kolon DB'de yoksa sorgu `P2022 column does not exist` hatasıyla düşer. Sonuçları:

- **Giriş tamamen çalışmaz:** `/api/auth/verify`, `LoginToken.findUnique` sırasında `emailError` kolonunu bulamaz. Magic-link ile giriş ve double opt-in onayı imkânsız hale gelir.
- **Takip formu çalışmaz:** `/api/trips/track` içinde rate-limit sorgusu (`requestIpHash`), `monitoredTrip.create` (yeni kolonlar ve `PENDING_CONFIRMATION` enum değeri) ve `loginToken.create` (`emailError`) hepsi düşer. Kullanıcı 500 alır.
- **Trip okuyan her sayfa ve route 500 verir:** `MonitoredTrip` (`routeUnknown`, `apiCallsUsed`, `monitoringEndsAt`, `lastEmailError*`, `confirmedAt`, `requestIpHash`) ve `FlightSegment` (`scheduledDepartureUtc`, `scheduledArrivalUtc`) kolonları yüzünden. Etkilenenler:
  - dashboard ve `/dashboard/guardian/[id]`
  - my-trips ve claim-process
  - `generate-letter`, `actions/claim`, `compensation/calculate`
  - playbook route'ları, `api/guardian/[tripId]`, `api/inbound`
- **İzleme hiç çalışmaz:** `ScheduledTripCheck` ve `ApiQuotaState` tabloları yok. Checkpoint planlama ve kota kontrolü hata verir, `/api/guardian/check` 500 döner ve QStash sürekli yeniden dener.
- **E-posta hata işaretleme düşer:** `lastEmailError` update'i başarısız olur. Hata, ilk hatanın üstüne yeni bir 500 olarak çıkar.
- **Etkilenmeyenler:** statik pazarlama sayfaları, blog ve pricing (env'ler tamamsa). Ancak ürünün çekirdek akışlarının hepsi durur.

---

## 3. Test sonuçları

```
npx tsc --noEmit   → exit 0
npm test           → tests 89, pass 89, fail 0
```

---

## 4. Şema adımı (durduruldu)

- Faz 1'deki tüm şema değişikliklerini (1.2, 1.3 ve 1.6) içeren tek diff: **`docs/phase1_schema.sql`**. Faz öncesi şemadan (`8350218:prisma/schema.prisma`) üretildi: `prisma migrate diff --from-schema-datamodel <eski> --to-schema-datamodel prisma/schema.prisma --script`. Veritabanına bağlanılmadı.
- İçerik:
  - `TripStatus` + `PENDING_CONFIRMATION`
  - `MonitoredTrip` + `apiCallsUsed`, `confirmedAt`, `lastEmailError`, `lastEmailErrorAt`, `monitoringEndsAt`, `requestIpHash`, `routeUnknown`
  - `LoginToken` + `emailError`
  - `FlightSegment` + `scheduledArrivalUtc`, `scheduledDepartureUtc`
  - Yeni tablolar `ScheduledTripCheck` (FK cascade) ve `ApiQuotaState` (provider+period unique)
  - İki yeni `MonitoredTrip` index'i
  - DROP yok
- **Branch host kontrolü:**
  - `.env.local` → `DATABASE_URL` **tanımlı değil**. Uygulanacak bir branch yok.
  - `.env` → `ep-gentle-math-a7ajyh5a-pooler.ap-southeast-2.aws.neon.tech / db=neondb`. Büyük olasılıkla prod. **Kullanılmadı ve kullanılmayacak.**
- Branch URL'i `.env.local`'a girildiğinde: host yazdırılacak, sen teyit edeceksin, sonra `migrate diff --from-url` ile gerçek fark alınıp branch'e uygulanacak.
- Not: `ALTER TYPE … ADD VALUE` aynı transaction içinde yeni değeri kullanan bir ifadeyle birlikte çalıştırılamaz. SQL dosyası bunu yapmıyor.

---

## 5. Senin yapman gereken manuel adımlar

1. **Travelpayouts token'ını iptal et** (panelden). Git geçmişinde hâlâ duruyor.
2. **Git geçmişi temizliği.** Token iptalinden sonra, repo'nun yedeğini alarak:
   ```bash
   git filter-repo --invert-paths --path scripts/test_tp.js --path scripts/test_tp_live.js
   ```
   Ardından `git push --force --all` ve `git push --force --tags`. Bu işlem tüm commit hash'lerini değiştirir. Diğer klonların yeniden klonlanması gerekir. Açık PR'lar bozulur.
3. **Key rotasyonu:**
   - Resend API key: eskisi loglarda ve prefix olarak görünmüş olabilir
   - AeroDataBox (RapidAPI) key
   - Stripe secret ve webhook secret: prefix'leri loglandı
4. **Resend domain doğrulaması:** SPF, DKIM ve DMARC. `NOTIFICATION_FROM_EMAIL` bu domain'den bir adres olmalı.
5. **Vercel env'leri:** §2 Adım 2'deki tablo.
6. **Neon branch:** connection string'i `.env.local`'a `DATABASE_URL` olarak koy. Şema adımına oradan devam edilecek.
7. **QStash:** Upstash konsolunda token ve signing key'leri al. `APP_BASE_URL` prod domain'i olmalı, çünkü callback'ler oraya gidiyor.
8. **`/terms` ve `/privacy` metinlerini yaz:** `app/[locale]/(public)/{terms,privacy}/page.tsx`, `TODO(owner)`.
9. **Deploy sonrası:** eski ACTIVE trip'ler için checkpoint backfill (§2 Adım 3).

---

## 6. EU261/UK261 motoru — 34 test senaryosu (`tests/compensationEngine.test.ts`)

Varsayılan girdi: gecikme senaryolarında planlanan varış ile kapı açılışı arasındaki fark. "Fixture" satırları gerçek AeroDataBox yanıt şemasıyla hazırlanmış mock'lardır (`lib/flightData/__fixtures__`).

| # | Girdi | Beklenen rejim | Durum | Tutar |
|---|---|---|---|---|
| 1 | LH MUC→FCO, 200 dk gecikme (AB içi ≤1500 km) | EU261 | LIKELY_ELIGIBLE | €250 |
| 2 | IB MAD→ARN, 200 dk (AB içi 1500–3500 km) | EU261 | LIKELY_ELIGIBLE | €400 |
| 3 | AF CDG→RUN (Réunion), 300 dk (AB içi >3500 km) | EU261 | LIKELY_ELIGIBLE | €400 (€600 değil) |
| 4 | AF CDG→RUN, 200 dk (AB içi uzun, 3–4 saat) | EU261 | LIKELY_ELIGIBLE | €400 (%50 indirim yok) |
| 5 | Fixture XX1180 CDG→JFK, 185 dk | EU261 | LIKELY_ELIGIBLE | €300 (€600'ün %50'si) |
| 6 | Fixture XX1240 CDG→JFK, 245 dk | EU261 | LIKELY_ELIGIBLE | €600 |
| 7 | AF CDG→JFK, tam 180 dk | EU261 | LIKELY_ELIGIBLE | €300 |
| 8 | AF CDG→JFK, 179 dk | EU261 | NOT_ELIGIBLE | — |
| 9 | AF CDG→JFK, tam 240 dk | EU261 | LIKELY_ELIGIBLE | €600 |
| 10 | EK DXB→FRA, 300 dk (AB dışı taşıyıcı, AB'ye varış) | NONE | NOT_ELIGIBLE | — |
| 11 | LH JFK→FRA, 200 dk (AB taşıyıcısı, AB'ye varış) | EU261 | LIKELY_ELIGIBLE | €300 |
| 12 | XX JFK→FRA, 300 dk (bilinmeyen taşıyıcı, AB'ye varış) | EU261 | NEEDS_INFO | — |
| 13 | W6 TLV→BUD, 200 dk (Wizz, dışarıdan AB'ye) | EU261 | LIKELY_ELIGIBLE | €400 |
| 14 | LX ZRH→JFK, 250 dk (İsviçre kalkış) | EU261 | LIKELY_ELIGIBLE | (rejim testi) |
| 15 | BA LHR→JFK, 250 dk (UK kalkış, uzun) | UK261 | LIKELY_ELIGIBLE | £520 |
| 16 | U2 LGW→AMS, 190 dk (UK kalkış, kısa) | UK261 | LIKELY_ELIGIBLE | £220 |
| 17 | DL LHR→JFK, 200 dk (UK kalkış, UK dışı taşıyıcı) | UK261 | LIKELY_ELIGIBLE | £260 (%50) |
| 18 | DL JFK→LHR, 300 dk (UK'ye varış, UK/AB dışı taşıyıcı) | NONE | NOT_ELIGIBLE | — |
| 19 | IB JFK→LHR, 300 dk (UK'ye varış, AB taşıyıcısı) | UK261 | LIKELY_ELIGIBLE | (rejim testi) |
| 20 | BA CDG→LHR, 200 dk (AB kalkış, UK taşıyıcı) | EU261 (+ "UK261 may also apply" notu) | LIKELY_ELIGIBLE | €250 |
| 21 | TK FRA→(IST)→SIN, 300 dk (aktarmalı, son varış) | EU261 | LIKELY_ELIGIBLE | €600 (yalnız FRA→IST olsaydı €400) |
| 22 | LH FRA→MAD iptal, 10 gün önce bildirim | EU261 | LIKELY_ELIGIBLE | €250 |
| 23 | LH FRA→MAD iptal, 20 gün önce bildirim | EU261 | NOT_ELIGIBLE | — |
| 24 | Fixture XX1300 MUC→FCO iptal, bildirim tarihi yok | EU261 | NEEDS_INFO | — |
| 25 | Fixture U21234 BER→FCO, zamanında | EU261 | NOT_ELIGIBLE | — |
| 26 | U2 BER→FCO, 200 dk (UK taşıyıcı, AB içi) | EU261 | LIKELY_ELIGIBLE | €250 |
| 27 | Taşıyıcı sınıflandırması: U2=UK, W6=COMMUNITY, JU=UNKNOWN, TK=OTHER, null=UNKNOWN | — | — | — |
| 28 | QF SYD→MEL, 400 dk (AU iç hat) | NONE | NOT_ELIGIBLE (`no statutory compensation scheme`, DGCA yok) | — |
| 29 | AA JFK→LAX, 400 dk (AB/UK dışı) | NONE | NOT_ELIGIBLE | — |
| 30 | LH ZZZ→FRA (bilinmeyen havalimanı) | NONE | NEEDS_INFO | — |
| 31 | LH MUC→FCO 200 dk; sadece actual arrival verisi var | EU261 | LIKELY_ELIGIBLE, reason'da "gate arrival not available" notu | €250 |
| 32 | Fixture XX1180 henüz inmemiş (`active`, varış verisi yok) | EU261 | NEEDS_INFO | — |
| 33 | Pozitif sonuçlar (MUC→FCO 200 dk, 3 gün önce iptal, XX1240): hepsinde "extraordinary circumstances" uyarısı; negatifler (MUC→FCO 100 dk, EK DXB→FRA) | EU261 | LIKELY_ELIGIBLE / NOT_ELIGIBLE | pozitif: bant tutarı; negatif: — |
| 34 | LH MUC→FCO 245, 300 ve 600 dk | EU261 | LIKELY_ELIGIBLE | Hepsi €250: tutar gecikme süresinden türetilmiyor |

---

## 7. Açık kalan riskler

- **Şema uygulanmadı.** Kod şu an hiçbir DB ile uyumlu değil (§2). Deploy sırası kritik.
- **Eski ACTIVE trip'ler için backfill yok.** Cron kaldırıldı; deploy öncesi trip'ler izlenmeyecek. Küçük bir script gerekir (istersen yazarım).
- **Onaylanmamış `PENDING_CONFIRMATION` trip'leri temizlenmiyor.** Zararsızlar (izlenmiyor, e-posta gitmiyor) ama birikirler. Periyodik silme ya da arşivleme gerekir.
- **Double opt-in linki aynı zamanda 30 günlük oturum açıyor.** 24 saatlik geçerlilik süresi login linki için uzun sayılabilir. Link kaçarsa hesaba erişim sağlar.
- **İki ayrı auth sistemi hâlâ duruyor.** NextAuth iki örnek hâlinde (`auth.ts` ve `lib/auth.ts`), bir de magic-link var. Guardian sayfaları ve `generate-letter` artık ikisini de kabul ediyor. Checkout ve bazı dashboard route'ları hâlâ yalnızca NextAuth kabul ediyor (STATUS_REPORT #10).
- **Claim formundaki vekâlet metni** (`messages/en.json` → `ClaimProcess`: "authorize FlightAgent to file this compensation claim on your behalf") duruyor. Akış flag ile kapalı, ama flag açılmadan önce hukuken yeniden yazılmalı.
- **`/pricing/features` sayfası** eski ürünün planlarını (Guardian/Elite, itinerary scoring) gösteriyor. Ana pricing sayfasıyla çelişiyor. Kaldırılmalı ya da yeniden yazılmalı.
- **Ölü i18n anahtarları:** `HomePage.hero/badge/trust/faq` altında eski "Trip Decision Intelligence" metinleri var. Render edilmiyorlar, ama ölü kod temizliğinde silinmeliler.
- **Free plan limiti:** "1 uçuş" limiti `/api/trips/track`'te uygulanmıyor. Rate limit kötüye kullanımı sınırlıyor, plan limitini değil.
- **`/api/checkout`** buton gizli olsa da doğrudan çağrılabilir. Stripe webhook eksikleri (STATUS_REPORT #11) sürüyor.
- **Pasaport/IBAN depolaması** hâlâ yerel diske yazıyor. Flag kapalı olduğu sürece erişilemez.
- **Güvenlik taraması** kalıp tabanlıydı (§1). Tüm API yüzeyinin elle denetimi yapılmadı.
- **`next build` ve uçtan uca test çalıştırılmadı.**
