import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import SessionProvider from "@/components/SessionProvider";
import BuyNowVariantBootstrap from '@/components/experiment/BuyNowVariantBootstrap';
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import Footer from "@/components/Footer";
import "../globals.css";

const GA_ID = "G-04HJXKRJFE";

function assertRequiredRuntimeEnv() {
    const missing: string[] = [];

    if (!process.env.RESEND_API_KEY) {
        missing.push('RESEND_API_KEY');
    }

    if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
        missing.push('NEXTAUTH_SECRET (or AUTH_SECRET)');
    }

    if (missing.length > 0) {
        throw new Error(`[Startup Fail-Fast] Missing required runtime env vars: ${missing.join(', ')}`);
    }
}

assertRequiredRuntimeEnv();

export const metadata: Metadata = {
    title: {
        default: "FlightAgent — Flight Monitoring & EU261 Compensation",
        template: "%s | FlightAgent",
    },
    description: "Monitor your flights, get disruption alerts, and generate EU261 compensation claims automatically.",
};

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            {/* ── Google Analytics 4 + Consent Mode v2 ── */}
            {/* 1. Load the gtag.js library */}
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
            />
            {/* 2. Initialise dataLayer, set Consent Mode v2 defaults, then config.
                   analytics_storage starts as 'denied' — only upgraded after
                   explicit user consent via ConsentBannerWrapper. */}
            <Script id="gtag-init" strategy="afterInteractive">
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());

                  gtag('consent', 'default', {
                    analytics_storage:    'denied',
                    ad_storage:           'denied',
                    ad_user_data:         'denied',
                    ad_personalization:   'denied',
                    wait_for_update:      500,
                  });

                  gtag('config', '${GA_ID}');
                `}
            </Script>

            <body className="antialiased bg-[#fafafa] text-slate-900" suppressHydrationWarning>
                <SessionProvider>
                    <NextIntlClientProvider messages={messages}>
                        <BuyNowVariantBootstrap />
                        <div className="flex min-h-screen flex-col">
                            <div className="flex-1">{children}</div>
                            <Footer />
                        </div>
                    </NextIntlClientProvider>
                </SessionProvider>

                {/* Restores prior consent + shows banner for first-time visitors */}
                <AnalyticsProvider />
            </body>
        </html>
    );
}
