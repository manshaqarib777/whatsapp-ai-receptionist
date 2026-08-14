import { createHash } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

import { SEED_NOW, seedId } from './support';
import type { SeededTenants } from './tenants';
import { chunkText } from '@/features/knowledge/services/chunker';

/**
 * Knowledge base seed (Milestone 7).
 *
 * Deterministic: fixed sources, documents, versions, and chunks. Every chunk is
 * embedded with the local hash embedder (no API key) and inserted via raw SQL —
 * `knowledge_chunks.embedding` is `Unsupported`, so Prisma cannot write it.
 *
 * The approval gate is exercised: one document has an APPROVED current version
 * (retrievable), one has a DRAFT version (not retrievable), so search demos the
 * "unapproved can never be cited" rule against real data.
 */

export type SeededKnowledge = Awaited<ReturnType<typeof seedKnowledge>>;

/** Chunks are embedded with the local provider in the seed — no key needed. */
const EMBEDDING_MODEL = 'local/hash';
const LOCAL_DIMENSIONS = 1536;

/** The same deterministic hash embedder as src/lib/ai-gateway.ts, inlined so the
 *  seed never depends on app env validation (AUTH_SECRET etc.). */
function embedLocal(text: string): number[] {
  const vector = new Array<number>(LOCAL_DIMENSIONS).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as string;
    const gram = `${tokens[i - 1] ?? ''} ${token} ${tokens[i + 1] ?? ''}`;
    const digest = createHash('sha256').update(gram).digest();
    const bucket = digest.readUInt32BE(0) % LOCAL_DIMENSIONS;
    const sign = (digest[4] ?? 0) % 2 === 0 ? 1 : -1;
    vector[bucket] = (vector[bucket] ?? 0) + sign;
  }

  return vector;
}

