import { Section } from '@/features/design-system/components/section';

/**
 * Token reference.
 *
 * Renders the tokens themselves rather than a table of their values, so a reviewer
 * can see in both themes whether `--warning` actually reads as a warning and whether
 * the elevation scale steps evenly. A hex code in a document cannot show that.
 */

const SURFACE_TOKENS = [
  { name: 'background', className: 'bg-background' },
  { name: 'card', className: 'bg-card' },
  { name: 'muted', className: 'bg-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'primary', className: 'bg-primary' },
  { name: 'secondary', className: 'bg-secondary' },
];

const STATUS_TOKENS = [
  { name: 'success', className: 'bg-success' },
  { name: 'success-subtle', className: 'bg-success-subtle' },
  { name: 'warning', className: 'bg-warning' },
  { name: 'warning-subtle', className: 'bg-warning-subtle' },
  { name: 'info', className: 'bg-info' },
  { name: 'info-subtle', className: 'bg-info-subtle' },
  { name: 'destructive', className: 'bg-destructive' },
  { name: 'destructive-subtle', className: 'bg-destructive-subtle' },
];

const CHART_TOKENS = [
  'bg-chart-1',
  'bg-chart-2',
  'bg-chart-3',
  'bg-chart-4',
  'bg-chart-5',
  'bg-chart-6',
];

const SHADOWS = ['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl'];

const RADII = ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl'];

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="space-y-1.5">
      <div className={`h-12 w-full rounded-lg border ${className}`} />
      <p className="text-muted-foreground font-mono text-[0.6875rem]">{name}</p>
    </div>
  );
}

export function TokensSection() {
  return (
    <Section
      id="tokens"
      title="Tokens"
      description="Every value below is a CSS variable. No component may use a raw hex, px, or ms."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Surfaces</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {SURFACE_TOKENS.map((token) => (
              <Swatch key={token.name} {...token} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Status — solid for icons, text, and borders; subtle for filled backgrounds
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {STATUS_TOKENS.map((token) => (
              <Swatch key={token.name} {...token} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Categorical chart palette — separated by hue, not by lightness, so series stay
            distinguishable under deuteranopia and protanopia
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {CHART_TOKENS.map((className, index) => (
              <Swatch key={className} name={`chart-${index + 1}`} className={className} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Elevation — two layers each, a tight contact shadow plus a wide ambient one
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {SHADOWS.map((shadow) => (
              <div key={shadow} className="space-y-1.5">
                <div className={`bg-card h-12 w-full rounded-lg ${shadow}`} />
                <p className="text-muted-foreground font-mono text-[0.6875rem]">
                  {shadow}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            Radius — derived from a single --radius of 16px
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {RADII.map((radius) => (
              <div key={radius} className="space-y-1.5">
                <div className={`bg-muted h-12 w-full border ${radius}`} />
                <p className="text-muted-foreground font-mono text-[0.6875rem]">
                  {radius}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Type scale</p>
          <div className="space-y-2">
            <p className="text-3xl font-semibold tracking-tight">
              Display — 30px semibold
            </p>
            <p className="text-xl font-semibold tracking-tight">
              Heading — 20px semibold
            </p>
            <p className="text-base font-medium">Subheading — 16px medium</p>
            <p className="text-sm">Body — 14px regular</p>
            <p className="text-muted-foreground text-xs">Caption — 12px muted</p>
            <p className="font-mono text-sm tabular-nums">
              Numeric — 1,284 · 94% · 2m 14s
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
