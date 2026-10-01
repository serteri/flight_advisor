import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The prod schema is applied in two files (enum first, alone). Together they
// must be exactly docs/phase1_schema.sql — the SQL that matched the branch diff.
const statements = (file: string) => readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n').filter((l) => !l.startsWith('--')).join('\n')
    .split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

test('split schema files equal the diffed SQL, enum statement alone and first', () => {
    const original = statements('docs/phase1_schema.sql');
    const part1 = statements('docs/phase1_schema_1_enum.sql');
    const part2 = statements('docs/phase1_schema_2_rest.sql');
    assert.deepEqual([...part1, ...part2], original);
    assert.equal(part1.length, 1);
    assert.match(part1[0], /^ALTER TYPE "TripStatus" ADD VALUE 'PENDING_CONFIRMATION'$/);
    assert.ok(part2.every((s) => !/ALTER TYPE/.test(s)));
    assert.ok([...part1, ...part2].every((s) => !/\bDROP\b/i.test(s)), 'no DROP');
});
