import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { chunkText } from '@/features/knowledge/services/chunker';

/**
 * Milestone 7 E2E — the knowledge base against a production build.
 *
 * Each run creates its own user + org, seeds an APPROVED FAQ document with
 * chunks (via raw SQL — the vector column is Unsupported), and cleans up
 * afterwards. The approval gate is exercised: an unapproved document's content
 * never surfaces in search.
 */

const STRONG_PASSWORD = 'correct-horse-battery-staple';

function uniqueEmail(label: string): string {
  return `e2e-knowledge-${label}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`;
}

function audit(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}

type SeededOrg = {
  organizationId: string;
  branchId: string;
  sourceId: string;
  documentId: string;
};

/** The deterministic local hash embedder — same as src/lib/ai-gateway.ts. */
const DIMENSIONS = 1536;
function embedLocal(text: string): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as string;
    const gram = `${tokens[i - 1] ?? ''} ${token} ${tokens[i + 1] ?? ''}`;
    const digest = createHash('sha256').update(gram).digest();
    const bucket = digest.readUInt32BE(0) % DIMENSIONS;
    const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1;
    vector[bucket] = (vector[bucket] ?? 0) + sign;
  }
  return vector;
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

async function seedKnowledgeOrg(
  email: string,
  organizationId: string,
): Promise<SeededOrg> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for E2E seeding.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    const user = await client.user.findFirstOrThrow({ where: { email } });

    const branch = await client.branch.findFirstOrThrow({
      where: { organizationId, isDefault: true, deletedAt: null },
      select: { id: true },
    });

    const source = await client.knowledgeSource.create({
      data: {
        organizationId,
        branchId: branch.id,
        kind: 'faq',
        name: 'E2E FAQs',
      },
      select: { id: true },
    });

    const text = [
      'Q: What are your opening hours?\nA: We are open Saturday to Thursday, 9:00 to 21:00.',
      'Q: Is parking available?\nA: Free parking is available behind the building.',
    ].join('\n\n');

    const document = await client.knowledgeDocument.create({
      data: {
        organizationId,
        branchId: branch.id,
        sourceId: source.id,
        title: 'E2E opening hours FAQ',
      },
      select: { id: true },
    });

    const version = await client.knowledgeDocumentVersion.create({
      data: {
        organizationId,
        documentId: document.id,
        versionNumber: 1,
        status: 'approved',
        extractedText: text,
        chunkCount: 1,
        checksum: 'e2e-faq-v1',
        approvedById: user.id,
        approvedAt: new Date(),
      },
      select: { id: true },
    });

    await client.knowledgeDocument.update({
      data: { currentVersionId: version.id },
      where: { id: document.id },
    });

    // Insert chunks via raw SQL (embedding column is Unsupported).
    const chunks = chunkText(text);
    const values = chunks
      .map(
        (chunk, index) => Prisma.sql`(
          gen_random_uuid(),
          ${organizationId},
          ${branch.id},
          ${version.id},
          ${index + 1},
          ${chunk.content},
          ${toVectorLiteral(embedLocal(chunk.content))}::vector,
          'local/hash',
          1536,
          now(),
          now()
        )`,
      )
      .reduce((acc, value, i) => {
        if (i === 0) return value;
        return Prisma.sql`${acc}, ${value}`;
      });

    await client.$executeRaw(
      Prisma.sql`
        INSERT INTO knowledge_chunks
          (id, organization_id, branch_id, document_version_id, ordinal, content, embedding, embedding_model, dimensions, created_at, updated_at)
        VALUES ${values}
      `,
    );

    return {
      organizationId,
      branchId: branch.id,
      sourceId: source.id,
      documentId: document.id,
    };
  } finally {
    await client.$disconnect();
  }
}

async function cleanupOrg(seeded: SeededOrg): Promise<void> {
  const connectionString = process.env['DATABASE_URL'] ?? '';
  if (!connectionString) throw new Error('DATABASE_URL is required for cleanup.');
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });

  try {
    await client.knowledgeChunk.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.knowledgeDocumentVersion.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.ingestionJob.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.knowledgeDocument.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.knowledgeSource.deleteMany({
      where: { organizationId: seeded.organizationId },
    });
    await client.branch.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.member.deleteMany({ where: { organizationId: seeded.organizationId } });
    await client.organization.deleteMany({ where: { id: seeded.organizationId } });
  } finally {
    await client.$disconnect();
  }
}

