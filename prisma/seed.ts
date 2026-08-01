import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Database seed.
 *
 * Milestone 1 has one infrastructure table, so this seed is necessarily trivial.
 * The substantial seed — multiple tenants, every conversation state, realistic
 * message volume and timestamps, edge cases — is built in Milestone 4 alongside
 * the real schema, per .claude/DATABASE_RULES.md → Seed Data.
 *
 * Synthetic data only. Never a copy of production.
 */

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const existing = await prisma.healthCheck.count();

  if (existing === 0) {
    await prisma.healthCheck.create({ data: {} });
    console.log('Seeded: health_checks');
  } else {
    console.log(`Skipped: health_checks already has ${existing} row(s)`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
