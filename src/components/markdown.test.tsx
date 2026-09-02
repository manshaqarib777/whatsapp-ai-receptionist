import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { Markdown } from '@/components/markdown';

/**
 * Sanitisation tests.
 *
 * These are security tests, not rendering tests. Markdown is the one place in the
 * product where user-authored content becomes markup, so each payload below is a
 * real injection technique and each assertion is that it did not work.
 */

describe('Markdown — rendering', () => {
  it('renders headings, emphasis, and lists', () => {
    render(<Markdown>{'## Hours\n\nWe are **open**.\n\n- Monday\n- Tuesday'}</Markdown>);

    expect(screen.getByRole('heading', { name: 'Hours' })).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders GitHub-flavoured tables', () => {
    render(<Markdown>{'| Day | Open |\n| --- | --- |\n| Mon | 9am |'}</Markdown>);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '9am' })).toBeInTheDocument();
  });

  it('opens external links safely', () => {
    render(<Markdown>{'[Book](https://example.com)'}</Markdown>);

    const link = screen.getByRole('link', { name: 'Book' });

    expect(link).toHaveAttribute('href', 'https://example.com');
    // Without noopener the opened page can navigate this one via window.opener.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <Markdown>{'## Hours\n\nWe are **open** [today](https://example.com).'}</Markdown>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('Markdown — sanitisation', () => {
  it('renders a script tag as text rather than executing it', () => {
    const { container } = render(
      <Markdown>{'<script>window.pwned = true</script>'}</Markdown>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/window.pwned = true/)).toBeInTheDocument();
  });

  it('does not render an img with an onerror handler', () => {
    const { container } = render(
      <Markdown>{'<img src="x" onerror="window.pwned = true">'}</Markdown>,
    );

    expect(container.querySelector('img')).toBeNull();
  });

  it('does not render an injected iframe', () => {
    const { container } = render(
      <Markdown>{'<iframe src="https://evil.example"></iframe>'}</Markdown>,
    );

    expect(container.querySelector('iframe')).toBeNull();
  });

  it('strips a javascript: link but keeps its text', () => {
    render(<Markdown>{'[Click me](javascript:alert(1))'}</Markdown>);

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('strips a data: link', () => {
    render(
      <Markdown>
        {'[Click me](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'}
      </Markdown>,
    );

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('strips a vbscript: link', () => {
    render(<Markdown>{'[Click me](vbscript:msgbox(1))'}</Markdown>);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('is not fooled by a mixed-case or padded protocol', () => {
    render(<Markdown>{'[Click me](JaVaScRiPt&#58;alert(1))'}</Markdown>);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('keeps relative and anchor links, which are same-origin', () => {
    render(<Markdown>{'[Settings](/settings) and [top](#top)'}</Markdown>);

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByRole('link', { name: 'top' })).toHaveAttribute('href', '#top');
  });

  it('keeps mailto links', () => {
    render(<Markdown>{'[Email us](mailto:hello@example.com)'}</Markdown>);

    expect(screen.getByRole('link', { name: 'Email us' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
  });
});
