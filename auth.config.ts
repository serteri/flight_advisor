import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";

export default {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
        MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_SECRET,
        }),
    ],
    pages: {
        signIn: '/login',
    }
} satisfies NextAuthConfig;
