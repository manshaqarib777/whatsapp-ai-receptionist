'use client';

import { unstable_catchError as catchError, type ErrorInfo } from 'next/error';

import { ErrorState } from '@/components/states';

type DashboardWidgetBoundaryProps = {
  title: string;
};

export function DashboardWidgetFallback(
  { title }: DashboardWidgetBoundaryProps,
  { unstable_retry: retry }: ErrorInfo,
) {
  return (
    <ErrorState
      title={`${title} could not be loaded`}
      description="The rest of your dashboard is still available. Try this section again."
      onRetry={retry}
    />
  );
}

export const DashboardWidgetBoundary = catchError(DashboardWidgetFallback);
