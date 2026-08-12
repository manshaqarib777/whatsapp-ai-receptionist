/**
 * Schema-drift guard — Milestone 4, Issue 8.
 *
 * Prisma cannot express an HNSW index, so `prisma migrate diff` proposes dropping
 * `idx_knowledge_chunks_embedding_hnsw` on every run against a correctly migrated
 * database. That makes the diff useless as a review gate: an unreviewed generated
 * migration could silently delete the vector index and nothing would call it out.
 *
 * This script runs the diff and fails the build unless the ONLY drift is the known
 * HNSW drop. Any other drift — a table, column, or index the migrations and the
 * datamodel disagree on — is a real problem and stops CI.
 *
 * Usage: npm run db:check-drift
 */
import { execFileSync } from 'node:child_process';

const EXPECTED_DRIFT = 'DROP INDEX "idx_knowledge_chunks_embedding_hnsw";';

let diff: string;
try {
  diff = execFileSync(
    'npx',
    [
      'prisma',
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
} catch (error) {
  const stderr = (error as { stderr?: Buffer | string }).stderr?.toString() ?? '';
  console.error(`prisma migrate diff failed:\n${stderr}`);
  process.exit(1);
}

if (diff === '') {
  console.log('No schema drift.');
  process.exit(0);
}

// `--script` still prints a human-readable header (e.g. "-- DropIndex") above the
// SQL, so compare the statements only.
const statements = diff
  .split('\n')
  .filter((line) => !line.startsWith('--'))
  .join('\n')
  .trim();

if (statements === EXPECTED_DRIFT) {
  console.log(
    'Only known drift present: the HNSW index (Prisma cannot express it — Issue 8). OK.',
  );
  process.exit(0);
}

console.error(
  `Unexpected schema drift between migrations and prisma/schema.prisma:\n\n${diff}\n\n` +
    'If you intended this change, add a migration and update docs/database/schema-change.md. ' +
    'If the diff contains DROP INDEX "idx_knowledge_chunks_embedding_hnsw" alongside real changes, ' +
    'the HNSW index must be recreated by hand in the same migration (see docs/database/schema-change.md, Issue 8).',
);
process.exit(1);
