// scripts/with-db.ts
//
// Runs a command with DATABASE_URL (and DIRECT_URL) set from the rules in
// lib/ops/dbTarget.ts — for commands like the Prisma CLI, which otherwise read
// .env (the production URL).
//
//   npx tsx scripts/with-db.ts -- npx prisma migrate diff --from-url "$DATABASE_URL" ...
//       → DATABASE_URL from .env.local only; a production host is refused.
//   npx tsx scripts/with-db.ts --database-url '<prod url>' --i-understand-this-is-prod -- <command>
//       → production, one-off: prints the host and waits 5 seconds first.
//
// Use $DATABASE_URL inside the command via `bash -c '…'` so the shell expands it
// in the child, where it is set.

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PROD_CONFIRM_DELAY_MS, parseDbArgs, resolveDbTarget } from '@/lib/ops/dbTarget';

async function main() {
    const argv = process.argv.slice(2);
    const sep = argv.indexOf('--');
    if (sep === -1 || sep === argv.length - 1) {
        console.error('Usage: npx tsx scripts/with-db.ts [--database-url <url> --i-understand-this-is-prod] -- <command...>');
        process.exit(1);
    }
    const { cliUrl, prodConfirmed, rest } = parseDbArgs(argv.slice(0, sep));
    if (rest.length) {
        console.error(`Unknown argument(s) before --: ${rest.join(', ')}`);
        process.exit(1);
    }

    let envLocalText: string | null = null;
    try { envLocalText = readFileSync('.env.local', 'utf8'); } catch { /* none */ }

    const target = resolveDbTarget({ cliUrl, prodConfirmed, envLocalText });
    if (!target.ok) {
        console.error(`REFUSED: ${target.reason}`);
        process.exit(3);
    }

    console.error(`[with-db] DATABASE_URL host: ${target.host} (source: ${target.source}${target.isProd ? ', PRODUCTION' : ''})`);
    if (target.isProd) {
        console.error(`[with-db] PRODUCTION database. Running in ${PROD_CONFIRM_DELAY_MS / 1000}s — Ctrl+C to abort.`);
        await new Promise((resolve) => setTimeout(resolve, PROD_CONFIRM_DELAY_MS));
    }

    const [cmd, ...args] = argv.slice(sep + 1);
    const env = { ...process.env, DATABASE_URL: target.url, DIRECT_URL: target.url };
    // Windows needs a shell to run npx/*.cmd; quote each argument so values with
    // spaces or quotes survive (cmd.exe splits unquoted args).
    const child = process.platform === 'win32'
        ? spawn([cmd, ...args].map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' '), { stdio: 'inherit', shell: true, env })
        : spawn(cmd, args, { stdio: 'inherit', env });
    child.on('exit', (code) => process.exit(code ?? 1));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
