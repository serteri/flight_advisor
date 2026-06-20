import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['en', 'tr', 'de'],

    // Used when no locale matches
    defaultLocale: 'en',

    // Hybrid routing: default locale (en) has no URL prefix,
    // non-default locales (tr, de) automatically keep their /tr, /de prefix.
    // (No custom `prefixes` map needed — that's only for renaming a
    // locale's prefix to something other than its own code.)
    localePrefix: 'as-needed',

    // Always serve the default locale at "/" instead of redirecting
    // based on the visitor's browser language
    localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter } =
    createNavigation(routing);
