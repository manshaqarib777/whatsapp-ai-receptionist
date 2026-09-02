import type { PrivacyRequestType } from '@prisma/client';
import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';

const REQUEST_SELECT = {
  id: true,
  type: true,
  status: true,
  contactId: true,
  requesterId: true,
  completedAt: true,
  failureCode: true,
  version: true,
  createdAt: true,
  contact: { select: { displayName: true, redactedAt: true } },
} as const;

export class PrivacyRepository {
  private readonly db;
  constructor(private readonly scope: Scope) {
    this.db = forScope(scope);
  }

  list() {
    return this.db.privacyRequest.findMany({
      select: REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  targets() {
    return this.db.contact.findMany({
      select: { id: true, displayName: true, redactedAt: true },
      orderBy: { displayName: 'asc' },
      take: 200,
    });
  }

  find(id: string) {
    return this.db.privacyRequest.findFirst({ where: { id }, select: REQUEST_SELECT });
  }

  async create(input: {
    contactId: string;
    type: PrivacyRequestType;
    requesterId: string;
  }) {
    const contact = await this.db.contact.findFirst({
      where: { id: input.contactId },
      select: { id: true },
    });
    if (!contact) return null;
    const open = await this.db.privacyRequest.findFirst({
      where: { contactId: input.contactId, type: input.type, status: 'pending' },
      select: { id: true },
    });
    if (open) return { duplicateId: open.id } as const;
    return this.db.privacyRequest.create({
      data: { organizationId: this.scope.organizationId, ...input },
      select: REQUEST_SELECT,
    });
  }

  async complete(id: string, version: number) {
    const result = await this.db.privacyRequest.updateMany({
      where: { id, version, status: 'pending' },
      data: { status: 'completed', completedAt: new Date(), version: { increment: 1 } },
    });
    return result.count === 1;
  }

  exportContact(contactId: string) {
    return this.db.contact.findFirst({
      where: { id: contactId },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        email: true,
        locale: true,
        hasConsent: true,
        optedOutAt: true,
        createdAt: true,
        updatedAt: true,
        conversations: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            messages: {
              select: { id: true, direction: true, body: true, createdAt: true },
            },
          },
        },
        appointments: {
          select: { id: true, status: true, startsAt: true, endsAt: true },
        },
      },
    });
  }
}
