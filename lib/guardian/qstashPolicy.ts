// lib/guardian/qstashPolicy.ts
//
// QStash messages are published only from the Vercel production deployment
// (or with QSTASH_FORCE_LIVE=true for a deliberate test). Everywhere else —
// local dev, local `next start`, Vercel preview — checkpoints are stored as
// SCHEDULED rows without a message id, so a copied DB or a preview can never
// schedule real callbacks (which would also spend flight-data quota).

export function isQStashPublishAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.VERCEL_ENV === 'production' || env.QSTASH_FORCE_LIVE === 'true';
}
