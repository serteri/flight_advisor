import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    ...authConfig,
    callbacks: {
        async session({ session, token }) {
            try {
                if (session.user && token.sub) {
                    session.user.id = token.sub;
                    session.user.isPremium = (token.isPremium as boolean) || false;
                    session.user.subscriptionPlan = (token.subscriptionPlan as 'FREE' | 'PRO' | 'ELITE' | undefined) || 'FREE';
                }
                return session;
            } catch (error) {
                console.error('[AUTH SESSION ERROR]', error);
                // Return session with defaults on error
                if (session.user) {
                    session.user.isPremium = false;
                    session.user.subscriptionPlan = 'FREE';
                }
                return session;
            }
        },
        async jwt({ token }) {
            try {
                if (!token.sub) {
                    // No user ID - return token with defaults
                    return {
                        ...token,
                        isPremium: false,
                        subscriptionPlan: 'FREE'
                    };
                }

                // Fetch user to get subscription status
                // This may fail if: DB was reset, user was deleted, or schema changed
                // In any case, we return a valid token with defaults
                const existingUser = await prisma.user.findUnique({
                    where: { id: token.sub }
                });

                // User exists in DB - use their settings
                if (existingUser) {
                    return {
                        ...token,
                        isPremium: existingUser.isPremium,
                        subscriptionPlan: existingUser.subscriptionPlan as 'FREE' | 'PRO' | 'ELITE' | undefined
                    };
                }

                // User doesn't exist in DB (e.g., DB was reset)
                // Return token with defaults - still valid for logout
                return {
                    ...token,
                    isPremium: false,
                    subscriptionPlan: 'FREE'
                };
            } catch (error) {
                console.error('[AUTH JWT ERROR] Failed to fetch user subscription status, returning defaults', error);
                // Always return a valid token, even if DB lookup fails
                // This ensures logout and other operations still work after DB reset
                return {
                    ...token,
                    isPremium: false,
                    subscriptionPlan: 'FREE'
                };
            }
        }
    },
});
