import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

/**
 * Prisma CLI configuration (Prisma 7+).
 *
 * The connection URL lives here rather than in schema.prisma, which no longer
 * supports `url`. This file is used by the CLI (migrate, studio) only — the
 * application obtains its client from src/lib/prisma.ts via a driver adapter.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
