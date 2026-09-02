import { NotFoundError } from '@/lib/errors';
import type { Scope } from '@/lib/db/scope';

import { CrmBaseRepository } from './crm.base';
import type { TaskRow, TaskStatus } from './crm.types';

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  dueAt: true,
  status: true,
  assignee: { select: { name: true } },
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Task data access.
 *
 * Tasks are branch-scoped and org-owned; the assignee is a member of the same
 * organization, and assignability is resolved through the member table.
 */
export class CrmTasksRepository extends CrmBaseRepository {
  constructor(scope: Scope) {
    super(scope);
  }

  async listTasks(filter: { status?: TaskStatus }): Promise<TaskRow[]> {
    const rows = await this.db.task.findMany({
      where: {
        deletedAt: null,
        ...(filter.status ? { status: filter.status } : {}),
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      select: TASK_SELECT,
    });
    return rows.map(toTaskRow);
  }

  async createTask(input: {
    branchId: string;
    title: string;
    description?: string;
    dueAt?: string;
    assigneeId?: string;
  }): Promise<TaskRow> {
    const db = this.writeScope(input.branchId);
    const row = await db.task.create({
      data: {
        organizationId: this.organizationId,
        branchId: input.branchId,
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        assigneeId: input.assigneeId ?? null,
      },
      select: TASK_SELECT,
    });
    return toTaskRow(row);
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<TaskRow> {
    await this.db.task.updateMany({
      where: { id },
      data: { status, version: { increment: 1 } },
    });
    const row = await this.db.task.findFirst({ where: { id }, select: TASK_SELECT });
    if (!row) throw new NotFoundError('Task not found.');
    return toTaskRow(row);
  }

  async listAssignableUsers(): Promise<{ id: string; name: string }[]> {
    const rows = await this.db.member.findMany({
      where: { organizationId: this.organizationId },
      select: { user: { select: { id: true, name: true } } },
    });
    return rows.map((row) => ({ id: row.user.id, name: row.user.name }));
  }
}

function toTaskRow(row: {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | null;
  status: TaskStatus;
  assignee: { name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskRow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.dueAt,
    status: row.status,
    assigneeName: row.assignee?.name ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
