import type { ColumnDef } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';

type Row = { id: string; customer: string; value: number };

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'value', header: 'Value' },
];

const DATA: Row[] = [
  { id: '1', customer: 'Globex Clinic', value: 880 },
  { id: '2', customer: 'Acme Dental', value: 1240 },
  { id: '3', customer: 'Initech Health', value: 2310 },
];

describe('DataTable — success', () => {
  it('renders a row per record', () => {
    render(<DataTable columns={COLUMNS} data={DATA} caption="Customers" />);

    // Header row plus three data rows.
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('describes the table for screen readers', () => {
    render(<DataTable columns={COLUMNS} data={DATA} caption="Customers" />);

    expect(screen.getByRole('table', { name: 'Customers' })).toBeInTheDocument();
  });
});

describe('DataTable — sorting', () => {
  it('exposes sortable columns as buttons, not as decorated text', () => {
    render(<DataTable columns={COLUMNS} data={DATA} caption="Customers" />);

    expect(screen.getByRole('button', { name: /customer/i })).toBeInTheDocument();
  });

  it('reports sort state through aria-sort', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={COLUMNS} data={DATA} caption="Customers" />);

    const header = screen.getByRole('columnheader', { name: /customer/i });
    expect(header).toHaveAttribute('aria-sort', 'none');

    await user.click(screen.getByRole('button', { name: /customer/i }));
    expect(header).toHaveAttribute('aria-sort', 'ascending');

    await user.click(screen.getByRole('button', { name: /customer/i }));
    expect(header).toHaveAttribute('aria-sort', 'descending');
  });

  it('actually reorders the rows', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={COLUMNS} data={DATA} caption="Customers" />);

    await user.click(screen.getByRole('button', { name: /customer/i }));

    const rows = screen.getAllByRole('row');
    // Row 0 is the header.
    expect(within(rows[1] as HTMLElement).getByText('Acme Dental')).toBeInTheDocument();
  });
});

describe('DataTable — pagination', () => {
  const many: Row[] = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    customer: `Customer ${index}`,
    value: index,
  }));

  it('hides pagination when everything fits on one page', () => {
    render(<DataTable columns={COLUMNS} data={DATA} caption="Customers" />);

    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
  });

  it('pages through longer sets', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={COLUMNS} data={many} caption="Customers" pageSize={10} />);

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('DataTable — empty and loading', () => {
  it('explains an empty table and offers the next step', () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        caption="Customers"
        emptyTitle="No customers yet"
        emptyDescription="They appear here once someone messages you."
        emptyAction={<Button>Connect WhatsApp</Button>}
      />,
    );

    // "No data" tells the user nothing and gives them nowhere to go.
    expect(screen.getByText('No customers yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect WhatsApp' })).toBeInTheDocument();
  });

  it('announces loading with the caption, not a bare spinner', () => {
    render(<DataTable columns={COLUMNS} data={[]} caption="Customers" isLoading />);

    expect(screen.getByLabelText('Loading Customers')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });
});

describe('DataTable — accessibility', () => {
  it('has no violations with data', async () => {
    const { container } = render(
      <DataTable columns={COLUMNS} data={DATA} caption="Customers" />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no violations when empty', async () => {
    const { container } = render(
      <DataTable columns={COLUMNS} data={[]} caption="Customers" />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
