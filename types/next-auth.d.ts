import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
    interface User {
        id: string;
        subscriptionPlan?: 'FREE' | 'PRO' | 'ELITE';
        isPremium?: boolean; // Legacy field, being phased out
    }

    interface Session {
        user: {
            id: string;
            subscriptionPlan?: 'FREE' | 'PRO' | 'ELITE';
            isPremium?: boolean; // Legacy field
        } & DefaultSession['user'];
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        id: string;
        subscriptionPlan?: 'FREE' | 'PRO' | 'ELITE';
        isPremium?: boolean; // Legacy field
    }
}
