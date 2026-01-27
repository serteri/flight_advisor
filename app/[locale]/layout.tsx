import type { Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import SessionProvider from "@/components/SessionProvider";
import "../globals.css";

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
            <body className="antialiased bg-slate-50 text-slate-900" suppressHydrationWarning>
                <SessionProvider>
                    <NextIntlClientProvider messages={messages}>
                        {children}
                    </NextIntlClientProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
