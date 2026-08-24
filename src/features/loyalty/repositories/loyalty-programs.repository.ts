import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';
import { LoyaltyBaseRepository } from './loyalty.base';
import type { LoyaltyProgramRow } from './loyalty.types';

const SELECT = {
  id: true,
  name: true,
  pointsPerCurrency: true,
  isEnabled: true,
  createdAt: true,
} as const;

export class LoyaltyProgramsRepository extends LoyaltyBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }
  async listPrograms(): Promise<LoyaltyProgramRow[]> {
    const rows = await this.db.loyaltyProgram.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: SELECT,
    });
    return rows.map(toProgramRow);
  }
  async getProgram(id: string): Promise<LoyaltyProgramRow> {
    const row = await this.db.loyaltyProgram.findFirst({
      where: { id, deletedAt: null },
      select: SELECT,
    });
    if (!row) throw new NotFoundError('Loyalty program not found.');
    return toProgramRow(row);
  }
  async createProgram(input: {
    branchId: string;
    name: string;
    pointsPerCurrency: number;
  }) {
    const row = await this.writeScope(input.branchId).loyaltyProgram.create({
      data: { organizationId: this.organizationId, ...input },
      select: SELECT,
    });
    return toProgramRow(row);
  }
  async findEnabledProgram(): Promise<LoyaltyProgramRow | null> {
    const row = await this.db.loyaltyProgram.findFirst({
      where: { deletedAt: null, isEnabled: true },
      orderBy: { createdAt: 'asc' },
      select: SELECT,
    });
    return row ? toProgramRow(row) : null;
  }
}

function toProgramRow(row: {
  id: string;
  name: string;
  pointsPerCurrency: unknown;
  isEnabled: boolean;
  createdAt: Date;
}): LoyaltyProgramRow {
  return { ...row, pointsPerCurrency: Number(row.pointsPerCurrency) };
}
