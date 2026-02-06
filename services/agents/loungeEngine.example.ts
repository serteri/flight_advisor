// Example Usage: Lounge Intelligence Engine

import { evaluateLoungeAccess, getDefaultLoungeRules } from '@/services/agents/loungeEngine';
import { UserAsset, LoungeNetwork } from '@/types/lounge';

// === SCENARIO 1: Aile Seyahati (Turkish Airlines Lounge) ===

const userWallet: UserAsset[] = [
    {
        id: 'TURKISH_AIRLINES_GOLD',
        type: 'STATUS',
        name: 'Turkish Airlines Elite Plus (Gold)',
        issuer: 'Turkish Airlines'
    },
    {
        id: 'AMEX_PLATINUM',
        type: 'CARD',
        name: 'American Express Platinum Card',
        issuer: 'American Express'
    }
];

const istanbulLounge: LoungeNetwork[] = ['AIRLINE_LOUNGE', 'PRIORITY_PASS'];

const family = [
    { age: 35, type: 'ADULT' as const },  // Baba
    { age: 33, type: 'ADULT' as const },  // Anne
    { age: 9, type: 'CHILD' as const },   // Oğul (9 yaşında)
    { age: 1, type: 'INFANT' as const }   // Bebek
];

const rules = getDefaultLoungeRules();

const result = evaluateLoungeAccess(istanbulLounge, userWallet, rules, family);

console.log('=== Istanbul TK Lounge Access ===');
console.log('Has Access:', result.hasAccess);
console.log('Level:', result.accessLevel);
console.log('Network:', result.matchedRule?.network);
console.log('Guests Allowed:', result.guestCount);
console.log('Children Status:', result.childrenStatus);
console.log('Reason:', result.reason);
console.log('Recommendation:', result.recommendation);

/*
Expected Output:

=== Istanbul TK Lounge Access ===
Has Access: true
Level: FREE
Network: CENTURION (Amex Platinum wins - better guest policy)
Guests Allowed: 2
Children Status: {
  freeCount: 2,    // 9-year-old + infant (both under 18)
  paidCount: 0,
  details: "2 çocuk ücretsiz (<18 yaş)"
}
Reason: CENTURION erişimi: FREE (2 misafir hakkı)
Recommendation: undefined (family fits within policy)
*/

// === SCENARIO 2: Only Priority Pass Standard ===

const budgetTravelerWallet: UserAsset[] = [
    {
        id: 'PRIORITY_PASS_STANDARD',
        type: 'MEMBERSHIP',
        name: 'Priority Pass Standard',
        issuer: 'Priority Pass'
    }
];

const soloTraveler = [
    { age: 28, type: 'ADULT' as const }
];

const ppResult = evaluateLoungeAccess(
    ['PRIORITY_PASS'],
    budgetTravelerWallet,
    rules,
    soloTraveler
);

console.log('\n=== Priority Pass Standard Access ===');
console.log('Level:', ppResult.accessLevel); // DISCOUNTED
console.log('Guests:', ppResult.guestCount); // 0
console.log('Reason:', ppResult.reason);

/*
Expected Output:
=== Priority Pass Standard Access ===
Level: DISCOUNTED
Guests: 0
Reason: PRIORITY_PASS erişimi: DISCOUNTED (0 misafir hakkı)
*/

// === SCENARIO 3: Too Many Guests ===

const bigFamily = [
    { age: 40, type: 'ADULT' as const },
    { age: 38, type: 'ADULT' as const },
    { age: 12, type: 'CHILD' as const },
    { age: 9, type: 'CHILD' as const },
    { age: 6, type: 'CHILD' as const }
];

const goldCardWallet: UserAsset[] = [
    {
        id: 'AMEX_GOLD',
        type: 'CARD',
        name: 'Amex Gold',
        issuer: 'American Express'
    }
];

const crowdedResult = evaluateLoungeAccess(
    ['PRIORITY_PASS'],
    goldCardWallet,
    rules,
    bigFamily
);

console.log('\n=== Amex Gold with Big Family ===');
console.log('Guests Allowed:', crowdedResult.guestCount); // 1 (max from rule)
console.log('Recommendation:', crowdedResult.recommendation);
// "3 misafir için ek ücret ödenecek."

// === SCENARIO 4: Database-Driven (Future) ===

async function checkLoungeAccessFromDB(userId: string, loungeId: string) {
    // 1. Fetch user's wallet from DB
    const userAssets = await prisma.userAsset.findMany({
        where: { userId, isActive: true }
    });

    // 2. Fetch lounge networks
    const lounge = await prisma.lounge.findUnique({
        where: { id: loungeId },
        select: { networks: true }
    });

    // 3. Fetch active rules from DB
    const dbRules = await prisma.loungeAccessRule.findMany({
        where: {
            isActive: true,
            network: { in: lounge?.networks }
        }
    });

    // 4. Convert DB rules to engine format
    const engineRules = dbRules.map(r => ({
        id: r.id,
        requiredAsset: r.requiredAsset,
        assetType: r.assetType,
        network: r.network,
        accessLevel: r.accessLevel,
        priority: r.priority,
        guestPolicy: {
            maxGuests: r.maxGuests,
            childFriendly: r.childFriendly,
            childAgeLimit: r.childAgeLimit,
            infantFree: r.infantFree
        }
    }));

    // 5. Get passenger info from trip
    const trip = await prisma.monitoredTrip.findFirst({
        where: { userId },
        include: { passengers: true }
    });

    const passengers = trip?.passengers.map(p => ({
        age: p.age,
        type: p.type
    })) || [];

    // 6. Evaluate
    return evaluateLoungeAccess(
        lounge?.networks || [],
        userAssets,
        engineRules,
        passengers
    );
}

export { checkLoungeAccessFromDB };
