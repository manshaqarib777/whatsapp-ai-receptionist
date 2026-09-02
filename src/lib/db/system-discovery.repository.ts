import { prisma } from '@/lib/prisma';

/**
 * Pre-scope reads used by background workers to discover tenant-owned work.
 *
 * These queries necessarily run before a tenant scope exists. Keeping them in the
 * database layer makes that exception explicit and reviewable; returned rows carry
 * the organization id needed to bind every subsequent operation to `forScope()`.
 */
export async function listOrganizationIds(): Promise<string[]> {
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  return organizations.map(({ id }) => id);
}

export async function listQueuedIngestionOrganizationIds(): Promise<string[]> {
  const organizations = await prisma.$queryRaw<{ organizationId: string }[]>`
    SELECT DISTINCT organization_id AS "organizationId"
    FROM ingestion_jobs
    WHERE status = 'queued'
    ORDER BY organization_id
    LIMIT 50;
  `;
  return organizations.map(({ organizationId }) => organizationId);
}

export async function listDueAppointmentReminders(
  now: Date,
): Promise<Array<{ id: string; appointmentId: string; organizationId: string }>> {
  return prisma.appointmentReminder.findMany({
    where: { status: 'scheduled', sendAt: { lte: now } },
    orderBy: { sendAt: 'asc' },
    take: 50,
    select: { id: true, appointmentId: true, organizationId: true },
  });
}

export async function listAiTurnJobOrganizationIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ organizationId: string }[]>`
    SELECT DISTINCT organization_id AS "organizationId"
    FROM ai_turn_jobs
    WHERE (status = 'queued' OR (status = 'running' AND locked_at < now() - interval '5 minutes'))
      AND attempts < max_attempts
    ORDER BY organization_id
    LIMIT 50;
  `;
  return rows.map(({ organizationId }) => organizationId);
}

export async function claimAiTurnJob(organizationId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE ai_turn_jobs
    SET status = 'running', attempts = attempts + 1, locked_at = now(), updated_at = now()
    WHERE id = (
      SELECT id FROM ai_turn_jobs
      WHERE organization_id = ${organizationId}
        AND (status = 'queued' OR (status = 'running' AND locked_at < now() - interval '5 minutes'))
        AND attempts < max_attempts
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id;
  `;
  return rows[0]?.id ?? null;
}

export async function listTranscriptionOrganizationIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ organizationId: string }[]>`
    SELECT DISTINCT organization_id AS "organizationId" FROM transcriptions
    WHERE (status = 'pending' OR (status = 'processing' AND locked_at < now() - interval '5 minutes'))
      AND attempts < max_attempts AND deleted_at IS NULL
    ORDER BY organization_id LIMIT 50;
  `;
  return rows.map(({ organizationId }) => organizationId);
}

export async function claimTranscription(
  organizationId: string,
): Promise<{ id: string; branchId: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ id: string; branchId: string }>>`
    UPDATE transcriptions SET status = 'processing', attempts = attempts + 1, locked_at = now(), updated_at = now()
    WHERE id = (SELECT id FROM transcriptions WHERE organization_id = ${organizationId}
      AND (status = 'pending' OR (status = 'processing' AND locked_at < now() - interval '5 minutes'))
      AND attempts < max_attempts AND deleted_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, branch_id AS "branchId";
  `;
  return rows[0] ?? null;
}

export async function claimDueWorkflowStep(): Promise<{
  stepId: string;
  runId: string;
  organizationId: string;
  workflowVersionId: string;
  nodeId: string;
} | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      stepId: string;
      runId: string;
      organizationId: string;
      workflowVersionId: string;
      nodeId: string;
    }>
  >`
    UPDATE workflow_run_steps AS step
    SET status = 'running', updated_at = now()
    FROM workflow_runs AS run
    WHERE step.id = (
      SELECT candidate.id
      FROM workflow_run_steps AS candidate
      JOIN workflow_runs AS candidate_run ON candidate_run.id = candidate.workflow_run_id
      WHERE candidate.status = 'pending'
        AND candidate.scheduled_for <= now()
        AND candidate_run.status = 'running'
      ORDER BY candidate.scheduled_for
      FOR UPDATE OF candidate SKIP LOCKED
      LIMIT 1
    )
      AND run.id = step.workflow_run_id
    RETURNING step.id AS "stepId", run.id AS "runId",
      step.organization_id AS "organizationId",
      run.workflow_version_id AS "workflowVersionId", step.node_id AS "nodeId";
  `;
  return rows[0] ?? null;
}
