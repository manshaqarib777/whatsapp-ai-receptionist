import { Markdown } from '@/components/markdown';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Timeline } from '@/components/timeline';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Section } from '@/features/design-system/components/section';

const MARKDOWN_SAMPLE = `### Opening hours

We are open **Mon–Fri, 9am–5pm**.

- Emergency line: always on
- [Book online](https://example.com)

> Closed on public holidays.`;

export function DisplaySection() {
  return (
    <>
      <Section
        id="states"
        title="States"
        description="Loading, error, and empty are components, so no screen can forget one."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <EmptyState
            title="No conversations yet"
            description="When a customer messages your WhatsApp number, it appears here."
            action={<Button size="sm">Connect WhatsApp</Button>}
          />
          <ErrorState />
          <Card>
            <CardContent>
              <LoadingState rows={4} />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="feedback" title="Feedback and display">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Alert>
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>Your trial ends in 5 days.</AlertDescription>
            </Alert>

            <Alert variant="destructive">
              <AlertTitle>Delivery failed</AlertTitle>
              <AlertDescription>The number is no longer on WhatsApp.</AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Progress value={62} aria-label="Setup progress" />
              <p className="text-muted-foreground text-xs">Setup 62% complete</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Failed</Badge>
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">AC</AvatarFallback>
              </Avatar>
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">GC</AvatarFallback>
              </Avatar>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Skeletons</p>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline
                items={[
                  { id: '1', title: 'Conversation started', timestamp: '2 hours ago' },
                  {
                    id: '2',
                    title: 'AI replied',
                    description: 'Answered an opening-hours question.',
                    timestamp: '2 hours ago',
                  },
                  { id: '3', title: 'Escalated to Alex', timestamp: '1 hour ago' },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        id="markdown"
        title="Markdown"
        description="Raw HTML is disabled and unsafe URL schemes are stripped — see the sanitisation tests."
      >
        <Card>
          <CardContent>
            <Markdown>{MARKDOWN_SAMPLE}</Markdown>
          </CardContent>
        </Card>
      </Section>
    </>
  );
}
