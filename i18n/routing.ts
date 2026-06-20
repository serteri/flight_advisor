import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['en', 'tr', 'de'],

    // Used when no locale matches
    defaultLocale: 'en',

    // Hybrid routing: default locale (en) has no URL prefix,
    // non-default locales (tr, de) keep their /tr, /de prefix
    localePrefix: {
        mode: 'as-needed',
        prefixes: {
            tr: '/tr',
            de: '/de',
        },
    },

    // Always serve the default locale at "/" instead of redirecting
    // based on the visitor's browser language
    localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter } =
    createNavigation(routing);
