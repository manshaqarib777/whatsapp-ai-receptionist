import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { BroadcastBaseRepository } from './broadcast.base';
import type { SegmentRow } from './broadcast.types';
import type { SegmentDefinition } from '../services/segments';

const SEGMENT_SELECT = {
  id: true,
  name: true,
  definition: true,
  createdAt: true,
} as const;

/**
 * Segment data access.
 *
 * A segment is a filter tree (`definition`) evaluated against contacts at send
 * time — a question, not a snapshot.
 */
export class SegmentsRepository extends BroadcastBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listSegments(): Promise<SegmentRow[]> {
    const rows = await this.db.segment.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: SEGMENT_SELECT,
    });
    return rows.map((row) => ({
      ...row,
      definition: row.definition as SegmentDefinition,
    }));
  }

  async getSegment(id: string): Promise<SegmentRow> {
    const row = await this.db.segment.findFirst({
      where: { id, deletedAt: null },
      select: SEGMENT_SELECT,
    });
    if (!row) throw new NotFoundError('Segment not found.');
    return { ...row, definition: row.definition as SegmentDefinition };
  }

  async createSegment(input: {
    branchId: string;
    name: string;
    definition: SegmentDefinition;
  }): Promise<SegmentRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.segment.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        definition: input.definition as never,
      },
      select: SEGMENT_SELECT,
    });
    return { ...row, definition: row.definition as SegmentDefinition };
  }
}
