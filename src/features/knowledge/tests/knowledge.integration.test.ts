// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { KnowledgeRepository } from '@/features/knowledge/repositories/knowledge.repository';
import { KnowledgeService } from '@/features/knowledge/services/knowledge.service';
import {
  hybridSearch,
  insertChunks,
  claimNextJob,
} from '@/features/knowledge/lib/retrieval';
import { chunkText, checksum } from '@/features/knowledge/services/chunker';
import { embedLocal } from '@/lib/ai-gateway';

/**
 * Knowledge integration tests — real Postgres + pgvector.
 *
 * The non-negotiable: org A never sees org B rows in ANY read, including the raw
 * pgvector retrieval. Every org A test is mirrored with an org B counterexample.
 *
 * The ingestion pipeline is driven directly (claim → process → mark) — no worker
 * process, no timers — exactly as the worker's exported steps run it.
 */

type Fixture = {
  orgA: string;
  orgB: string;
  branchA: string;
  branchB: string;
  userA: string;
  userB: string;
};

let f: Fixture;
let suffix = 0;

async function makeUser(label: string): Promise<string> {
  suffix += 1;
  const user = await prisma.user.create({
    data: {
      name: `Knowledge ${label}`,
      email: `knowledge-${label}-${Date.now()}-${suffix}@test.local`,
      emailVerified: true,
    },
    select: { id: true },
  });
  return user.id;
}

