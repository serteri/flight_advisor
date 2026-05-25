import type { Metadata } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import SessionProvider from "@/components/SessionProvider";
import BuyNowVariantBootstrap from '@/components/experiment/BuyNowVariantBootstrap';
import { ConsentBannerWrapper } from "@/components/analytics/ConsentBannerWrapper";
import "../globals.css";

const GA_ID = "G-04HJXKRJFE";

export const metadata: Metadata = {
    title: "Flight Advisor",
    description: "Personal Flight Price Advisor",
};

export default async function RootLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
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
                        {children}
                    </NextIntlClientProvider>
                </SessionProvider>

                {/* Restores prior consent + shows banner for new visitors */}
                <ConsentBannerWrapper />
            </body>
        </html>
    );
}
