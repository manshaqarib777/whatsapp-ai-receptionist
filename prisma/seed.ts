import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { seedCommerce } from './seed/commerce';
import { seedContacts } from './seed/contacts';
import { seedCrm } from './seed/crm';
import { seedAi } from './seed/ai';
import { seedAdmin } from './seed/admin';
import { seedBroadcast } from './seed/broadcast';
import { seedInbox } from './seed/inbox';
import { seedIntegrations } from './seed/integrations';
import { seedKnowledge } from './seed/knowledge';
import { seedLoyalty } from './seed/loyalty';
import { seedPrivacy } from './seed/privacy';
import { seedReviews } from './seed/reviews';
import { seedScheduling } from './seed/scheduling';
import { seedTenants } from './seed/tenants';
import { seedWorkflows } from './seed/workflows';
import { createRandom, seedId } from './seed/support';

/**
 * Database seed — Milestone 4.
 *
 * DATABASE_RULES.md → Seed Data: "A seed of `user1 / test test` does not satisfy it.
 * `prisma/seed.ts` must produce a database someone can demo from."
 *
 * Everything is deterministic: a fixed PRNG seed, a fixed `SEED_NOW`, and derived
 * UUIDs. Two runs produce byte-identical data, which is what lets E2E tests deep-link
 * to a known conversation and lets screenshot diffs mean something.
 *
 * Synthetic throughout. No real phone numbers (the +9665000 0xxxx block is not
 * allocated), no real names, no real customer text, and no credential-shaped strings.
 */

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** The two organizations this seed owns. Nothing outside them is ever touched. */
const SEEDED_ORG_IDS = [seedId('org', 1), seedId('org', 2)];

/**
 * Children first. A blanket TRUNCATE would be simpler and is what most seeds do, but
 * it would also destroy anything a developer created by hand while working — so this
 * deletes only rows belonging to the organizations the seed itself created.
 */
async function clearSeededData() {
  const org = { organizationId: { in: SEEDED_ORG_IDS } };

  await prisma.subscription.deleteMany({ where: org });
  await prisma.plan.deleteMany({
    where: { id: { in: [seedId('plan', 1), seedId('plan', 2), seedId('plan', 3)] } },
  });

  await prisma.integrationConnection.deleteMany({ where: org });
  await prisma.privacyRequest.deleteMany({ where: org });
  await prisma.transcription.deleteMany({ where: org });

  await prisma.paymentEvent.deleteMany({ where: org });
  await prisma.refund.deleteMany({ where: org });
  await prisma.payment.deleteMany({ where: org });
  await prisma.invoiceLineItem.deleteMany({ where: org });
  await prisma.invoice.deleteMany({ where: org });
  await prisma.quoteVersion.deleteMany({ where: org });
  await prisma.quoteLineItem.deleteMany({ where: org });
  await prisma.quote.deleteMany({ where: org });
  await prisma.quoteTemplate.deleteMany({ where: org });

  await prisma.campaignRecipient.deleteMany({ where: org });
  await prisma.campaign.deleteMany({ where: org });
  await prisma.whatsappMessageTemplate.deleteMany({ where: org });
  await prisma.segment.deleteMany({ where: org });

  await prisma.workflowRunStep.deleteMany({ where: org });
  await prisma.workflowRun.deleteMany({ where: org });
  await prisma.workflowVersion.deleteMany({ where: org });
  await prisma.workflow.deleteMany({ where: org });

  await prisma.review.deleteMany({ where: org });
  await prisma.reviewRequest.deleteMany({ where: org });
  await prisma.reviewPlatform.deleteMany({ where: org });

  await prisma.loyaltyTransaction.deleteMany({ where: org });
  await prisma.loyaltyAccount.deleteMany({ where: org });
  await prisma.loyaltyProgram.deleteMany({ where: org });
  await prisma.couponRedemption.deleteMany({ where: org });
  await prisma.coupon.deleteMany({ where: org });
  await prisma.referral.deleteMany({ where: org });

  await prisma.activity.deleteMany({ where: org });
  await prisma.taggable.deleteMany({ where: org });
  await prisma.tag.deleteMany({ where: org });
  await prisma.deal.deleteMany({ where: org });
  await prisma.pipelineStage.deleteMany({ where: org });
  await prisma.pipeline.deleteMany({ where: org });
  await prisma.task.deleteMany({ where: org });
  await prisma.notification.deleteMany({ where: org });

  await prisma.appointmentReminder.deleteMany({ where: org });
  await prisma.appointment.deleteMany({ where: org });
  await prisma.availabilityException.deleteMany({ where: org });
  await prisma.availabilityRule.deleteMany({ where: org });
  await prisma.resource.deleteMany({ where: org });
  await prisma.service.deleteMany({ where: org });

  await prisma.aiRunCitation.deleteMany({ where: org });
  await prisma.aiRun.deleteMany({ where: org });
  await prisma.aiAgent.deleteMany({ where: org });
  await prisma.promptTemplateVersion.deleteMany({ where: org });
  await prisma.promptTemplate.deleteMany({ where: org });

  await prisma.knowledgeChunk.deleteMany({ where: org });
  await prisma.knowledgeDocumentVersion.deleteMany({ where: org });
  await prisma.knowledgeDocument.deleteMany({ where: org });
  await prisma.ingestionJob.deleteMany({ where: org });
  await prisma.knowledgeSource.deleteMany({ where: org });

  await prisma.conversationNote.deleteMany({ where: org });
  await prisma.conversationLabel.deleteMany({ where: org });
  await prisma.label.deleteMany({ where: org });
  await prisma.messageAttachment.deleteMany({ where: org });
  await prisma.message.deleteMany({ where: org });
  await prisma.conversation.deleteMany({ where: org });
  await prisma.whatsappAccount.deleteMany({ where: org });

  await prisma.contact.deleteMany({ where: org });
  await prisma.company.deleteMany({ where: org });
  await prisma.branch.deleteMany({ where: org });

  await prisma.auditLog.deleteMany({ where: org });
  await prisma.invitation.deleteMany({ where: org });
  await prisma.member.deleteMany({ where: org });
  await prisma.organization.deleteMany({ where: { id: { in: SEEDED_ORG_IDS } } });

  // Seeded users are identified by their reserved .test domains, so a developer's own
  // account survives a re-seed.
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@northwind.test' } },
  });
  await prisma.user.deleteMany({ where: { email: 'consultant@example.test' } });
  await prisma.user.deleteMany({ where: { email: 'operator@platform.test' } });
}

