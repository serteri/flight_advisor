export type BuyNowVariantBucket = 'A' | 'B' | 'C';

export const BUY_NOW_VARIANT_STORAGE_KEY = 'fi.buyNowVariantBucket';
export const BUY_NOW_VARIANT_CHANGE_EVENT = 'fi:buyNowVariantChanged';

const isVariantBucket = (value: string | null | undefined): value is BuyNowVariantBucket =>
    value === 'A' || value === 'B' || value === 'C';

const pickRandomVariant = (): BuyNowVariantBucket => {
    const random = Math.random();
    if (random < 1 / 3) return 'A';
    if (random < 2 / 3) return 'B';
    return 'C';
};

export const normalizeBuyNowVariant = (value: unknown): BuyNowVariantBucket | null => {
    const text = String(value || '').trim().toUpperCase();
    return isVariantBucket(text) ? text : null;
};

const readVariantFromUrl = (): BuyNowVariantBucket | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);

    // Supports compact testing URL like: /flight-search?v=A
    const raw = params.get('v') || params.get('variant') || params.get('buyNowVariant');
    return normalizeBuyNowVariant(raw);
};

export const setBuyNowVariantBucket = (variant: BuyNowVariantBucket): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(BUY_NOW_VARIANT_STORAGE_KEY, variant);
        window.dispatchEvent(new CustomEvent(BUY_NOW_VARIANT_CHANGE_EVENT, { detail: { variant } }));
    } catch {
        // no-op in restricted environments
    }
};

export const getBuyNowVariantBucket = (): BuyNowVariantBucket => {
    if (typeof window === 'undefined') return 'A';

    try {
        const fromUrl = readVariantFromUrl();
        if (fromUrl) {
            setBuyNowVariantBucket(fromUrl);
            return fromUrl;
        }

        const current = window.localStorage.getItem(BUY_NOW_VARIANT_STORAGE_KEY);
        if (isVariantBucket(current)) {
            return current;
        }

        const next = pickRandomVariant();
        setBuyNowVariantBucket(next);
        return next;
    } catch {
        return 'A';
    }
};