async function makeOrg(orgLabel: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: orgLabel, slug: `${orgLabel}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(
  orgId: string,
  label: string,
  isDefault: boolean,
): Promise<string> {
  suffix += 1;
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault,
    },
    select: { id: true },
  });
  return branch.id;
}

function repoFor(orgId: string): KnowledgeRepository {
  return KnowledgeRepository.forOrganization(orgId);
}

/** Creates a source + document + version in org A and returns their ids. */
async function seedApprovedDoc(
  orgId: string,
  branchId: string,
  text: string,
  approverId: string,
): Promise<{ sourceId: string; documentId: string; versionId: string }> {
  const repo = repoFor(orgId);
  const source = await repo.createSource({ kind: 'faq', name: 'FAQ', branchId });
  const document = await repo.createDocument({
    sourceId: source.id,
    branchId,
    title: 'FAQ',
  });
  const version = await repo.createVersion({
    documentId: document.id,
    versionNumber: 1,
    extractedText: text,
  });

  const chunks = chunkText(text);
  const vector = chunks.map((c) => ({
    ordinal: c.ordinal,
    content: c.content,
    vector: embedLocal(c.content),
    model: 'local/hash',
  }));
  await insertChunks(
    { organizationId: orgId, branchId },
    { versionId: version.id, branchId, chunks: vector },
  );

  await repo.updateVersionChunks({
    versionId: version.id,
    chunkCount: chunks.length,
    checksum: checksum(text),
  });
  await repo.transitionVersionStatus({
    versionId: version.id,
    from: 'draft',
    to: 'pending_approval',
  });
  await repo.transitionVersionStatus({
    versionId: version.id,
    from: 'pending_approval',
    to: 'approved',
    approvedById: approverId,
    approvedAt: new Date(),
  });
  await repo.setCurrentVersion(document.id, version.id);

  return { sourceId: source.id, documentId: document.id, versionId: version.id };
}

describe('knowledge repository — sources and documents', () => {
  beforeEach(async () => {
    suffix += 1;
    f = {
      orgA: await makeOrg('Knowledge A'),
      orgB: await makeOrg('Knowledge B'),
      branchA: '',
      branchB: '',
      userA: await makeUser('A'),
      userB: await makeUser('B'),
    };
    f.branchA = await makeBranch(f.orgA, 'A Main', true);
    f.branchB = await makeBranch(f.orgB, 'B Main', true);
  });

  afterEach(async () => {
    // Children first, per org.
    for (const orgId of [f.orgA, f.orgB]) {
      await prisma.knowledgeChunk.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocumentVersion.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.ingestionJob.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocument.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeSource.deleteMany({ where: { organizationId: orgId } });
      await prisma.branch.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({
      where: { id: { in: [f.userA, f.userB] } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a source with a default branch', async () => {
    const source = await repoFor(f.orgA).createSource({
      kind: 'faq',
      name: 'My FAQ',
      branchId: f.branchA,
    });
    expect(source.id).toBeTruthy();
    expect(source.kind).toBe('faq');
    expect(source.documentCount).toBe(0);

    const listed = await repoFor(f.orgA).listSources();
    expect(listed.map((s) => s.id)).toContain(source.id);
  });

  it('org B cannot read or write org A sources', async () => {
    const source = await repoFor(f.orgA).createSource({
      kind: 'faq',
      name: 'A source',
      branchId: f.branchA,
    });

    // Cross-tenant read → 404 semantics.
    await expect(repoFor(f.orgB).getSource(source.id)).rejects.toThrow('not found');
    // Cross-tenant write → the scoped create fails because the source doesn't exist in B.
    await expect(
      repoFor(f.orgB).createDocument({
        sourceId: source.id,
        branchId: f.branchB,
        title: 'x',
      }),
    ).rejects.toThrow('not found');
  });

  it('creates a document + draft version', async () => {
    const repo = repoFor(f.orgA);
    const source = await repo.createSource({
      kind: 'pdf',
      name: 'Docs',
      branchId: f.branchA,
    });
    const document = await repo.createDocument({
      sourceId: source.id,
      branchId: f.branchA,
      title: 'Doc 1',
    });
    const version = await repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: 'hello',
    });

    expect(version.id).toBeTruthy();
    const detail = await repo.getDocument(document.id);
    expect(detail.title).toBe('Doc 1');
    expect(detail.versions[0]?.status).toBe('draft');
    expect(detail.versions[0]?.id).toBe(version.id);
  });

  it('version numbers increment', async () => {
    const repo = repoFor(f.orgA);
    const source = await repo.createSource({
      kind: 'faq',
      name: 'FAQ',
      branchId: f.branchA,
    });
    const document = await repo.createDocument({
      sourceId: source.id,
      branchId: f.branchA,
      title: 'FAQ',
    });
    await repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: 'v1',
    });

    expect(await repo.getNextVersionNumber(document.id)).toBe(2);
  });
});

describe('approval lifecycle (AD-4)', () => {
  beforeEach(async () => {
    suffix += 1;
    f = {
      orgA: await makeOrg('Approval A'),
      orgB: await makeOrg('Approval B'),
      branchA: '',
      branchB: '',
      userA: await makeUser('A'),
      userB: await makeUser('B'),
    };
    f.branchA = await makeBranch(f.orgA, 'A Main', true);
    f.branchB = await makeBranch(f.orgB, 'B Main', true);
  });

  afterEach(async () => {
    for (const orgId of [f.orgA, f.orgB]) {
      await prisma.knowledgeChunk.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocumentVersion.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.ingestionJob.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocument.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeSource.deleteMany({ where: { organizationId: orgId } });
      await prisma.branch.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [f.userA, f.userB] } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('submit → approve sets the current version (the retrieval gate)', async () => {
    const repo = repoFor(f.orgA);
    const source = await repo.createSource({
      kind: 'faq',
      name: 'FAQ',
      branchId: f.branchA,
    });
    const document = await repo.createDocument({
      sourceId: source.id,
      branchId: f.branchA,
      title: 'FAQ',
    });
    const version = await repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: 'text',
    });

    await repo.transitionVersionStatus({
      versionId: version.id,
      from: 'draft',
      to: 'pending_approval',
    });
    await repo.transitionVersionStatus({
      versionId: version.id,
      from: 'pending_approval',
      to: 'approved',
      approvedById: f.userA,
      approvedAt: new Date(),
    });
    await repo.setCurrentVersion(document.id, version.id);

    const detail = await repo.getDocument(document.id);
    expect(detail.currentVersionId).toBe(version.id);
    expect(detail.versions[0]?.status).toBe('approved');
    expect(detail.versions[0]?.approvedById).toBe(f.userA);
  });

  it('a version stays draft until submitted — currentVersionId stays null', async () => {
    const repo = repoFor(f.orgA);
    const source = await repo.createSource({
      kind: 'faq',
      name: 'FAQ',
      branchId: f.branchA,
    });
    const document = await repo.createDocument({
      sourceId: source.id,
      branchId: f.branchA,
      title: 'FAQ',
    });
    const version = await repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: 'text',
    });

    // Never submitted/approved.
    void version;
    const detail = await repo.getDocument(document.id);
    expect(detail.currentVersionId).toBeNull();
    expect(detail.versions[0]?.status).toBe('draft');
  });
});

describe('ingestion pipeline (AD-3)', () => {
  beforeEach(async () => {
    suffix += 1;
    f = {
      orgA: await makeOrg('Worker A'),
      orgB: await makeOrg('Worker B'),
      branchA: '',
      branchB: '',
      userA: await makeUser('A'),
      userB: await makeUser('B'),
    };
    f.branchA = await makeBranch(f.orgA, 'A Main', true);
    f.branchB = await makeBranch(f.orgB, 'B Main', true);
  });

  afterEach(async () => {
    for (const orgId of [f.orgA, f.orgB]) {
      await prisma.knowledgeChunk.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocumentVersion.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.ingestionJob.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocument.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeSource.deleteMany({ where: { organizationId: orgId } });
      await prisma.branch.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [f.userA, f.userB] } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("claimNextJob atomically claims only the caller tenant's queued job", async () => {
    const repo = repoFor(f.orgA);
    const source = await repo.createSource({
      kind: 'faq',
      name: 'FAQ',
      branchId: f.branchA,
    });
    const job = await repo.createJob({ sourceId: source.id });

    // Org B has no queued jobs.
    expect(await claimNextJob({ organizationId: f.orgB, branchId: null })).toBeNull();

    // Org A claims its own.
    const claimed = await claimNextJob({ organizationId: f.orgA, branchId: null });
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.sourceId).toBe(source.id);

    // Second claim returns null — already running (SKIP LOCKED semantics).
    expect(await claimNextJob({ organizationId: f.orgA, branchId: null })).toBeNull();
  });

  it('ingestVersion chunks + embeds and records the checksum', async () => {
    const repo = repoFor(f.orgA);
    const source = await repo.createSource({
      kind: 'faq',
      name: 'FAQ',
      branchId: f.branchA,
    });
    const document = await repo.createDocument({
      sourceId: source.id,
      branchId: f.branchA,
      title: 'FAQ',
    });
    const version = await repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: '',
    });

    const text = 'Northwind Dental opens at nine. '.repeat(60);
    const service = new KnowledgeService(repo);
    const { chunkCount } = await service.ingestVersion({
      documentId: document.id,
      versionId: version.id,
      branchId: f.branchA,
      extractedText: text,
    });

    expect(chunkCount).toBeGreaterThan(0);
    const detail = await repo.getDocument(document.id);
    const versionRow = detail.versions[0];
    expect(versionRow?.chunkCount).toBe(chunkCount);
    // The service checksums the TRIMMED text.
    expect(versionRow?.checksum).toBe(checksum(text.trim()));
  });

  it('processNextJob marks a failed job failed with an error', async () => {
    const { processNextJob } = await import('@/workflows/knowledge-ingestion.worker');
    const repo = repoFor(f.orgA);
    // An upload source whose document has NO file metadata → the worker cannot
    // read the blob → the job fails and the error is persisted.
    const source = await repo.createSource({
      kind: 'upload',
      name: 'Upload',
      branchId: f.branchA,
    });
    const document = await repo.createDocument({
      sourceId: source.id,
      branchId: f.branchA,
      title: 'Broken',
    });
    const version = await repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: '',
    });
    const job = await repo.createJob({
      sourceId: source.id,
      documentId: document.id,
      versionId: version.id,
    });

    const result = await processNextJob({ organizationId: f.orgA, branchId: null });
    expect(result?.jobId).toBe(job.id);
    expect(result?.status).toBe('failed');

    const stored = await repo.getJob(job.id);
    expect(stored.status).toBe('failed');
    expect(stored.error).toContain('missing file metadata');
  });
});

describe('retrieval (AD-6) — the non-negotiable isolation', () => {
  beforeEach(async () => {
    suffix += 1;
    f = {
      orgA: await makeOrg('Retrieval A'),
      orgB: await makeOrg('Retrieval B'),
      branchA: '',
      branchB: '',
      userA: await makeUser('A'),
      userB: await makeUser('B'),
    };
    f.branchA = await makeBranch(f.orgA, 'A Main', true);
    f.branchB = await makeBranch(f.orgB, 'B Main', true);
  });

  afterEach(async () => {
    for (const orgId of [f.orgA, f.orgB]) {
      await prisma.knowledgeChunk.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocumentVersion.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.ingestionJob.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeDocument.deleteMany({ where: { organizationId: orgId } });
      await prisma.knowledgeSource.deleteMany({ where: { organizationId: orgId } });
      await prisma.branch.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({ where: { id: { in: [f.userA, f.userB] } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('org A never retrieves org B chunks (similarity + keyword)', async () => {
    // Same body text in both orgs — a leak would return both.
    const bodyA =
      'The cancellation policy requires six hours notice for a free reschedule.';
    const bodyB =
      'The cancellation policy requires six hours notice for a free reschedule.';

    await seedApprovedDoc(f.orgA, f.branchA, bodyA, f.userA);
    await seedApprovedDoc(f.orgB, f.branchB, bodyB, f.userB);

    const scopeA = { organizationId: f.orgA, branchId: f.branchA };
    const scopeB = { organizationId: f.orgB, branchId: f.branchB };

    const queryVector = embedLocal('cancellation policy reschedule');
    const hitsA = await hybridSearch(scopeA, 'cancellation', queryVector, 10);
    expect(hitsA.length).toBeGreaterThan(0);
    for (const hit of hitsA) {
      expect(hit.documentTitle).toBe('FAQ');
    }

    // Keyword search — org B returns zero for a term only in A? No: same text,
    // so B should return its own. Assert B sees only B.
    const hitsB = await hybridSearch(scopeB, 'cancellation', queryVector, 10);
    expect(hitsB.length).toBeGreaterThan(0);
    // Both orgs' hits must not be mixed: A's hits all belong to A's document.
    // We verify by chunk id — org B's chunk ids differ from org A's.
    const chunkIdsB = new Set(hitsB.map((h) => h.chunkId));
    for (const hit of hitsA) {
      expect(chunkIdsB.has(hit.chunkId)).toBe(false);
    }
  });

  it('retrieval returns only APPROVED current versions — a draft never surfaces', async () => {
    const repo = repoFor(f.orgA);
    const source = await repo.createSource({
      kind: 'faq',
      name: 'FAQ',
      branchId: f.branchA,
    });
    const document = await repo.createDocument({
      sourceId: source.id,
      branchId: f.branchA,
      title: 'Draft-only',
    });
    const version = await repo.createVersion({
      documentId: document.id,
      versionNumber: 1,
      extractedText: '',
    });

    // Insert chunks but leave the version DRAFT (never approved, never current).
    const text = 'This secret policy should never be retrievable until approved.';
    const chunks = chunkText(text);
    await insertChunks(
      { organizationId: f.orgA, branchId: f.branchA },
      {
        versionId: version.id,
        branchId: f.branchA,
        chunks: chunks.map((c) => ({
          ordinal: c.ordinal,
          content: c.content,
          vector: embedLocal(c.content),
          model: 'local/hash',
        })),
      },
    );

    const hits = await hybridSearch(
      { organizationId: f.orgA, branchId: f.branchA },
      'secret policy',
      embedLocal('secret policy'),
      10,
    );
    expect(hits).toEqual([]);
  });

  it('keyword search finds approved content by substring', async () => {
    await seedApprovedDoc(
      f.orgA,
      f.branchA,
      'Free parking is available behind the building.',
      f.userA,
    );

    const hits = await hybridSearch(
      { organizationId: f.orgA, branchId: f.branchA },
      'parking',
      null,
      10,
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.content).toContain('parking');
  });

  it('org A search with an org B query returns nothing for B-only content', async () => {
    // Only B has this content.
    await seedApprovedDoc(
      f.orgB,
      f.branchB,
      'Beacon services diesel vehicles only.',
      f.userB,
    );

    const hits = await hybridSearch(
      { organizationId: f.orgA, branchId: f.branchA },
      'diesel',
      embedLocal('diesel'),
      10,
    );
    expect(hits).toEqual([]);
  });
});
