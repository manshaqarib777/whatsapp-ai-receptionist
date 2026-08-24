import { forScope } from '@/lib/db/scoped-prisma';
import type { Scope } from '@/lib/db/scope';

/**
 * Right to erasure — GDPR Art. 17, and the Saudi PDPL equivalent.
 *
 * ## Why this is not a delete
 *
 * DATABASE_RULES.md contains two rules that cannot both be satisfied by one
 * mechanism: "soft delete, never hard delete customer data", and deletion requests
 * must have "a documented, tested path to purge a contact and their messages".
 * MILESTONE_04_PLAN.md AD-4 resolves it by separating two things that were sharing a
 * name:
 *
 *   - **Soft delete** (`deleted_at`) is a product feature. Trash and restore. It is
 *     not erasure and nothing should describe it as such.
 *   - **Erasure** overwrites the PII columns in place and stamps `redacted_at`,
 *     leaving the row skeleton, its ids, and its timestamps.
 *
 * Because audit payloads never contain PII (DATABASE_RULES.md → Audit), the audit
 * trail survives erasure intact: it references a contact by id, and that id still
 * resolves to a redacted row. The trail stays provable and the personal data is
 * genuinely gone. That is pseudonymisation under GDPR Art. 4(5).
 *
 * ## Why a registry
 *
 * Drawing the Tier-2 half of the ER diagram surfaced that `transcriptions`
 * (Milestone 20) will hold PII — a voice note transcribed to text. So the set of
 * redactable columns grows in milestones that have not happened yet. A hardcoded list
 * would be silently incomplete the moment Milestone 20 lands, and an incomplete
 * erasure is a regulatory failure rather than a bug.
 *
 * Adding a table here is the whole change required: register its columns, and the
 * completeness test below starts covering it.
 */

/**
 * How to neutralise one PII column.
 *
 * `null` where the column is nullable, a constant where it is not, and a function
 * where the value must stay unique — a phone number is under a partial unique index,
 * so every erased contact needs a distinct placeholder or the second erasure in an
 * organization fails.
 */
type Redaction = null | string | ((row: { id: string }) => string);

export type RedactionSpec = {
  /** Prisma model name. */
  model: string;
  /** Column → replacement. */
  columns: Record<string, Redaction>;
  /** Set `redacted_at` on this model. */
  stampsRedactedAt: boolean;
};

/**
 * Every column holding contact-identifying data, per model.
 *
 * Milestone 20 adds `transcriptions`. Milestone 6 may add more to `messages`. This is
 * the single place either change lands.
 */
export const CONTACT_REDACTIONS: readonly RedactionSpec[] = [
  {
    model: 'Contact',
    columns: {
      displayName: 'Redacted',
      // Must stay unique within the organization: uq_contacts_organization_id_
      // phone_number is partial on deleted_at IS NULL, so two erased-but-not-deleted
      // contacts would otherwise collide.
      phoneNumber: (row) => `redacted:${row.id}`,
      email: null,
    },
    stampsRedactedAt: true,
  },
  {
    model: 'Message',
    // The message body is the single largest store of customer PII in the product.
    columns: { body: null },
    stampsRedactedAt: true,
  },
  {
    model: 'MessageAttachment',
    // The blob itself lives in object storage and is deleted by the storage adapter;
    // this clears the pointer and the filename, which can itself identify a person.
    columns: { storageKey: '', fileName: null },
    stampsRedactedAt: true,
  },
  {
    model: 'Transcription',
    columns: { text: null },
    stampsRedactedAt: true,
  },
  {
    model: 'ConversationNote',
    // Staff-written, about the contact, and frequently quotes them.
    columns: { body: 'Redacted' },
    stampsRedactedAt: false,
  },
  {
    model: 'Conversation',
    // No PII columns of its own — stamped so the conversation reads as erased rather
    // than as an empty thread of unknown provenance.
    columns: {},
    stampsRedactedAt: true,
  },
];

export type ErasureResult = {
  contactId: string;
  /** Rows touched, per model. Returned so the caller can record it in the audit log. */
  rowsRedacted: Record<string, number>;
};