export async function seedKnowledge(
  prisma: PrismaClient,
  tenants: SeededTenants,
): Promise<{ sourceIds: string[]; documentIds: string[] }> {
  const sourceIds: string[] = [];
  const documentIds: string[] = [];

  // --- Northwind: an approved FAQ + an approved policy document + a draft ----
  const faqSource = await prisma.knowledgeSource.create({
    data: {
      id: seedId('kb-source', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      kind: 'faq',
      name: 'Common questions',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  sourceIds.push(faqSource.id);

  const faqDoc = await prisma.knowledgeDocument.create({
    data: {
      id: seedId('kb-doc', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      sourceId: faqSource.id,
      title: 'Common questions',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  documentIds.push(faqDoc.id);

  const faqText = [
    'Q: What are your opening hours?\nA: We are open Saturday to Thursday, 9:00 to 21:00. Friday we open at 14:00 for afternoon appointments.',
    'Q: Where are you located?\nA: Our main clinic is on Olaya Street, Riyadh, and we have a second branch on the Corniche in Jeddah.',
    'Q: Do I need a referral?\nA: No, you can book directly. A referral is only needed for some insurance plans — check with your provider.',
    'Q: Do you take walk-ins?\nA: We take walk-ins when a clinician has a gap, but weekends fill up quickly — booking ahead is strongly recommended.',
  ].join('\n\n');

  const faqVersion = await prisma.knowledgeDocumentVersion.create({
    data: {
      id: seedId('kb-version', 1),
      organizationId: tenants.northwind.id,
      documentId: faqDoc.id,
      versionNumber: 1,
      status: 'approved',
      extractedText: faqText,
      chunkCount: 1,
      checksum: 'seed-faq-v1',
      approvedById: tenants.staff.admin,
      approvedAt: SEED_NOW,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await prisma.knowledgeDocument.update({
    data: { currentVersionId: faqVersion.id },
    where: { id: faqDoc.id },
  });

  await insertChunks(prisma, {
    versionId: faqVersion.id,
    organizationId: tenants.northwind.id,
    branchId: tenants.northwind.riyadh,
    text: faqText,
    startOrdinal: 0,
    seedNamespace: 'kb-chunk-faq',
  });

  // --- Approved policy document (retrievable) ------------------------------
  const policySource = await prisma.knowledgeSource.create({
    data: {
      id: seedId('kb-source', 2),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      kind: 'pdf',
      name: 'Clinic policies',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  sourceIds.push(policySource.id);

  const policyDoc = await prisma.knowledgeDocument.create({
    data: {
      id: seedId('kb-doc', 2),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      sourceId: policySource.id,
      title: 'Cancellation and refund policy',
      fileName: 'cancellation-policy.pdf',
      mimeType: 'application/pdf',
      sizeBytes: BigInt(48_210),
      storageKey: 'seed/knowledge/cancellation-policy.pdf',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  documentIds.push(policyDoc.id);

  const policyText = [
    'Cancellation policy. Appointments can be rescheduled or cancelled free of charge up to 6 hours before the start time.',
    'Late cancellations, within 6 hours of the appointment, incur a fee of 100 SAR per clinician booked.',
    'No-shows are charged the full treatment price, because the clinician reserved that time for you and cannot fill it at short notice.',
    'Refunds for prepaid packages are processed within 7 working days, minus the value of any sessions already used.',
    'If the clinic cancels your appointment, you are never charged, and we offer priority rebooking at no cost.',
  ].join('\n\n');

  const policyVersion = await prisma.knowledgeDocumentVersion.create({
    data: {
      id: seedId('kb-version', 2),
      organizationId: tenants.northwind.id,
      documentId: policyDoc.id,
      versionNumber: 1,
      status: 'approved',
      extractedText: policyText,
      chunkCount: 1,
      checksum: 'seed-policy-v1',
      approvedById: tenants.staff.admin,
      approvedAt: SEED_NOW,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await prisma.knowledgeDocument.update({
    data: { currentVersionId: policyVersion.id },
    where: { id: policyDoc.id },
  });

  await insertChunks(prisma, {
    versionId: policyVersion.id,
    organizationId: tenants.northwind.id,
    branchId: tenants.northwind.riyadh,
    text: policyText,
    startOrdinal: 0,
    seedNamespace: 'kb-chunk-policy',
  });

  // --- Draft-only document (NOT retrievable) -------------------------------
  const draftSource = await prisma.knowledgeSource.create({
    data: {
      id: seedId('kb-source', 3),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      kind: 'docx',
      name: 'HR handbook (draft)',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  sourceIds.push(draftSource.id);

  const draftDoc = await prisma.knowledgeDocument.create({
    data: {
      id: seedId('kb-doc', 3),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      sourceId: draftSource.id,
      title: 'New hire handbook (draft)',
      fileName: 'new-hire-handbook.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: BigInt(120_400),
      storageKey: 'seed/knowledge/new-hire-handbook.docx',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  documentIds.push(draftDoc.id);

  // Draft version with chunks but no approval — retrieval must NOT see it.
  const draftText = [
    'New hire handbook. Welcome to Northwind Dental. This document is a draft and has not been approved.',
    'Probation is three months. Annual leave accrues at 30 days per year and must be booked through the clinic manager.',
    'Uniforms are provided. PPE is mandatory in all clinical areas and is restocked at the supply room.',
  ].join('\n\n');

  await prisma.knowledgeDocumentVersion.create({
    data: {
      id: seedId('kb-version', 3),
      organizationId: tenants.northwind.id,
      documentId: draftDoc.id,
      versionNumber: 1,
      status: 'draft',
      extractedText: draftText,
      chunkCount: 1,
      checksum: 'seed-hr-draft-v1',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await insertChunks(prisma, {
    versionId: seedId('kb-version', 3),
    organizationId: tenants.northwind.id,
    branchId: tenants.northwind.riyadh,
    text: draftText,
    startOrdinal: 0,
    seedNamespace: 'kb-chunk-hr',
  });

  // --- Tenant 2: so a leak has something to leak ---------------------------
  const beaconSource = await prisma.knowledgeSource.create({
    data: {
      id: seedId('kb-source', 10),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      kind: 'faq',
      name: 'Beacon FAQs',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  sourceIds.push(beaconSource.id);

  const beaconDoc = await prisma.knowledgeDocument.create({
    data: {
      id: seedId('kb-doc', 10),
      organizationId: tenants.beacon.id,
      branchId: tenants.beacon.main,
      sourceId: beaconSource.id,
      title: 'Beacon common questions',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  documentIds.push(beaconDoc.id);

  const beaconText = [
    'Q: Do you service diesel vehicles?\nA: Yes, we service both petrol and diesel.',
    'Q: What is your warranty?\nA: 12 months on parts and labour for all work over 500 SAR.',
  ].join('\n\n');

  const beaconVersion = await prisma.knowledgeDocumentVersion.create({
    data: {
      id: seedId('kb-version', 10),
      organizationId: tenants.beacon.id,
      documentId: beaconDoc.id,
      versionNumber: 1,
      status: 'approved',
      extractedText: beaconText,
      chunkCount: 1,
      checksum: 'seed-beacon-v1',
      approvedById: tenants.consultant,
      approvedAt: SEED_NOW,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });

  await prisma.knowledgeDocument.update({
    data: { currentVersionId: beaconVersion.id },
    where: { id: beaconDoc.id },
  });

  await insertChunks(prisma, {
    versionId: beaconVersion.id,
    organizationId: tenants.beacon.id,
    branchId: tenants.beacon.main,
    text: beaconText,
    startOrdinal: 0,
    seedNamespace: 'kb-chunk-beacon',
  });

  return { sourceIds, documentIds };
}

/** pgvector literal: `[1,0,-1]` — square brackets, unquoted numbers. */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}

/** Chunks + embeds text via raw SQL (the vector column is Unsupported). */
async function insertChunks(
  prisma: PrismaClient,
  input: {
    versionId: string;
    organizationId: string;
    branchId: string;
    text: string;
    startOrdinal: number;
    seedNamespace: string;
  },
): Promise<void> {
  const chunks = chunkText(input.text);
  if (chunks.length === 0) return;

  const values = chunks
    .map((chunk, index) => {
      const vector = embedLocal(chunk.content);
      return Prisma.sql`(
        ${seedId(`${input.seedNamespace}`, index + 1)},
        ${input.organizationId},
        ${input.branchId},
        ${input.versionId},
        ${input.startOrdinal + index + 1},
        ${chunk.content},
        ${toVectorLiteral(vector)}::vector,
        ${EMBEDDING_MODEL},
        1536,
        ${SEED_NOW},
        ${SEED_NOW}
      )`;
    })
    .reduce((acc, value, index) => {
      if (index === 0) return value;
      return Prisma.sql`${acc}, ${value}`;
    });

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO knowledge_chunks
        (id, organization_id, branch_id, document_version_id, ordinal, content, embedding, embedding_model, dimensions, created_at, updated_at)
      VALUES ${values}
    `,
  );
}
