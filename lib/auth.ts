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

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),
    secret: process.env.AUTH_SECRET,
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
            allowDangerousEmailAccountLinking: true
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
        session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            return session
        },
        jwt({ token, user }) {
            if (user) {
                token.sub = user.id
            }
            return token
        }
    }
})
