import { auth } from '@/auth';

export type UserTier = 'FREE' | 'PRO' | 'ELITE';

/**
 * Get user's subscription tier from session
 * Use this in Server Components
 */
export async function getUserTier(): Promise<UserTier> {
    const session = await auth();
    
    if (!session?.user) {
        return 'FREE';
    }
    
    const plan = session.user.subscriptionPlan?.toUpperCase();
    
    if (plan === 'PRO') return 'PRO';
    if (plan === 'ELITE') return 'ELITE';
    
    return 'FREE';
}

/**
 * Check if user has required tier or higher
 */
export async function hasRequiredTier(requiredTier: UserTier): Promise<boolean> {
    const userTier = await getUserTier();
    
    const tierHierarchy: Record<UserTier, number> = {
        FREE: 0,
        PRO: 1,
        ELITE: 2
    };
    
    return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
}

/**
 * Client-side tier check from session prop
 */
export function checkTierAccess(userTier: UserTier | undefined, requiredTier: UserTier): boolean {
    if (!userTier) return false;
    
    const tierHierarchy: Record<UserTier, number> = {
        FREE: 0,
        PRO: 1,
        ELITE: 2
    };
    
    return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
}

/**
 * Get user tier from session (client-side)
 */
export function getUserTierFromSession(session: any): UserTier {
    if (!session?.user) return 'FREE';
    
    const plan = session.user.subscriptionPlan?.toUpperCase();
    
    if (plan === 'PRO') return 'PRO';
    if (plan === 'ELITE') return 'ELITE';
    
    return 'FREE';
}
