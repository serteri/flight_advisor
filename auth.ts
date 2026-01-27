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
                // @ts-ignore
                session.user.isPremium = token.isPremium as boolean;
            }
            return session;
        },
        async jwt({ token }) {
            if (!token.sub) return token;

            // Fetch user to get isPremium status and add to token
            // This runs on the server (Node.js), so Prisma is safe here.
            const existingUser = await prisma.user.findUnique({
                where: { id: token.sub }
            });

            if (existingUser) {
                // @ts-ignore
                token.isPremium = existingUser.isPremium;
            }

            return token;
        }
    },
});