async function main() {
  const started = Date.now();

  if ((await prisma.healthCheck.count()) === 0) {
    await prisma.healthCheck.create({ data: {} });
  }

  await clearSeededData();

  // One PRNG for the whole run. Deterministic, and the sequence is stable as long as
  // the call order is — which is why each module takes it rather than making its own.
  const random = createRandom(20260802);

  const tenants = await seedTenants(prisma);
  const admin = await seedAdmin(prisma, tenants);
  const integrations = await seedIntegrations(prisma, tenants);
  const contacts = await seedContacts(prisma, tenants, random);
  const privacy = await seedPrivacy(prisma, tenants, contacts);
  const inbox = await seedInbox(prisma, tenants, contacts, random);
  const scheduling = await seedScheduling(prisma, tenants, contacts);
  const crm = await seedCrm(prisma, tenants, contacts, random);
  const commerce = await seedCommerce(prisma, tenants, contacts, crm.dealIds);
  const knowledge = await seedKnowledge(prisma, tenants);
  const ai = await seedAi(prisma, tenants);
  const workflows = await seedWorkflows(prisma, tenants);
  const broadcast = await seedBroadcast(prisma, tenants, contacts.riyadhContacts);
  const reviews = await seedReviews(prisma, tenants);
  await seedLoyalty(prisma, tenants);

  const contactTotal =
    contacts.riyadhContacts.length +
    contacts.jeddahContacts.length +
    contacts.beaconContacts.length;

  console.log(
    [
      'Seeded:',
      `  organizations   2 (Northwind Dental — 2 branches, Beacon Auto Care — 1)`,
      `  users           5 across owner/admin/member/viewer, one in both tenants`,
      `  contacts        ${contactTotal} (one opted out, one never consented, RTL names)`,
      `  conversations   ${inbox.conversationCount} across every state`,
      `  messages        ${inbox.messageCount} including long, emoji-only, attachment, failed`,
      `  voice           1 audio note with a completed local transcript`,
      `  appointments    ${scheduling.appointments} past/upcoming/cancelled/rescheduled/recurring`,
      `  deals           ${crm.dealIds.length} across 5 pipeline stages, plus 5 lost`,
      `  quotes          ${commerce.quoteIds.length}   invoices ${commerce.invoiceIds.length}`,
      `  knowledge       ${knowledge.sourceIds.length} sources, ${knowledge.documentIds.length} documents (FAQ + policy approved, HR draft gated)`,
      `  ai              ${ai.agentIds.length} specialist agents, ${ai.templateIds.length} prompt templates, ${ai.runIds.length} runs`,
      `  workflows       ${workflows.workflowIds.length} (one enabled with a version, one draft), ${workflows.runIds.length} run`,
      `  broadcast       ${broadcast.campaignIds.length} campaigns (cancelled, scheduled, sent), 1 segment, 1 template`,
      `  reviews         ${reviews.platformIds.length} platforms, ${reviews.requestIds.length} request, ${reviews.reviewIds.length} review`,
      `  loyalty         1 program, 1 account (silver, 450 pts), 1 coupon, 1 referral`,
      `  integrations    ${integrations.connectionCount} sandbox connections across all 11 providers`,
      `  admin portal    ${admin.planCount} plans, ${admin.subscriptionCount} subscriptions, 1 platform operator`,
      `  privacy         ${privacy.requestCount} completed access request`,
      `  in              ${Date.now() - started}ms`,
    ].join('\n'),
  );
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
