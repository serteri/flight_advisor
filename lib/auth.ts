import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { prisma } from "@/lib/prisma"
import { PrismaAdapter } from "@auth/prisma-adapter"

import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { z } from "zod"

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
})

const cookieDomain =
    process.env.AUTH_COOKIE_DOMAIN ||
    (process.env.NODE_ENV === "production" ? ".flightagent.io" : undefined);

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
const trustHost =
    process.env.AUTH_TRUST_HOST === "true" ||
    process.env.AUTH_TRUST_HOSTS === "true";

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),
    secret: authSecret,
    trustHost,
    session: { strategy: "jwt" },
    cookies: {
        sessionToken: {
            name: `next-auth.session-token.1`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                domain: cookieDomain
            }
        }
    },
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            authorization: {
                params: {
                    prompt: "select_account",
                    access_type: "offline",
                    response_type: "code"
                }
            }
        }),
        // GitHub({
        //     clientId: process.env.AUTH_GITHUB_ID,
        //     clientSecret: process.env.AUTH_GITHUB_SECRET
        // }),
        // MicrosoftEntraID({
        //     clientId: process.env.AUTH_MICROSOFT_ENTRA_ID,
        //     clientSecret: process.env.AUTH_MICROSOFT_ENTRA_SECRET
        // }),
        Credentials({
            credentials: {
                email: {},
                password: {}
            },
            authorize: async (credentials) => {
                const validatedFields = LoginSchema.safeParse(credentials)

                if (validatedFields.success) {
                    const { email, password } = validatedFields.data
                    const user = await prisma.user.findUnique({
                        where: { email }
                    })

                    if (!user || !user.password) return null

                    const passwordsMatch = await bcrypt.compare(password, user.password)

                    if (passwordsMatch) {
                        // Return user with proper NextAuth User type
                        return {
                            id: user.id,
                            email: user.email,
                            name: user.name,
                            image: user.image,
                            subscriptionPlan: user.subscriptionPlan as 'FREE' | 'PRO' | 'ELITE' | undefined,
                            isPremium: user.isPremium
                        };
                    }
                }

                return null
            }
        })
    ],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
                
                // Force refresh premium status from database on every session
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.sub },
                        select: {
                            id: true,
                            email: true,
                            subscriptionPlan: true,
                            isPremium: true,
                            subscriptionStatus: true,
                            trialEndsAt: true,
                            stripeSubscriptionId: true,
                        },
                    });
                    
                    if (dbUser) {
                        // Update session with fresh DB data
                        (session.user as any).subscriptionPlan = dbUser.subscriptionPlan as 'FREE' | 'PRO' | 'ELITE' | undefined;
                        (session.user as any).isPremium = dbUser.isPremium;
                        (session.user as any).subscriptionStatus = dbUser.subscriptionStatus;
                        (session.user as any).trialEndsAt = dbUser.trialEndsAt;
                        
                        console.log('✅ [SESSION_REFRESH] User subscription data updated from DB', {
                            userId: token.sub,
                            plan: dbUser.subscriptionPlan,
                            isPremium: dbUser.isPremium,
                            hasSubscription: !!dbUser.stripeSubscriptionId,
                        });
                    }
                } catch (error: any) {
                    console.error('❌ [SESSION_REFRESH] Failed to fetch user from DB:', error.message);
                    // Continue with stale session data if DB fails
                }
            }
            return session;
        },
        jwt({ token, user }) {
            if (user) {
                token.sub = user.id
            }
            return token
        }
    }
})
