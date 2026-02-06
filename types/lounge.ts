// types/lounge.ts

export type AssetType = 'CARD' | 'STATUS' | 'MEMBERSHIP';
export type AccessLevel = 'FREE' | 'DISCOUNTED' | 'PAID';
export type LoungeNetwork =
    | 'CENTURION'
    | 'PRIORITY_PASS'
    | 'LOUNGE_KEY'
    | 'PLAZA_PREMIUM'
    | 'DRAGON_PASS'
    | 'AIRLINE_LOUNGE';

export interface GuestPolicy {
    maxGuests: number;
    childFriendly: boolean;
    childAgeLimit: number; // Kids under this age are free
    infantFree: boolean;   // Infants always free
}

export interface AccessRule {
    id: string;
    requiredAsset: string;  // 'AMEX_PLAT', 'PP_PREMIER', 'TK_GOLD', etc.
    assetType: AssetType;
    network: LoungeNetwork;
    accessLevel: AccessLevel;
    guestPolicy: GuestPolicy;
    priority: number;       // Higher = better deal (for ranking)

    // Optional restrictions
    maxVisitsPerYear?: number;
    requiresBooking?: boolean;
    timeRestrictions?: {
        minHoursBeforeFlight?: number;
        maxHoursBeforeFlight?: number;
    };
}

export interface UserAsset {
    id: string;
    type: AssetType;
    name: string;           // Display name
    issuer?: string;        // Bank/airline
    expiryDate?: string;
}

export interface LoungeAccessResult {
    hasAccess: boolean;
    accessLevel: AccessLevel;
    matchedRule?: AccessRule;
    guestCount: number;
    childrenStatus: {
        freeCount: number;
        paidCount: number;
        details: string;
    };
    reason: string;
    recommendation?: string;
}
