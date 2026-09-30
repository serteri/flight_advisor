// lib/ops/dbTarget.ts
//
// Which database an ops script (backfill, schema checks) may touch.
//
//  - Default: DATABASE_URL from .env.local ONLY (a Neon branch). Never from
//    .env — that file holds the production URL. A production host is refused.
//  - Production: only with BOTH --database-url <url> on the command line and
//    the explicit --i-understand-this-is-prod flag. The flag with a non-prod
//    host is refused too, so a wrong URL can't slip through under the flag.
//
// scripts/with-db.sh applies the same rules for shell commands (prisma CLI).

export const PROD_DB_HOST_MARKER = 'ep-gentle-math';
export const PROD_CONFIRM_FLAG = '--i-understand-this-is-prod';
export const PROD_CONFIRM_DELAY_MS = 5000;

export type DbTarget =
    | { ok: true; url: string; host: string; isProd: boolean; source: 'cli' | '.env.local' }
    | { ok: false; reason: string };

export function hostOf(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        return new URL(url).hostname || null;
    } catch {
        return null;
    }
}

export function isProdHost(host: string): boolean {
    return host.includes(PROD_DB_HOST_MARKER);
}

/** Reads DATABASE_URL from the text of a .env.local file (BOM-safe). */
export function databaseUrlFromEnvFile(text: string | null): string | null {
    if (!text) return null;
    const match = text.replace(/^﻿/, '').match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]*)/m);
    return match?.[1]?.trim() || null;
}

export function resolveDbTarget(input: {
    cliUrl: string | null;
    prodConfirmed: boolean;
    envLocalText: string | null;
}): DbTarget {
    if (input.cliUrl) {
        const host = hostOf(input.cliUrl);
        if (!host) return { ok: false, reason: '--database-url is not a valid URL' };
        const prod = isProdHost(host);
        if (prod && !input.prodConfirmed) {
            return { ok: false, reason: `${host} is the production database; add ${PROD_CONFIRM_FLAG} to run against it` };
        }
        if (!prod && input.prodConfirmed) {
            return { ok: false, reason: `${PROD_CONFIRM_FLAG} was given but ${host} is not the production database` };
        }
        return { ok: true, url: input.cliUrl, host, isProd: prod, source: 'cli' };
    }

    if (input.prodConfirmed) {
        return { ok: false, reason: `${PROD_CONFIRM_FLAG} requires --database-url on the command line` };
    }

    const url = databaseUrlFromEnvFile(input.envLocalText);
    const host = hostOf(url);
    if (!url || !host) return { ok: false, reason: 'no valid DATABASE_URL in .env.local (.env is never used)' };
    if (isProdHost(host)) {
        return { ok: false, reason: `.env.local points at production (${host}); production is only allowed via --database-url + ${PROD_CONFIRM_FLAG}` };
    }
    return { ok: true, url, host, isProd: false, source: '.env.local' };
}

/** Splits the ops flags off argv; returns the remaining args. */
export function parseDbArgs(argv: string[]): { cliUrl: string | null; prodConfirmed: boolean; rest: string[] } {
    let cliUrl: string | null = null;
    let prodConfirmed = false;
    const rest: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === PROD_CONFIRM_FLAG) prodConfirmed = true;
        else if (arg === '--database-url') cliUrl = argv[++i] ?? null;
        else if (arg.startsWith('--database-url=')) cliUrl = arg.slice('--database-url='.length);
        else rest.push(arg);
    }
    return { cliUrl, prodConfirmed, rest };
}