async function openKnowledge(page: Page): Promise<SeededOrg> {
  const email = uniqueEmail('main');

  const signup = await page.request.post('/api/auth/sign-up/email', {
    data: { name: 'E2E Knowledge', email, password: STRONG_PASSWORD },
  });
  expect(signup.status()).toBe(200);

  const user = await prisma.user.findFirstOrThrow({ where: { email } });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(STRONG_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(/\/dashboard/);

  const orgResponse = await page.request.post('/api/organizations', {
    data: {
      name: `E2E Knowledge ${Date.now()} ${Math.floor(Math.random() * 10_000)}`,
    },
  });
  expect(orgResponse.status()).toBe(201);
  const orgPayload = (await orgResponse.json()) as { data?: { id?: string } };
  const organizationId = orgPayload.data?.id;
  if (!organizationId) throw new Error('Organization creation did not return an id.');

  const switchResponse = await page.request.patch('/api/organizations/active', {
    data: { organizationId },
  });
  expect(switchResponse.status()).toBe(200);

  const seeded = await seedKnowledgeOrg(email, organizationId);

  await page.goto('/knowledge');
  await expect(page.getByRole('heading', { name: 'Knowledge base' })).toBeVisible();

  return seeded;
}

test.describe('knowledge base', () => {
  test('renders sources and documents from real seeded data', async ({ page }) => {
    const seeded = await openKnowledge(page);

    try {
      await expect(page.getByText('E2E FAQs')).toBeVisible();
      await page.getByText('E2E FAQs').click();
      await expect(page.getByText('E2E opening hours FAQ')).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('search returns only approved content', async ({ page }) => {
    const seeded = await openKnowledge(page);

    try {
      await page.getByRole('tab', { name: 'Search' }).click();
      await page.getByLabel('Search the knowledge base').fill('parking');
      await page.keyboard.press('Enter');

      await expect(page.getByText('E2E opening hours FAQ')).toBeVisible();
      await expect(page.getByText(/Free parking/)).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('an FAQ is not searchable until approved (the approval gate)', async ({
    page,
  }) => {
    // The FAQ ingest, search (live embedding + pgvector), and submit/approve
    // round-trips compound under parallel load; the other knowledge tests use
    // the same ceiling (see the axe test below).
    test.setTimeout(120_000);
    const seeded = await openKnowledge(page);

    try {
      // Create an FAQ — it ingests synchronously but stays DRAFT, so it must
      // NOT be retrievable until an admin approves it.
      await page.getByRole('button', { name: 'Add source' }).click();
      await page.getByRole('tab', { name: 'FAQ' }).click();
      await page.getByLabel('Source name').fill('New FAQ');
      await page.getByLabel('Question').fill('Do you take walk-ins?');
      await page.getByLabel('Answer').fill('Yes, when a clinician has a gap.');
      await page.getByRole('button', { name: 'Add FAQ' }).click();

      await expect(page.getByText('New FAQ')).toBeVisible();

      // Draft gate: search does not find it yet.
      await page.getByRole('tab', { name: 'Search' }).click();
      await page.getByLabel('Search the knowledge base').fill('walk-ins');
      await page.keyboard.press('Enter');
      await expect(page.getByText(/walk-ins/)).not.toBeVisible();

      // Approve it: source → document → submit → approve.
      await page.getByRole('tab', { name: 'Sources' }).click();
      await page.getByText('New FAQ').click();
      await page.getByText('New FAQ', { exact: true }).first().click();
      await page.getByRole('button', { name: 'Submit' }).click();
      await expect(page.getByText('Pending approval')).toBeVisible();
      await page.getByRole('button', { name: 'Approve' }).click();
      await expect(page.getByText('Approved', { exact: true })).toBeVisible();

      // Now it is retrievable.
      await page.goto('/knowledge');
      await page.getByRole('tab', { name: 'Search' }).click();
      await page.getByLabel('Search the knowledge base').fill('walk-ins');
      await page.keyboard.press('Enter');
      await expect(page.getByText(/walk-ins/)).toBeVisible();
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('has no accessibility violations on the knowledge pages', async ({ page }) => {
    test.setTimeout(120_000);
    const seeded = await openKnowledge(page);

    try {
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript((value) => {
          window.localStorage.setItem('theme', value);
        }, theme);

        const results = await audit(page);
        expect(results.violations, `${theme} theme`).toEqual([]);

        await page.addInitScript(() => {
          document.documentElement.dir = 'rtl';
        });
        const rtlResults = await audit(page);
        expect(rtlResults.violations, `${theme} theme, RTL`).toEqual([]);
      }

      // Search tab too.
      await page.getByRole('tab', { name: 'Search' }).click();
      const searchResults = await audit(page);
      expect(searchResults.violations).toEqual([]);
    } finally {
      await cleanupOrg(seeded);
    }
  });

  test('no horizontal overflow on mobile', async ({ page }) => {
    test.setTimeout(120_000);
    const seeded = await openKnowledge(page);

    try {
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByText('E2E FAQs')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    } finally {
      await cleanupOrg(seeded);
    }
  });
});
