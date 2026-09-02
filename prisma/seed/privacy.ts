import type { PrismaClient } from '@prisma/client';
import type { SeededContacts } from './contacts';
import type { SeededTenants } from './tenants';
import { SEED_NOW, seedId } from './support';

export async function seedPrivacy(
  prisma: PrismaClient,
  tenants: SeededTenants,
  contacts: SeededContacts,
) {
  await prisma.privacyRequest.create({
    data: {
      id: seedId('privacy-request', 1),
      organizationId: tenants.northwind.id,
      requesterId: tenants.staff.owner,
      contactId: contacts.riyadhContacts[0] as string,
      type: 'access',
      status: 'completed',
      completedAt: SEED_NOW,
      createdAt: SEED_NOW,
      updatedAt: SEED_NOW,
    },
  });
  return { requestCount: 1 };
}
