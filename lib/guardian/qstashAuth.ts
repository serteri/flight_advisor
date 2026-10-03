// lib/guardian/qstashAuth.ts
//
// Verifies the Upstash-Signature header of a QStash delivery against the
// signing keys. Unsigned requests are accepted only in local development
// (NODE_ENV=development) so endpoints can be triggered by hand.

import { Receiver } from '@upstash/qstash';

export async function isQStashAuthorized(request: Request, rawBody: string, label: string): Promise<boolean> {
    const signature = request.headers.get('upstash-signature');
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!signature) {
        if (process.env.NODE_ENV === 'development') {
            console.warn(`[${label}] DEV: accepting unsigned request`);
            return true;
        }
        return false;
    }

    if (!currentSigningKey || !nextSigningKey) {
        console.error(`[${label}] QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY not configured`);
        return false;
    }

    try {
        const receiver = new Receiver({ currentSigningKey, nextSigningKey });
        return await receiver.verify({ signature, body: rawBody });
    } catch (error: any) {
        console.warn(`[${label}] Signature verification failed: ${error?.message || error}`);
        return false;
    }
}
