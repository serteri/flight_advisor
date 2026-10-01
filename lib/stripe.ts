import Stripe from 'stripe';

// Created on first use, not at module load: the SDK throws without a key, and
// `next build` imports these routes while collecting page data — a missing
// STRIPE_SECRET_KEY used to fail the whole build. Same API as before.
let instance: Stripe | null = null;
const getStripe = (): Stripe => {
    if (!instance) {
        instance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
            apiVersion: '2025-12-15.clover', // Updated to match current Stripe library
            typescript: true,
        });
    }
    return instance;
};

export const stripe: Stripe = new Proxy({} as Stripe, {
    get: (_target, prop) => Reflect.get(getStripe(), prop),
});
