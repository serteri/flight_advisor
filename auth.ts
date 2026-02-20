import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" }, // Force JWT for Edge compatibility
    ...authConfig,
    callbacks: {
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                session.user.isPremium = token.isPremium as boolean;
                session.user.subscriptionPlan = token.subscriptionPlan as 'FREE' | 'PRO' | 'ELITE' | undefined;
            }
            return session;
        },
        async jwt({ token }) {
            if (!token.sub) return token;

            // Fetch user to get subscription status
            const existingUser = await prisma.user.findUnique({
                where: { id: token.sub }
            });

            if (existingUser) {
                token.isPremium = existingUser.isPremium;
                token.subscriptionPlan = existingUser.subscriptionPlan as 'FREE' | 'PRO' | 'ELITE' | undefined;
            }

            return token;
        }
    },
});
