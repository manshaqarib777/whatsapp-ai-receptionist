// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';
import { ReviewsService } from '@/features/reviews/services/reviews.service';
import { ConflictError, UnprocessableError } from '@/lib/errors';

/**
 * Reviews integration tests — real Postgres.
 *
 * The non-negotiable: org A never sees org B's reviews, requests, or platforms.
 * The consent gate (a request for a non-consenting or opted-out contact is
 * refused), the request lifecycle, the automation worker step, and the feedback
 * threshold are exercised against the real database.
 */

type Fixture = { orgA: string; orgB: string; branchA: string; branchB: string };

let f: Fixture;
let suffix = 0;

async function makeOrg(label: string): Promise<string> {
  suffix += 1;
  const org = await prisma.organization.create({
    data: { name: label, slug: `reviews-${label}-${Date.now()}-${suffix}` },
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
      slug: `reviews-${label}-${Date.now()}-${suffix}`,
      timezone: 'Asia/Riyadh',
      isDefault: true,
    },
    select: { id: true },
  });
  return branch.id;
}

function serviceFor(orgId: string): ReviewsService {
  return ReviewsService.forOrganization(orgId);
}

async function makeContact(
  orgId: string,
  branchId: string,
  overrides: { consent?: boolean; optedOut?: boolean } = {},
): Promise<string> {
  suffix += 1;
  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      branchId,
      phoneNumber: `+9665000${String(suffix).padStart(5, '0')}`,
      displayName: `Review contact ${suffix}`,
      hasConsent: overrides.consent ?? true,
      optedOutAt: overrides.optedOut ? new Date() : null,
    },
    select: { id: true },
  });
  return contact.id;
}

async function makeCompletedAppointment(
  orgId: string,
  branchId: string,
  contactId: string,
  endsAt: Date = new Date(Date.now() - 48 * 3_600_000),
): Promise<string> {
  suffix += 1;
  const service = await prisma.service.create({
    data: {
      organizationId: orgId,
      branchId,
      name: `Service ${suffix}`,
      durationMinutes: 30,
      priceAmount: 100,
    },
    select: { id: true },
  });
  const resource = await prisma.resource.create({
    data: {
      organizationId: orgId,
      branchId,
      kind: 'staff',
      name: `Staff ${suffix}`,
    },
    select: { id: true },
  });
  const appointment = await prisma.appointment.create({
    data: {
      organizationId: orgId,
      branchId,
      contactId,
      serviceId: service.id,
      resourceId: resource.id,
      status: 'completed',
      startsAt: new Date(endsAt.getTime() - 1_800_000),
      endsAt,
      timezone: 'Asia/Riyadh',
    },
    select: { id: true },
  });
  return appointment.id;
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
    await prisma.review.deleteMany({ where: { organizationId: orgId } });
    await prisma.reviewRequest.deleteMany({ where: { organizationId: orgId } });
    await prisma.reviewPlatform.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointmentReminder.deleteMany({ where: { organizationId: orgId } });
    await prisma.appointment.deleteMany({ where: { organizationId: orgId } });
    await prisma.availabilityException.deleteMany({ where: { organizationId: orgId } });
    await prisma.availabilityRule.deleteMany({ where: { organizationId: orgId } });
    await prisma.resource.deleteMany({ where: { organizationId: orgId } });
    await prisma.service.deleteMany({ where: { organizationId: orgId } });
    await prisma.contact.deleteMany({ where: { organizationId: orgId } });
    await prisma.branch.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('reviews — platforms', () => {
  it('creates default google + facebook platforms on first list', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();

    const platforms = await service.listPlatforms();
    expect(platforms.map((p) => p.provider).sort()).toEqual(['facebook', 'google']);
    // M16 adapters are unconfigured — the seam is loud, never fake.
    expect(platforms.every((p) => p.configured === false)).toBe(true);
  });

  it('org B never sees org A platforms', async () => {
    await serviceFor(f.orgA).ensurePlatforms();

    const b = await serviceFor(f.orgB).listPlatforms();
    expect(b).toHaveLength(0);
  });
});

