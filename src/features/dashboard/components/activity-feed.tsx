import { Phone, Users } from 'lucide-react';
import Link from 'next/link';

import { Timeline } from '@/components/timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Activity feed — the last few org events as a timeline.
 *
 * COMPONENT_DESIGN.md §7: "Recent-activity beats all-activity." Eight rows with a
 * "View all" doorway. Each activity links to its subject; where the subject's page
 * does not exist yet the link targets a notFound() stub rather than a dead href.
 */

type ActivityItem = {
  id: string;
  kind: string;
  subjectType: string;
  subjectId: string;
  body: string | null;
  actorName: string | null;
  createdAt: Date;
};

function subjectHref(subjectType: string, subjectId: string): string {
  switch (subjectType) {
    case 'contact':
      return `/contacts/${subjectId}`;
    case 'conversation':
      return `/inbox/${subjectId}`;
    default:
      return `/contacts/${subjectId}`;
  }
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'note':
      return 'Note';
    case 'call':
      return 'Call';
    case 'email':
      return 'Email';
    case 'meeting':
      return 'Meeting';
    case 'stage_change':
      return 'Stage changed';
    case 'status_change':
      return 'Status changed';
    default:
      return kind;
  }
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(date);
}

export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-10 text-center text-sm">
            Team activity will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Activity</CardTitle>
        <Link
          href="/contacts"
          className="text-muted-foreground hover:text-foreground text-sm font-medium"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <Timeline
          items={activities.map((activity) => ({
            id: activity.id,
            icon: activity.subjectType === 'contact' ? Users : Phone,
            title: (
              <Link
                href={subjectHref(activity.subjectType, activity.subjectId)}
                className="hover:text-foreground text-foreground font-medium hover:underline"
              >
                {kindLabel(activity.kind)}
                {activity.actorName ? ` · ${activity.actorName}` : ''}
              </Link>
            ),
            description: activity.body ?? undefined,
            timestamp: formatTimestamp(activity.createdAt),
          }))}
        />
      </CardContent>
    </Card>
  );
}