/**
 * Erase one contact and everything they said.
 *
 * Runs in a transaction: a partial erasure that reports success is worse than a
 * failure, because nobody goes back to check.
 *
 * Uses `includeDeleted` — a contact who was moved to trash before requesting erasure
 * must still be erased, and a soft-delete filter would silently skip exactly those
 * rows.
 */
export async function eraseContact(
  scope: Scope,
  contactId: string,
): Promise<ErasureResult> {
  const db = forScope(scope, { includeDeleted: true });
  const rowsRedacted: Record<string, number> = {};

  await db.$transaction(async (tx) => {
    const contact = await tx.contact.findFirst({
      where: { id: contactId },
      select: { id: true },
    });

    if (!contact) {
      // Scope already filtered this: another tenant's contact is indistinguishable
      // from one that does not exist.
      throw new Error(`Contact ${contactId} not found in this tenant.`);
    }

    const conversationIds = (
      await tx.conversation.findMany({
        where: { contactId },
        select: { id: true },
      })
    ).map((c) => c.id);

    const messageIds =
      conversationIds.length === 0
        ? []
        : (
            await tx.message.findMany({
              where: { conversationId: { in: conversationIds } },
              select: { id: true },
            })
          ).map((m) => m.id);

    const targets: Record<string, string[]> = {
      Contact: [contact.id],
      Conversation: conversationIds,
      Message: messageIds,
      MessageAttachment: messageIds,
      Transcription: messageIds,
      ConversationNote: conversationIds,
    };

    for (const spec of CONTACT_REDACTIONS) {
      const ids = targets[spec.model] ?? [];

      if (ids.length === 0) {
        rowsRedacted[spec.model] = 0;
        continue;
      }

      // MessageAttachment and ConversationNote are matched by their parent id, not
      // their own, so the predicate differs per model.
      const where =
        spec.model === 'MessageAttachment'
          ? { messageId: { in: ids } }
          : spec.model === 'Transcription'
            ? { messageId: { in: ids } }
            : spec.model === 'ConversationNote'
              ? { conversationId: { in: ids } }
              : { id: { in: ids } };

      const delegate = (tx as unknown as Record<string, DelegateWithUpdateMany>)[
        lowerFirst(spec.model)
      ];

      if (!delegate) {
        throw new Error(`Redaction registry names an unknown model: ${spec.model}`);
      }

      const hasPerRowValue = Object.values(spec.columns).some(
        (replacement) => typeof replacement === 'function',
      );

      if (hasPerRowValue) {
        // A per-row replacement exists because the column is under a unique index, so
        // every row needs a DIFFERENT value. Batching them into one updateMany would
        // write one value to all of them and collide on the second row — which is
        // precisely the case the function exists to avoid.
        let count = 0;

        for (const id of ids) {
          const result = await delegate.updateMany({
            where: { id },
            data: buildData(spec, id),
          });
          count += result.count;
        }

        rowsRedacted[spec.model] = count;
        continue;
      }

      const result = await delegate.updateMany({ where, data: buildData(spec, null) });
      rowsRedacted[spec.model] = result.count;
    }
  });

  return { contactId, rowsRedacted };
}

type DelegateWithUpdateMany = {
  updateMany: (args: { where: unknown; data: unknown }) => Promise<{ count: number }>;
};

/**
 * The `data` clause for one redaction.
 *
 * `rowId` is required when any replacement is a function; it is null for the batched
 * path, where by construction none are.
 */
function buildData(spec: RedactionSpec, rowId: string | null): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const [column, replacement] of Object.entries(spec.columns)) {
    if (typeof replacement === 'function') {
      if (rowId === null) {
        throw new Error(
          `${spec.model}.${column} needs a per-row value but was batched. ` +
            `This is a bug in eraseContact, not in the registry.`,
        );
      }

      data[column] = replacement({ id: rowId });
      continue;
    }

    data[column] = replacement;
  }

  if (spec.stampsRedactedAt) {
    data['redactedAt'] = new Date();
  }

  return data;
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
