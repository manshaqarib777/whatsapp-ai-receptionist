import type { PrismaClient } from '@prisma/client';

import { SEED_NOW, daysFromNow, seedId } from './support';
import type { SeededTenants } from './tenants';

/**
 * Reviews (Milestone 16).
 *
 * Google + Facebook platforms (both unconfigured — the API seam is stubbed),
 * a dedicated completed appointment for a consented contact with a sent review
 * request, and one low-rated review that surfaces the "needs attention"
 * feedback path.
 */

export type SeededReviews = Awaited<ReturnType<typeof seedReviews>>;

export async function seedReviews(
  prisma: PrismaClient,
  tenants: SeededTenants,
): Promise<{ platformIds: string[]; requestIds: string[]; reviewIds: string[] }> {
  const platformIds: string[] = [];
  const requestIds: string[] = [];
  const reviewIds: string[] = [];

  const google = await prisma.reviewPlatform.create({
    data: {
      id: seedId('review-platform', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Google',
      provider: 'google',
      isConnected: false,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });
  platformIds.push(google.id);

  const facebook = await prisma.reviewPlatform.create({
    data: {
      id: seedId('review-platform', 2),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Facebook',
      provider: 'facebook',
      isConnected: false,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });
  platformIds.push(facebook.id);

  // Contact 4 (`riyadhContacts[3]`) is consented (index 0 is opted out, 1 is
  // never-consented). A completed appointment of its own — the automation
  // worker's trigger — with a sent review request attached.
  const service = await prisma.service.create({
    data: {
      id: seedId('review-service', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      name: 'Review follow-up',
      durationMinutes: 30,
      priceAmount: 150,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  const resource = await prisma.resource.create({
    data: {
      id: seedId('review-resource', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      kind: 'staff',
      name: 'Review Desk',
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  const appointment = await prisma.appointment.create({
    data: {
      id: seedId('review-appointment', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId: seedId('contact', 4),
      serviceId: service.id,
      resourceId: resource.id,
      startsAt: daysFromNow(-6, 9, 0),
      endsAt: daysFromNow(-6, 9, 30),
      timezone: 'Asia/Riyadh',
      status: 'completed',
      createdAt: daysFromNow(-10),
      updatedAt: SEED_NOW,
    },
    select: { id: true },
  });

  const request = await prisma.reviewRequest.create({
    data: {
      id: seedId('review-request', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId: seedId('contact', 4),
      appointmentId: appointment.id,
      platformId: google.id,
      status: 'sent',
      sentAt: daysFromNow(-5, 10, 0),
      expiresAt: daysFromNow(9, 10, 0),
      createdAt: daysFromNow(-5),
      updatedAt: daysFromNow(-5),
    },
    select: { id: true },
  });
  requestIds.push(request.id);

  // A low-rated review — the feedback surface shows "needs attention". Uses the
  // same consented contact as the request, so the review/request story is coherent.
  const review = await prisma.review.create({
    data: {
      id: seedId('review', 1),
      organizationId: tenants.northwind.id,
      branchId: tenants.northwind.riyadh,
      contactId: seedId('contact', 4),
      requestId: request.id,
      platformId: google.id,
      rating: 2,
      text: 'The wait was much longer than expected, even with an appointment.',
      externalReviewId: 'seed-review-1',
      receivedAt: daysFromNow(-2, 12, 0),
      createdAt: daysFromNow(-2),
      updatedAt: daysFromNow(-2),
    },
    select: { id: true },
  });
  reviewIds.push(review.id);

  return { platformIds, requestIds, reviewIds };
}
