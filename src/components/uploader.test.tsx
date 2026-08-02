import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Uploader, formatBytes } from '@/components/uploader';

function file(name: string, type: string, sizeBytes: number): File {
  const blob = new File(['x'], name, { type });
  Object.defineProperty(blob, 'size', { value: sizeBytes });
  return blob;
}

describe('formatBytes', () => {
  it('renders zero without a decimal', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('renders bytes without a decimal', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('renders kilobytes and megabytes to one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('Uploader', () => {
  it('states the limits up front rather than after a rejection', () => {
    render(<Uploader maxFiles={3} maxSizeBytes={5 * 1024 * 1024} />);

    expect(screen.getByText(/up to 3 files, 5.0 MB each/i)).toBeInTheDocument();
  });

  it('offers a keyboard route as well as drag and drop', () => {
    // Dragging cannot be the only way in — WCAG 2.5.7 requires a single-pointer
    // alternative, and a keyboard user has neither.
    render(<Uploader />);

    expect(screen.getByLabelText(/drop files here, or browse/i)).toBeInTheDocument();
  });

  it('lists a selected file with its size', async () => {
    const user = userEvent.setup();
    render(<Uploader accept="image/*" />);

    await user.upload(
      screen.getByLabelText(/drop files here/i),
      file('logo.png', 'image/png', 2048),
    );

    expect(screen.getByText('logo.png')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('rejects a file over the size limit and says why', async () => {
    const user = userEvent.setup();
    render(<Uploader maxSizeBytes={1024} />);

    await user.upload(
      screen.getByLabelText(/drop files here/i),
      file('huge.png', 'image/png', 4096),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/too large. maximum 1.0 KB/i);
  });

  it('rejects a dropped file whose type is not accepted', async () => {
    // Dropped, not picked: the file dialog already filters by `accept`, so drag and
    // drop is the path where the component's own check is the only one there is.
    const { container } = render(<Uploader accept="image/*" />);
    const dropZone = container.querySelector('[class*="border-dashed"]') as HTMLElement;

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file('notes.txt', 'text/plain', 100)] },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/not accepted/i);
  });

  it('accepts a file matched by extension rather than MIME type', async () => {
    const user = userEvent.setup();
    render(<Uploader accept="image/*,.pdf" />);

    await user.upload(
      screen.getByLabelText(/drop files here/i),
      file('invoice.pdf', 'application/pdf', 100),
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not attempt to upload a file it has already rejected', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockResolvedValue(undefined);

    render(<Uploader accept="image/*" onUpload={onUpload} />);

    await user.upload(
      screen.getByLabelText(/drop files here/i),
      file('notes.txt', 'text/plain', 100),
    );

    expect(onUpload).not.toHaveBeenCalled();
  });

  it('reports a failed upload without losing the file from the list', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn().mockRejectedValue(new Error('network'));

    render(<Uploader onUpload={onUpload} />);

    await user.upload(
      screen.getByLabelText(/drop files here/i),
      file('logo.png', 'image/png', 100),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/upload failed/i);
    expect(screen.getByText('logo.png')).toBeInTheDocument();
  });

  it('lets the user remove a file', async () => {
    const user = userEvent.setup();
    render(<Uploader />);

    await user.upload(
      screen.getByLabelText(/drop files here/i),
      file('logo.png', 'image/png', 100),
    );
    await user.click(screen.getByRole('button', { name: 'Remove logo.png' }));

    expect(screen.queryByText('logo.png')).toBeNull();
  });

  it('refuses more files than the limit allows', async () => {
    const user = userEvent.setup();
    render(<Uploader maxFiles={1} />);

    const input = screen.getByLabelText(/drop files here/i);
    await user.upload(input, file('one.png', 'image/png', 100));
    await user.upload(input, file('two.png', 'image/png', 100));

    expect(screen.getByText('one.png')).toBeInTheDocument();
    expect(screen.queryByText('two.png')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Uploader />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
