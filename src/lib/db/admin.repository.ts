import { prisma } from '@/lib/prisma';
import { ConflictError, NotFoundError } from '@/lib/errors';
import type {
  PageInput,
  PlanUpdate,
  SubscriptionUpdate,
} from '@/features/admin/admin.types';

const pageArgs = ({ page, limit }: PageInput) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const adminRepository = {
  async overview() {
    const [tenants, users, activeSubscriptions, aiRuns, failedJobs, auditEvents] =
      await Promise.all([
        prisma.organization.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.subscription.count({
          where: { deletedAt: null, status: { in: ['active', 'trialing'] } },
        }),
        prisma.aiRun.count(),
        prisma.aiTurnJob.count({ where: { status: 'failed' } }),
        prisma.auditLog.count(),
      ]);
    return { tenants, users, activeSubscriptions, aiRuns, failedJobs, auditEvents };
  },

  async tenants(input: PageInput) {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        ...pageArgs(input),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: { select: { members: true, branches: true } },
          subscriptions: {
            where: { deletedAt: null },
            take: 1,
            select: { status: true, plan: { select: { name: true } } },
          },
        },
      }),
      prisma.organization.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        createdAt: item.createdAt.toISOString(),
        members: item._count.members,
        branches: item._count.branches,
        subscription: item.subscriptions[0] ?? null,
      })),
      ...input,
      total,
    };
  },

  async plans() {
    const items = await prisma.plan.findMany({
      orderBy: [{ active: 'desc' }, { amount: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        amount: true,
        currency: true,
        interval: true,
        features: true,
        limits: true,
        active: true,
        version: true,
        _count: { select: { subscriptions: true } },
      },
    });
    return items.map((item) => ({
      ...item,
      amount: Number(item.amount),
      subscriptions: item._count.subscriptions,
      _count: undefined,
    }));
  },

  async updatePlan(id: string, input: PlanUpdate) {
    const { version, ...data } = input;
    const result = await prisma.plan.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    if (!result.count) {
      if (!(await prisma.plan.findFirst({ where: { id }, select: { id: true } })))
        throw new NotFoundError('Plan not found.');
      throw new ConflictError('The plan changed. Refresh and try again.');
    }
    return prisma.plan.findFirstOrThrow({
      where: { id },
      select: { id: true, name: true, active: true, version: true },
    });
  },

  async billing(input: PageInput) {
    const where = { deletedAt: null };
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        ...pageArgs(input),
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          interval: true,
          periodStartsAt: true,
          periodEndsAt: true,
          trialEndsAt: true,
          cancelAtPeriodEnd: true,
          version: true,
          organization: { select: { id: true, name: true } },
          plan: { select: { id: true, name: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        amount: Number(item.amount),
        periodStartsAt: item.periodStartsAt.toISOString(),
        periodEndsAt: item.periodEndsAt.toISOString(),
        trialEndsAt: item.trialEndsAt?.toISOString() ?? null,
      })),
      ...input,
      total,
    };
  },

  async updateSubscription(id: string, input: SubscriptionUpdate) {
    const { version, ...data } = input;
    if (
      data.planId &&
      !(await prisma.plan.findFirst({
        where: { id: data.planId, active: true },
        select: { id: true },
      }))
    ) {
      throw new NotFoundError('Active plan not found.');
    }
    const result = await prisma.subscription.updateMany({
      where: { id, version, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (!result.count) {
      if (
        !(await prisma.subscription.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        }))
      )
        throw new NotFoundError('Subscription not found.');
      throw new ConflictError('The subscription changed. Refresh and try again.');
    }
    return prisma.subscription.findFirstOrThrow({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        status: true,
        cancelAtPeriodEnd: true,
        version: true,
      },
    });
  },

  async logs(input: PageInput) {
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        ...pageArgs(input),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          action: true,
          organizationId: true,
          actorId: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count(),
    ]);
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      ...input,
      total,
    };
  },

  async aiUsage() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const grouped = await prisma.aiRun.groupBy({
      by: ['organizationId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, costAmount: true, latencyMs: true },
      orderBy: { _count: { organizationId: 'desc' } },
      take: 100,
    });
    const organizations = await prisma.organization.findMany({
      where: { id: { in: grouped.map((row) => row.organizationId) } },
      select: { id: true, name: true },
    });
    const names = new Map(organizations.map((item) => [item.id, item.name]));
    return grouped.map((row) => ({
      organizationId: row.organizationId,
      organizationName: names.get(row.organizationId) ?? 'Deleted tenant',
      runs: row._count._all,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      costUsd: Number(row._sum.costAmount ?? 0),
      averageLatencyMs: row._count._all
        ? Math.round((row._sum.latencyMs ?? 0) / row._count._all)
        : 0,
    }));
  },

  async analytics() {
    const [conversations, appointments, campaigns, invoices] = await Promise.all([
      prisma.conversation.count(),
      prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.campaign.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.invoice.groupBy({
        by: ['currency'],
        _count: { _all: true },
        _sum: { totalAmount: true, amountPaid: true },
      }),
    ]);
    return {
      conversations,
      appointments: appointments.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      campaigns: campaigns.map((row) => ({ status: row.status, count: row._count._all })),
      invoices: invoices.map((row) => ({
        currency: row.currency,
        count: row._count._all,
        total: Number(row._sum.totalAmount ?? 0),
        paid: Number(row._sum.amountPaid ?? 0),
      })),
    };
  },

  async monitoring() {
    const started = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    const databaseLatencyMs = Math.round(performance.now() - started);
    const [integrationErrors, failedAiJobs, failedIngestionJobs, failedTranscriptions] =
      await Promise.all([
        prisma.integrationConnection.count({
          where: { status: 'error', deletedAt: null },
        }),
        prisma.aiTurnJob.count({ where: { status: 'failed' } }),
        prisma.ingestionJob.count({ where: { status: 'failed' } }),
        prisma.transcription.count({ where: { status: 'failed', deletedAt: null } }),
      ]);
    return {
      status: databaseLatencyMs < 1_000 ? 'operational' : 'degraded',
      databaseLatencyMs,
      queues: { failedAiJobs, failedIngestionJobs, failedTranscriptions },
      integrationErrors,
      checkedAt: new Date().toISOString(),
    };
  },
};
