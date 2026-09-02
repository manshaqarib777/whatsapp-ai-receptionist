import { notFound } from 'next/navigation';

import { AcceptInvitation } from '@/features/auth/components/accept-invitation';
import { requireAuth } from '@/server/auth-context';

export const dynamic = 'force-dynamic';

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <AcceptInvitation invitationId={id} />;
}