describe('reviews — requests', () => {
  it('creates a request for a completed appointment with consent', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA);
    const appointmentId = await makeCompletedAppointment(f.orgA, f.branchA, contactId);

    const request = await service.createRequest({
      contactId,
      appointmentId,
      platformId: (platforms[0] as { id: string }).id,
    });

    expect(request.status).toBe('created');
    expect(request.appointmentId).toBe(appointmentId);
  });

  it('refuses a request for a non-consenting contact', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA, { consent: false });
    const appointmentId = await makeCompletedAppointment(f.orgA, f.branchA, contactId);

    await expect(
      service.createRequest({
        contactId,
        appointmentId,
        platformId: (platforms[0] as { id: string }).id,
      }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('refuses a request for an opted-out contact', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA, { optedOut: true });
    const appointmentId = await makeCompletedAppointment(f.orgA, f.branchA, contactId);

    await expect(
      service.createRequest({
        contactId,
        appointmentId,
        platformId: (platforms[0] as { id: string }).id,
      }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('refuses a request for a non-completed appointment', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA);

    const serviceRow = await prisma.service.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        name: `S ${suffix++}`,
        durationMinutes: 30,
        priceAmount: 100,
      },
      select: { id: true },
    });
    const resource = await prisma.resource.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        kind: 'staff',
        name: `R ${suffix++}`,
      },
      select: { id: true },
    });
    const booking = await prisma.appointment.create({
      data: {
        organizationId: f.orgA,
        branchId: f.branchA,
        contactId,
        serviceId: serviceRow.id,
        resourceId: resource.id,
        status: 'booked',
        startsAt: new Date(Date.now() + 3_600_000),
        endsAt: new Date(Date.now() + 3_600_000 + 1_800_000),
        timezone: 'Asia/Riyadh',
      },
      select: { id: true },
    });

    await expect(
      service.createRequest({
        contactId,
        appointmentId: booking.id,
        platformId: (platforms[0] as { id: string }).id,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('sends and then cannot re-send a request', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA);
    const appointmentId = await makeCompletedAppointment(f.orgA, f.branchA, contactId);

    const request = await service.createRequest({
      contactId,
      appointmentId,
      platformId: (platforms[0] as { id: string }).id,
    });

    const sent = await service.transition(request.id, 'send');
    expect(sent.status).toBe('sent');
    expect(sent.sentAt).not.toBeNull();

    await expect(service.transition(request.id, 'send')).rejects.toThrow(ConflictError);
  });

  it('sweeps expired sent requests', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA);
    const appointmentId = await makeCompletedAppointment(f.orgA, f.branchA, contactId);

    const request = await service.createRequest({
      contactId,
      appointmentId,
      platformId: (platforms[0] as { id: string }).id,
    });
    await service.transition(request.id, 'send');

    // Force the expiry into the past.
    await prisma.reviewRequest.update({
      where: { id: request.id },
      data: { expiresAt: new Date(Date.now() - 3_600_000) },
    });

    const expired = await service.sweepExpiredRequests();
    expect(expired).toBe(1);
    const fresh = await service.getRequest(request.id);
    expect(fresh.status).toBe('expired');
  });
});

describe('reviews — automation worker', () => {
  it('creates and sends a request for a completed appointment past the grace window', async () => {
    const service = serviceFor(f.orgA);
    const contactId = await makeContact(f.orgA, f.branchA);
    await makeCompletedAppointment(
      f.orgA,
      f.branchA,
      contactId,
      new Date(Date.now() - 48 * 3_600_000),
    );

    const created = await service.automateRequests();
    expect(created).toBe(1);

    const requests = await service.listRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]?.status).toBe('sent');
  });

  it('skips a completed appointment inside the grace window', async () => {
    const service = serviceFor(f.orgA);
    const contactId = await makeContact(f.orgA, f.branchA);
    await makeCompletedAppointment(
      f.orgA,
      f.branchA,
      contactId,
      new Date(Date.now() - 2 * 3_600_000), // 2h ago — inside the 24h grace
    );

    const created = await service.automateRequests();
    expect(created).toBe(0);
  });

  it('never requests a review from a non-consenting contact', async () => {
    const service = serviceFor(f.orgA);
    const contactId = await makeContact(f.orgA, f.branchA, { consent: false });
    await makeCompletedAppointment(
      f.orgA,
      f.branchA,
      contactId,
      new Date(Date.now() - 48 * 3_600_000),
    );

    const created = await service.automateRequests();
    expect(created).toBe(0);
  });

  it('is idempotent — a second run does not duplicate', async () => {
    const service = serviceFor(f.orgA);
    const contactId = await makeContact(f.orgA, f.branchA);
    await makeCompletedAppointment(
      f.orgA,
      f.branchA,
      contactId,
      new Date(Date.now() - 48 * 3_600_000),
    );

    expect(await service.automateRequests()).toBe(1);
    expect(await service.automateRequests()).toBe(0);
    expect(await service.listRequests()).toHaveLength(1);
  });
});

describe('reviews — reviews and feedback', () => {
  it('records a review and flags low ratings as needing attention', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA);

    const review = await service.createReview({
      contactId,
      platformId: (platforms[0] as { id: string }).id,
      rating: 2,
      text: 'Slow service',
    });

    expect(review.rating).toBe(2);

    const all = await service.listReviews();
    expect(all).toHaveLength(1);
    expect(all[0]?.needsAttention).toBe(true);

    const attention = await service.listReviews({ status: 'needs-attention' });
    expect(attention).toHaveLength(1);
  });

  it('a 4+ rating is not flagged', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA);

    await service.createReview({
      contactId,
      platformId: (platforms[0] as { id: string }).id,
      rating: 5,
    });

    const all = await service.listReviews();
    expect(all[0]?.needsAttention).toBe(false);

    const attention = await service.listReviews({ status: 'needs-attention' });
    expect(attention).toHaveLength(0);
  });

  it('refuses an out-of-range rating', async () => {
    const service = serviceFor(f.orgA);
    await service.ensurePlatforms();
    const platforms = await service.listPlatforms();
    const contactId = await makeContact(f.orgA, f.branchA);

    await expect(
      service.createReview({
        contactId,
        platformId: (platforms[0] as { id: string }).id,
        rating: 6,
      }),
    ).rejects.toThrow(UnprocessableError);
  });

  it('org A never sees org B reviews', async () => {
    const a = serviceFor(f.orgA);
    await a.ensurePlatforms();
    const aPlatforms = await a.listPlatforms();
    const aContact = await makeContact(f.orgA, f.branchA);
    await a.createReview({
      contactId: aContact,
      platformId: (aPlatforms[0] as { id: string }).id,
      rating: 4,
    });

    const b = serviceFor(f.orgB);
    expect(await b.listReviews()).toHaveLength(0);
  });
});
