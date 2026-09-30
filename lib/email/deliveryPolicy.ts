// lib/email/deliveryPolicy.ts
//
// Outside production no email leaves the machine. Dev and preview databases
// can be copies of production (Neon branches) that hold real subscribers'
// addresses, and RESEND_API_KEY is the real key — so every Resend send point
// asks this first. lib/email/sender.ts, services/notifications/providers/
// resend.ts and services/notifications/sender.ts all use it.
//
// EMAIL_FORCE_LIVE=true overrides it for deliberate end-to-end tests.
// scripts/send-test-alert.ts calls Resend directly and is not affected.

export function isRealEmailDeliveryAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.NODE_ENV === 'production' || env.EMAIL_FORCE_LIVE === 'true';
}
