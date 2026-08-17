// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { ConflictError, UnprocessableError } from '@/lib/errors';
import { BroadcastService } from '@/features/broadcast/services/broadcast.service';

/**
 * Broadcast integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's segments, templates, or
 * campaigns. Consent is the second pillar: an opted-out contact can never be
 * materialised as a recipient, and a campaign with zero eligible recipients is
 * refused rather than silently sending nothing.
 */

type Fixture = { orgA: string; orgB: string; branchA: string; branchB: string };

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `broadcast-${label}-${Date.now()}-${suffix}` },
    select: { id: true },
  });
  return org.id;
}

async function makeBranch(orgId: string, label: string): Promise<string> {
  suffix += 1;
  const branch = await prisma.branch.create({
    data: {
      organizationId: orgId,
      name: label,
      slug: `broadcast-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

function serviceFor(orgId: string): BroadcastService {
  return BroadcastService.forOrganization(orgId);
}

async function makeContact(
  orgId: string,
  branchId: string,
  overrides: {
    phone?: string;
    consent?: boolean;
    optedOut?: boolean;
  } = {},
): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: overrides.phone ?? `+9665000${String(suffix).padStart(5, '0')}`,
      displayName: `Contact ${suffix}`,
      locale: 'en',
      hasConsent: overrides.consent ?? true,
      optedOutAt: overrides.optedOut ? new Date() : null,
    },
    select: { id: true },
  });
  return contact.id;
}

async function makeSegment(service: BroadcastService, name: string): Promise<string> {
  const segment = await service.createSegment({
    name,
    definition: { locale: 'en' },
  });
  return segment.id;
}

async function makeTemplate(service: BroadcastService, name: string): Promise<string> {
  const template = await service.createTemplate({
    name,
    language: 'en',
    body: { body: 'Hi {{1}}, a message from the test.' },
  });
  return template.id;
}

beforeEach(async () => {
  suffix += 1;
  const orgA = await makeOrg('A');
  const orgB = await makeOrg('B');
  f = {
    orgA,
    orgB,
    branchA: await makeBranch(orgA, 'main'),
    branchB: await makeBranch(orgB, 'main'),
  };
});

afterEach(async () => {
  for (const orgId of [f.orgA, f.orgB]) {
    await prisma.campaignRecipient.deleteMany({ where: { organizationId: orgId } });
    await prisma.campaign.deleteMany({ where: { organizationId: orgId } });
    await prisma.whatsappMessageTemplate.deleteMany({ where: { organizationId: orgId } });
    await prisma.segment.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('broadcast — segments', () => {
  it('creates and lists segments, scoped to the org', async () => {
    const a = serviceFor(f.orgA);
    await a.createSegment({ name: 'A segment', definition: { locale: 'en' } });
    await serviceFor(f.orgB).createSegment({
      name: 'B segment',
      definition: { locale: 'ar' },
    });

    const segments = await a.listSegments();
    expect(segments).toHaveLength(1);
    expect(segments[0]?.name).toBe('A segment');
  });

  it('404s a missing segment', async () => {
    await expect(
      serviceFor(f.orgA).previewSegmentCount('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow(/not found/i);
  });

  it('previews the eligible count, excluding opted-out and never-consented contacts', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');
    await makeContact(f.orgA, f.branchA);
    await makeContact(f.orgA, f.branchA);
    await makeContact(f.orgA, f.branchA, { consent: false });
    await makeContact(f.orgA, f.branchA, { optedOut: true });

    const count = await a.previewSegmentCount(segmentId);
    expect(count).toBe(2);
  });
});

describe('broadcast — templates', () => {
  it('creates templates approved by default and lists them per org', async () => {
    const a = serviceFor(f.orgA);
    const template = await a.createTemplate({
      name: 'Welcome',
      language: 'en',
      body: { body: 'Welcome!' },
    });

    expect(template.metaStatus).toBe('approved');

    const templates = await a.listTemplates();
    expect(templates).toHaveLength(1);
  });
});

describe('broadcast — campaigns', () => {
  it('creates a draft campaign against an approved template', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');
    const templateId = await makeTemplate(a, 'Welcome');

    const campaign = await a.createCampaign({
      name: 'Test campaign',
      segmentId,
      templateId,
    });

    expect(campaign.status).toBe('draft');
    expect(campaign.segmentName).toBe('Target');
    expect(campaign.templateName).toBe('Welcome');
  });

  it('refuses a campaign against an unapproved template', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');

    const template = await prisma.whatsappMessageTemplate.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        name: 'Pending',
        language: 'en',
        metaStatus: 'pending',
        body: { body: 'Not ready' },
      },
      select: { id: true },
    });

    await expect(
      a.createCampaign({ name: 'X', segmentId, templateId: template.id }),
    ).rejects.toThrow(ConflictError);
  });

  it('materialises recipients at send time and excludes opted-out contacts', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');
    const templateId = await makeTemplate(a, 'Welcome');
    const included = await makeContact(f.orgA, f.branchA);
    await makeContact(f.orgA, f.branchA, { optedOut: true });

    const campaign = await a.createCampaign({ name: 'Wave', segmentId, templateId });
    const sending = await a.materialiseAndSend(campaign.id);

    expect(sending.status).toBe('sending');

    const recipients = await a.listRecipients(campaign.id);
    expect(recipients).toHaveLength(1);
    expect(recipients[0]?.contactId).toBe(included);
  });

  it('refuses to send to nobody', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');
    const templateId = await makeTemplate(a, 'Welcome');

    const campaign = await a.createCampaign({ name: 'Empty', segmentId, templateId });

    await expect(a.materialiseAndSend(campaign.id)).rejects.toThrow(UnprocessableError);
  });

  it('advances a sent campaign to sent and marks recipients', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');
    const templateId = await makeTemplate(a, 'Welcome');
    await makeContact(f.orgA, f.branchA);

    const campaign = await a.createCampaign({ name: 'Wave', segmentId, templateId });
    await a.materialiseAndSend(campaign.id);

    const processed = await a.processDueCampaigns(new Date(Date.now() + 60_000));
    expect(processed).toBe(1);

    const sent = await a.getCampaign(campaign.id);
    expect(sent.status).toBe('sent');
    expect(sent.finishedAt).not.toBeNull();

    const recipients = await a.listRecipients(campaign.id);
    expect(recipients[0]?.status).toBe('sent');
  });

  it('cancels a scheduled campaign before it sends', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');
    const templateId = await makeTemplate(a, 'Welcome');

    const campaign = await a.createCampaign({ name: 'Wave', segmentId, templateId });
    const scheduled = await a.transition(
      campaign.id,
      'schedule',
      new Date(Date.now() + 3_600_000).toISOString(),
    );
    expect(scheduled.status).toBe('scheduled');

    const cancelled = await a.transition(campaign.id, 'cancel');
    expect(cancelled.status).toBe('cancelled');

    // A cancelled campaign cannot be cancelled again, and the worker never sends it.
    await expect(a.transition(campaign.id, 'cancel')).rejects.toThrow(ConflictError);
    const processed = await a.processDueCampaigns(new Date(Date.now() + 7_200_000));
    expect(processed).toBe(0);
  });

  it('computes analytics from recipient rows', async () => {
    const a = serviceFor(f.orgA);
    const segmentId = await makeSegment(a, 'Target');
    const templateId = await makeTemplate(a, 'Welcome');
    const contactIds = [
      await makeContact(f.orgA, f.branchA),
      await makeContact(f.orgA, f.branchA),
    ];

    const campaign = await a.createCampaign({ name: 'Wave', segmentId, templateId });
    await a.materialiseAndSend(campaign.id);

    await prisma.campaignRecipient.updateMany({
      where: { campaignId: campaign.id },
      data: { status: 'delivered' },
    });
    await prisma.campaignRecipient.update({
      where: {
        campaignId_contactId: {
          campaignId: campaign.id,
          contactId: contactIds[0] as string,
        },
      },
      data: { status: 'read' },
    });
    await prisma.campaignRecipient.update({
      where: {
        campaignId_contactId: {
          campaignId: campaign.id,
          contactId: contactIds[1] as string,
        },
      },
      data: { status: 'failed' },
    });

    const analytics = await a.getAnalytics(campaign.id);
    expect(analytics.total).toBe(2);
    expect(analytics.sent).toBe(2);
    expect(analytics.delivered).toBe(1);
    expect(analytics.read).toBe(1);
    expect(analytics.failed).toBe(1);
    expect(analytics.deliveredRate).toBeCloseTo(0.5);
  });

  it('org A never sees org B campaigns or recipients', async () => {
    const a = serviceFor(f.orgA);
    const b = serviceFor(f.orgB);
    const aSegment = await makeSegment(a, 'A seg');
    const aTemplate = await makeTemplate(a, 'A tpl');
    const bSegment = await makeSegment(b, 'B seg');
    const bTemplate = await makeTemplate(b, 'B tpl');

    const aCampaign = await a.createCampaign({
      name: 'A wave',
      segmentId: aSegment,
      templateId: aTemplate,
    });
    await b.createCampaign({
      name: 'B wave',
      segmentId: bSegment,
      templateId: bTemplate,
    });

    const aCampaigns = await a.listCampaigns();
    const bCampaigns = await b.listCampaigns();

    expect(aCampaigns).toHaveLength(1);
    expect(bCampaigns).toHaveLength(1);
    expect(aCampaigns[0]?.name).toBe('A wave');
    expect(bCampaigns[0]?.name).toBe('B wave');

    await expect(b.getCampaign(aCampaign.id)).rejects.toThrow(/not found/i);
    await expect(b.getAnalytics(aCampaign.id)).rejects.toThrow(/not found/i);
  });
});
