// services/agents/loungeEngine.ts
import { AccessRule, UserAsset, LoungeAccessResult, LoungeNetwork, AccessLevel } from '@/types/lounge';

export interface PassengerInfo {
    age: number;
    type: 'ADULT' | 'CHILD' | 'INFANT';
}

/**
 * Dynamic Lounge Intelligence Engine
 * Evaluates best lounge access based on user's wallet and lounge networks
 */
export function evaluateLoungeAccess(
    loungeNetworks: LoungeNetwork[],
    userAssets: UserAsset[],
    allRules: AccessRule[],
    passengers: PassengerInfo[]
): LoungeAccessResult {

    // 1. Filter applicable rules (lounge accepts AND user has the asset)
    const userAssetIds = userAssets.map(a => a.id);
    const applicableRules = allRules.filter(rule =>
        loungeNetworks.includes(rule.network) &&
        userAssetIds.includes(rule.requiredAsset)
    );

    if (applicableRules.length === 0) {
        return {
            hasAccess: false,
            accessLevel: 'PAID',
            guestCount: 0,
            childrenStatus: { freeCount: 0, paidCount: 0, details: 'No matching access' },
            reason: 'Geçerli lounge erişim kartı veya statüsü bulunamadı.',
            recommendation: 'Priority Pass veya premium kredi kartı edinmeyi düşünün.'
        };
    }

    // 2. Rank rules by priority (best access first)
    const rankedRules = applicableRules.sort((a, b) => {
        // First by access level (FREE > DISCOUNTED > PAID)
        if (a.accessLevel === 'FREE' && b.accessLevel !== 'FREE') return -1;
        if (b.accessLevel === 'FREE' && a.accessLevel !== 'FREE') return 1;

        // Then by guest count
        if (a.guestPolicy.maxGuests !== b.guestPolicy.maxGuests) {
            return b.guestPolicy.maxGuests - a.guestPolicy.maxGuests;
        }

        // Finally by priority
        return b.priority - a.priority;
    });

    const bestRule = rankedRules[0];

    // 3. Analyze passenger composition
    const adults = passengers.filter(p => p.type === 'ADULT');
    const children = passengers.filter(p => p.type === 'CHILD');
    const infants = passengers.filter(p => p.type === 'INFANT');

    // 4. Calculate child access
    let freeChildren = 0;
    let paidChildren = 0;
    let childDetails = '';

    if (bestRule.guestPolicy.childFriendly) {
        // Children under age limit are free
        freeChildren = children.filter(c => c.age < bestRule.guestPolicy.childAgeLimit).length;
        paidChildren = children.filter(c => c.age >= bestRule.guestPolicy.childAgeLimit).length;

        // Infants always free if policy allows
        if (bestRule.guestPolicy.infantFree) {
            freeChildren += infants.length;
        } else {
            paidChildren += infants.length;
        }

        childDetails = freeChildren > 0
            ? `${freeChildren} çocuk ücretsiz (<${bestRule.guestPolicy.childAgeLimit} yaş)`
            : 'Çocuk erişimi ücretli';
    } else {
        paidChildren = children.length + infants.length;
        childDetails = 'Çocuklar için ek ücret gerekir';
    }

    // 5. Total guest calculation
    const totalGuests = adults.length + children.length + infants.length - 1; // -1 for cardholder
    const guestCount = Math.min(totalGuests, bestRule.guestPolicy.maxGuests);

    // 6. Generate recommendation
    let recommendation = '';
    if (totalGuests > bestRule.guestPolicy.maxGuests) {
        const excess = totalGuests - bestRule.guestPolicy.maxGuests;
        recommendation = `${excess} misafir için ek ücret ödenecek.`;
    }
    if (rankedRules.length > 1) {
        recommendation += ` Alternatif: ${rankedRules[1].network} ile ${rankedRules[1].guestPolicy.maxGuests} misafir.`;
    }

    return {
        hasAccess: true,
        accessLevel: bestRule.accessLevel,
        matchedRule: bestRule,
        guestCount,
        childrenStatus: {
            freeCount: freeChildren,
            paidCount: paidChildren,
            details: childDetails
        },
        reason: `${bestRule.network} erişimi: ${bestRule.accessLevel} (${guestCount} misafir hakkı)`,
        recommendation: recommendation || undefined
    };
}

/**
 * Get default lounge access rules (can be replaced with DB query)
 */
export function getDefaultLoungeRules(): AccessRule[] {
    return [
        // Priority Pass Rules
        {
            id: 'PP_PREMIER',
            requiredAsset: 'PRIORITY_PASS_PREMIUM',
            assetType: 'MEMBERSHIP',
            network: 'PRIORITY_PASS',
            accessLevel: 'FREE',
            priority: 100,
            guestPolicy: {
                maxGuests: 2,
                childFriendly: true,
                childAgeLimit: 12,
                infantFree: true
            }
        },
        {
            id: 'PP_STANDARD',
            requiredAsset: 'PRIORITY_PASS_STANDARD',
            assetType: 'MEMBERSHIP',
            network: 'PRIORITY_PASS',
            accessLevel: 'DISCOUNTED',
            priority: 50,
            guestPolicy: {
                maxGuests: 0,
                childFriendly: true,
                childAgeLimit: 2,
                infantFree: true
            }
        },

        // American Express Rules
        {
            id: 'AMEX_PLAT',
            requiredAsset: 'AMEX_PLATINUM',
            assetType: 'CARD',
            network: 'CENTURION',
            accessLevel: 'FREE',
            priority: 120,
            guestPolicy: {
                maxGuests: 2,
                childFriendly: true,
                childAgeLimit: 18,
                infantFree: true
            }
        },
        {
            id: 'AMEX_GOLD',
            requiredAsset: 'AMEX_GOLD',
            assetType: 'CARD',
            network: 'PRIORITY_PASS',
            accessLevel: 'FREE',
            priority: 80,
            guestPolicy: {
                maxGuests: 1,
                childFriendly: true,
                childAgeLimit: 12,
                infantFree: true
            }
        },

        // Airline Status Rules
        {
            id: 'TK_GOLD',
            requiredAsset: 'TURKISH_AIRLINES_GOLD',
            assetType: 'STATUS',
            network: 'AIRLINE_LOUNGE',
            accessLevel: 'FREE',
            priority: 90,
            guestPolicy: {
                maxGuests: 1,
                childFriendly: true,
                childAgeLimit: 6, // Turkish Airlines: Under 6 free
                infantFree: true
            }
        },
        {
            id: 'QF_GOLD',
            requiredAsset: 'QANTAS_GOLD',
            assetType: 'STATUS',
            network: 'AIRLINE_LOUNGE',
            accessLevel: 'FREE',
            priority: 85,
            guestPolicy: {
                maxGuests: 1,
                childFriendly: true,
                childAgeLimit: 12, // Qantas: Under 12 free with parent
                infantFree: true
            }
        },

        // LoungeKey
        {
            id: 'LK_PREMIUM',
            requiredAsset: 'LOUNGE_KEY_PREMIUM',
            assetType: 'MEMBERSHIP',
            network: 'LOUNGE_KEY',
            accessLevel: 'FREE',
            priority: 75,
            guestPolicy: {
                maxGuests: 1,
                childFriendly: true,
                childAgeLimit: 2,
                infantFree: true
            }
        }
    ];
}
