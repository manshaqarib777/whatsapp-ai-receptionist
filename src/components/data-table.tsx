'use client';

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { EmptyState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Data table.
 *
 * Applies COMPONENT_DESIGN.md §5 so no feature has to remember it:
 *   - horizontal rules only, no vertical gridlines, no zebra striping
 *   - sticky header
 *   - sortable headers are real buttons with aria-sort
 *   - loading and empty states are TABLE-SHAPED, not a spinner in a blank box
 *   - a caption for screen readers
 *
 * Row actions are passed by the caller and must use `group-hover:` **plus**
 * `focus-within:`, so keyboard users can reach them.
 */

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Screen-reader description of what the table contains. Required. */
  caption: string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  pageSize?: number;
  density?: 'comfortable' | 'compact';
  className?: string;
};

export function DataTable<TData>({
  columns,
  data,
  caption,
  isLoading = false,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'When there is something to show, it will appear here.',
  emptyAction,
  pageSize = 10,
  density = 'comfortable',
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  /**
   * TanStack Table returns fresh closures over mutable internal state each render,
   * so React Compiler declines to memoise this component — which is the correct
   * outcome, not a defect: memoising it would serve stale rows. Acknowledged here
   * rather than left as a standing warning. The table instance is used only inside
   * this component and never handed to a memoised child, which is the one case the
   * diagnostic warns about.
   */
  // eslint-disable-next-line react-hooks/incompatible-library -- see above
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const rowHeight = density === 'comfortable' ? 'h-14' : 'h-11';

  if (isLoading) {
    return (
      <div className={cn('overflow-hidden rounded-2xl border', className)}>
        <div className="bg-muted h-11 border-b" aria-hidden="true" />
        <div className="p-4">
          <LoadingState rows={5} label={`Loading ${caption}`} />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="overflow-hidden rounded-2xl border">
        <Table>
          <caption className="sr-only">{caption}</caption>

          <TableHeader className="bg-muted sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const direction = header.column.getIsSorted();

                  return (
                    <TableHead
                      key={header.id}
                      // aria-sort is what tells a screen reader the column is sorted;
                      // the arrow icon alone conveys nothing to one.
                      aria-sort={
                        direction === 'asc'
                          ? 'ascending'
                          : direction === 'desc'
                            ? 'descending'
                            : canSort
                              ? 'none'
                              : undefined
                      }
                      className="text-muted-foreground h-11 text-xs font-medium"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="focus-visible:ring-ring -ms-1 flex items-center gap-1 rounded px-1 py-0.5 focus-visible:ring-2 focus-visible:outline-none"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {direction === 'asc' ? (
                            <ArrowUp aria-hidden="true" className="size-3" />
                          ) : direction === 'desc' ? (
                            <ArrowDown aria-hidden="true" className="size-3" />
                          ) : (
                            <ChevronsUpDown
                              aria-hidden="true"
                              className="size-3 opacity-40"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={cn('group', rowHeight)}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
