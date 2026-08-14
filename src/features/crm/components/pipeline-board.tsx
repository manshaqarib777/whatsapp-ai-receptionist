'use client';

import { useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useDeals,
  useMoveDeal,
  usePipelines,
  type Deal,
  type Pipeline,
} from '@/features/crm/hooks/use-crm';
import { DealDrawer } from '@/features/crm/components/deal-drawer';

/**
 * The pipeline board — columns per stage, deals as cards (M10).
 *
 * Moving a deal uses per-card stage buttons (drag-and-drop degrades to buttons,
 * per the plan) — keyboard-reachable and simple to test.
 */

export function PipelineBoard() {
  const { data, isPending, isError, refetch } = usePipelines();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  if (isPending && !data) {
    return <LoadingState rows={6} label="Loading pipeline" />;
  }
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const pipeline = data?.pipelines[0];
  if (!pipeline) {
    return (
      <EmptyState
        title="No pipeline yet"
        description="Create a pipeline to start tracking deals."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{pipeline.name}</h2>
        {pipeline.isDefault ? <Badge variant="outline">default</Badge> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {pipeline.stages.map((stage) => (
          <StageColumn
            key={stage.id}
            pipeline={pipeline}
            stage={stage}
            onOpenDeal={setSelectedDealId}
          />
        ))}
      </div>

      {selectedDealId ? (
        <DealDrawer dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />
      ) : null}
    </div>
  );
}

function StageColumn({
  pipeline,
  stage,
  onOpenDeal,
}: {
  pipeline: Pipeline;
  stage: Pipeline['stages'][number];
  onOpenDeal: (id: string) => void;
}) {
  const { data } = useDeals({ stageId: stage.id });
  const deals = data?.deals ?? [];

  return (
    <section aria-label={stage.name} className="bg-muted/40 flex flex-col rounded-xl border p-3">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{stage.name}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">{deals.length}</span>
      </header>

      <div className="space-y-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} pipeline={pipeline} onOpen={onOpenDeal} />
        ))}
        {deals.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs">No deals</p>
        ) : null}
      </div>
    </section>
  );
}

function DealCard({
  deal,
  pipeline,
  onOpen,
}: {
  deal: Deal;
  pipeline: Pipeline;
  onOpen: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const move = useMoveDeal();

  const nextStages = pipeline.stages.filter((s) => s.id !== deal.stageId);

  return (
    <article className="bg-card text-card-foreground space-y-2 rounded-lg border p-3">
      <button
        type="button"
        onClick={() => onOpen(deal.id)}
        className="hover:text-foreground text-start text-sm font-medium focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
      >
        {deal.title}
      </button>

      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums">
          {deal.valueAmount.toLocaleString()} {deal.valueCurrency}
        </span>
        <span>{deal.contactName ?? '—'}</span>
      </div>

      {deal.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {deal.tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="text-[10px]">
              {tag.name}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Button size="sm" variant="outline" className="w-full" onClick={() => setMenuOpen((v) => !v)}>
          Move…
        </Button>
        {menuOpen ? (
          <div className="bg-popover text-popover-foreground absolute end-0 z-20 mt-1 w-44 rounded-lg border p-1 shadow-md">
            <p className="text-muted-foreground px-2 py-1 text-xs">Move to stage</p>
            {nextStages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                disabled={move.isPending}
                onClick={() => {
                  move.mutate({ id: deal.id, stageId: stage.id });
                  setMenuOpen(false);
                }}
                className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-start text-sm focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
              >
                {stage.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
