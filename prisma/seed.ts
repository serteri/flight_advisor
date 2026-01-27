import path from 'path';
import { pathToFileURL } from 'url';

async function main() {
    console.log('🚀 Starting seed process...');
    console.log('🔄 Delegating to scripts/import-airports.ts...');

    // Import the script dynamically
    const scriptPath = path.join(process.cwd(), 'scripts', 'import-airports.ts');

    // We use dynamic import for the TS file (tsx handles this)
    // Note: Since we are running with tsx, this works.
    await import(pathToFileURL(scriptPath).href);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
