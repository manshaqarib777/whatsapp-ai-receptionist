/**
 * Segment filter-tree evaluation — Milestone 14 (AD-2).
 *
 * A segment is a question, not a snapshot: the definition is a small filter
 * tree evaluated against contact rows at send time. All operators are ANDed.
 *
 * Consent is non-negotiable and enforced HERE, not in the definition: a
 * broadcast to an opted-out contact is a compliance failure, not a filter
 * choice. `evaluateSegment` always requires `hasConsent` and always excludes
 * `optedOutAt`, no matter what the definition says.
 */

export type SegmentDefinition = {
  locale?: string;
  lifecycleStage?: 'lead' | 'prospect' | 'customer';
  /** Only contacts created at or after this ISO date. */
  createdAtAfter?: string;
  /** Only contacts with an open deal valued at or above this amount. */
  dealValueMin?: number;
};

export type SegmentContact = {
  id: string;
  locale: string;
  lifecycleStage: string;
  hasConsent: boolean;
  optedOutAt: Date | null;
  createdAt: Date;
  /** Sum of open deal values, when the contact has deals. */
  openDealValue: number;
};

export function isEmptyDefinition(definition: SegmentDefinition): boolean {
  return (
    definition.locale === undefined &&
    definition.lifecycleStage === undefined &&
    definition.createdAtAfter === undefined &&
    definition.dealValueMin === undefined
  );
}

/**
 * Evaluates a definition against contact rows. Pure — given the same inputs it
 * always returns the same ids, so the unit tests pin the rules without any
 * database. Consent and opted-out exclusions are applied unconditionally.
 */
export function evaluateSegment(
  definition: SegmentDefinition,
  contacts: SegmentContact[],
): string[] {
  return contacts
    .filter((contact) => {
      // The non-negotiable invariants. A segment can never include a contact
      // who has not consented or who has withdrawn consent.
      if (!contact.hasConsent || contact.optedOutAt !== null) return false;

      if (definition.locale && contact.locale !== definition.locale) return false;
      if (
        definition.lifecycleStage &&
        contact.lifecycleStage !== definition.lifecycleStage
      ) {
        return false;
      }
      if (definition.createdAtAfter) {
        const after = new Date(definition.createdAtAfter);
        if (Number.isNaN(after.getTime()) || contact.createdAt < after) return false;
      }
      if (
        definition.dealValueMin !== undefined &&
        contact.openDealValue < definition.dealValueMin
      ) {
        return false;
      }

      return true;
    })
    .map((contact) => contact.id);
}
