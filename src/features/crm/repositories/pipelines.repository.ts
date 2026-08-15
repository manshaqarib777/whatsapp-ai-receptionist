import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { CrmBaseRepository } from './crm.base';
import type { PipelineRow, PipelineStageRow } from './crm.types';

const PIPELINE_SELECT = {
  id: true,
  name: true,
  isDefault: true,
  stages: {
    where: { deletedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, position: true, winProbability: true },
  },
} as const;

/**
 * Pipeline + stage data access.
 *
 * Pipelines are branch-scoped: a write needs a branch scope, always derived
 * from the session's active branch, never from a request parameter.
 */
export class CrmPipelinesRepository extends CrmBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listPipelines(): Promise<PipelineRow[]> {
    const rows = await this.db.pipeline.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: PIPELINE_SELECT,
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.name,
        isDefault: row.isDefault,
        stages: await this.toStageRows(row.id, row.stages),
      })),
    );
  }

  async getDefaultPipeline(): Promise<PipelineRow> {
    const row = await this.db.pipeline.findFirst({
      where: { deletedAt: null, isDefault: true },
      select: PIPELINE_SELECT,
    });
    if (!row) throw new NotFoundError('No default pipeline for this organization.');
    return this.toPipelineRow(row);
  }

  async createPipeline(input: {
    branchId: string;
    name: string;
    stages: { name: string; winProbability?: number }[];
  }): Promise<PipelineRow> {
    const db = this.writeScope(input.branchId);
    const pipeline = await db.pipeline.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        name: input.name,
        isDefault: false,
      },
      select: { id: true },
    });

    await db.pipelineStage.createMany({
      data: input.stages.map((stage, position) => ({
        organizationId: this.organizationId,
        pipelineId: pipeline.id,
        name: stage.name,
        position,
        winProbability: stage.winProbability ?? 0,
      })),
    });

    return this.getPipelineById(pipeline.id);
  }

  async getPipelineById(id: string): Promise<PipelineRow> {
    const row = await this.db.pipeline.findFirst({
      where: { id, deletedAt: null },
      select: PIPELINE_SELECT,
    });
    if (!row) throw new NotFoundError('Pipeline not found.');
    return this.toPipelineRow(row);
  }

  async getStage(
    stageId: string,
  ): Promise<{ id: string; pipelineId: string; name: string }> {
    const row = await this.db.pipelineStage.findFirst({
      where: { id: stageId, deletedAt: null },
      select: { id: true, pipelineId: true, name: true },
    });
    if (!row) throw new NotFoundError('Stage not found.');
    return row;
  }

  async countDealsInStage(stageId: string): Promise<number> {
    return this.db.deal.count({ where: { stageId, status: 'open', deletedAt: null } });
  }

  private async toPipelineRow(row: {
    id: string;
    name: string;
    isDefault: boolean;
    stages: { id: string; name: string; position: number; winProbability: unknown }[];
  }): Promise<PipelineRow> {
    return {
      id: row.id,
      name: row.name,
      isDefault: row.isDefault,
      stages: await this.toStageRows(row.id, row.stages),
    };
  }

  private async toStageRows(
    pipelineId: string,
    stages: { id: string; name: string; position: number; winProbability: unknown }[],
  ): Promise<PipelineStageRow[]> {
    return Promise.all(
      stages.map(async (stage) => ({
        id: stage.id,
        pipelineId,
        name: stage.name,
        position: stage.position,
        winProbability: Number(stage.winProbability),
        dealCount: await this.countDealsInStage(stage.id),
      })),
    );
  }
}
