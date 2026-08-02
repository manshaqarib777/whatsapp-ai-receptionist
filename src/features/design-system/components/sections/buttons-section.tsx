import { Bold, Italic, Loader2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Row, Section } from '@/features/design-system/components/section';

export function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="One primary action per view. Everything else is secondary, outline, or ghost."
    >
      <Row label="Variants">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">
          <Trash2 aria-hidden="true" className="size-4" />
          Destructive
        </Button>
        <Button variant="link">Link</Button>
      </Row>

      <Row label="Sizes">
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Add">
          <Plus aria-hidden="true" className="size-4" />
        </Button>
      </Row>

      <Row label="States">
        <Button disabled>Disabled</Button>
        <Button disabled>
          {/* A pending button says what it is doing and stays disabled, so the
              action cannot be fired twice (UI_RULES.md → Forms). */}
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Saving…
        </Button>
        <Button variant="outline" aria-pressed="true">
          Pressed
        </Button>
      </Row>

      <Row label="Toggles">
        <Toggle aria-label="Bold">
          <Bold aria-hidden="true" className="size-4" />
        </Toggle>
        <Toggle aria-label="Italic" defaultPressed>
          <Italic aria-hidden="true" className="size-4" />
        </Toggle>
        <Toggle aria-label="Disabled toggle" disabled>
          <Bold aria-hidden="true" className="size-4" />
        </Toggle>
      </Row>
    </Section>
  );
}
