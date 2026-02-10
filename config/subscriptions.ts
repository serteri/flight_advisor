export const SUBSCRIPTION_PLANS = {
    FREE: {
        id: 'free',
        name: 'Gezgin',
        price: 0,
        stripePriceId: null,
        features: ['Basic Search', 'Price Tracking']
    },
    GUARDIAN: {
        id: 'guardian',
        name: 'Guardian Pro',
        price: 9.90,
        stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
        features: ['Junior Guardian', 'Agent Score', 'Risk Analysis']
    },
    ELITE: {
        id: 'elite',
        name: 'Elite Family',
        price: 19.90,
        stripePriceId: process.env.STRIPE_ELITE_PRICE_ID,
        features: ['All Guardian features', 'Priority Support', 'Concierge']
    },
};
