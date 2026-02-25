import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { NextAuthConfig } from "next-auth";

const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        })
    );
}

if (process.env.AUTH_MICROSOFT_ENTRA_ID && process.env.AUTH_MICROSOFT_ENTRA_SECRET) {
    providers.push(
        MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_SECRET,
        })
    );
}

export default {
    providers,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    trustHost:
        process.env.AUTH_TRUST_HOST === "true" ||
        process.env.AUTH_TRUST_HOSTS === "true",
    pages: {
        signIn: '/login',
    }
} satisfies NextAuthConfig;
