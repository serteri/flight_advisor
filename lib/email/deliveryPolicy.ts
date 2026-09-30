// lib/email/deliveryPolicy.ts
//
// Real email leaves only from the Vercel *production* deployment. Everything
// else — local dev, local `next start`, Vercel preview (which also runs with
// NODE_ENV=production!) — is mocked: those environments can point at Neon
// branches that are copies of production with real subscribers' addresses,
// and RESEND_API_KEY is the real key.
//
// Every Resend send point asks this first: deliverViaResend (magic-link,
// opt-in, disruption alert, quota alert), ResendProvider and the claim
// attachment sender. EMAIL_FORCE_LIVE=true overrides it for a deliberate
// end-to-end test. scripts/send-test-alert.ts bypasses it explicitly.

export function isRealEmailDeliveryAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.VERCEL_ENV === 'production' || env.EMAIL_FORCE_LIVE === 'true';
}
