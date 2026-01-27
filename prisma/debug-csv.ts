import csv from 'csvtojson';
import path from 'path';

async function main() {
    const csvPath = path.join(process.cwd(), 'airports', 'data', 'airports.csv');
    const records = await csv().fromFile(csvPath);

    console.log('Total records:', records.length);
    console.log('\nFirst 3 records with IATA:');

    const withIATA = records.filter((r: any) => r.iata && r.iata.trim().length > 0);
    console.log('Records with IATA:', withIATA.length);

    console.log('\nFirst record with IATA:');
    console.log(JSON.stringify(withIATA[0], null, 2));

    console.log('\nTypes distribution:');
    const types: Record<string, number> = {};
    records.forEach((r: any) => {
        const t = r.type || 'UNKNOWN';
        types[t] = (types[t] || 0) + 1;
    });
    console.log(types);
}

main();
