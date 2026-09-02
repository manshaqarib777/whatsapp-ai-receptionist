import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { FormField, TextField } from '@/components/form-field';
import { Textarea } from '@/components/ui/textarea';

/**
 * The field wrapper is the single place the form accessibility rules are enforced,
 * so these are the tests that stop them silently regressing across twenty features.
 */

describe('TextField', () => {
  it('associates the label with the control', () => {
    render(
      <TextField
        label="Business name"
        name="business"
        value="Acme"
        onChange={() => {}}
      />,
    );

    expect(screen.getByLabelText('Business name')).toHaveValue('Acme');
  });

  it('reports every keystroke to the caller', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<TextField label="Email" name="email" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText('Email'), 'a');

    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('marks the control invalid and links the message when there is an error', () => {
    render(
      <TextField
        label="Email"
        name="email"
        value="bad"
        onChange={() => {}}
        error="Enter a valid email address."
      />,
    );

    const field = screen.getByLabelText('Email');
    const message = screen.getByRole('alert');

    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby')).toContain(message.id);
    expect(message).toHaveTextContent('Enter a valid email address.');
  });

  it('exposes no alert while the field is valid', () => {
    render(<TextField label="Email" name="email" value="" onChange={() => {}} />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('describes the control by its hint', () => {
    render(
      <TextField
        label="Website"
        name="website"
        value=""
        onChange={() => {}}
        hint="Shown to customers."
      />,
    );

    const field = screen.getByLabelText('Website');
    const hint = screen.getByText('Shown to customers.');

    expect(field.getAttribute('aria-describedby')).toContain(hint.id);
  });

  it('marks optional fields and leaves required ones unmarked', () => {
    const { rerender } = render(
      <TextField
        label="Website"
        name="website"
        value=""
        onChange={() => {}}
        required={false}
      />,
    );

    expect(screen.getByLabelText(/website.*optional/i)).toBeInTheDocument();

    rerender(<TextField label="Website" name="website" value="" onChange={() => {}} />);

    expect(screen.queryByText('(optional)')).toBeNull();
  });

  it('keeps the error slot in the layout so revealing a message does not shift it', () => {
    // Reserved rather than conditionally rendered: the node exists either way, and is
    // only hidden from sight. A field that grows on error pushes the submit button
    // out from under the pointer mid-click.
    const { container } = render(
      <TextField label="Email" name="email" value="" onChange={() => {}} />,
    );

    expect(container.querySelector('.sr-only')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <TextField
        label="Email"
        name="email"
        value="bad"
        onChange={() => {}}
        error="Enter a valid email address."
        hint="We only use this to contact you."
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('FormField', () => {
  it('wires arbitrary controls with the same label and error plumbing', () => {
    render(
      <FormField label="Greeting" error="Say something.">
        {(field) => <Textarea {...field} />}
      </FormField>,
    );

    const field = screen.getByLabelText('Greeting');

    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field.getAttribute('aria-describedby')).toContain(
      screen.getByRole('alert').id,
    );
  });

  it('gives each instance its own ids', () => {
    render(
      <>
        <FormField label="First">{(field) => <input {...field} />}</FormField>
        <FormField label="Second">{(field) => <input {...field} />}</FormField>
      </>,
    );

    expect(screen.getByLabelText('First').id).not.toBe(
      screen.getByLabelText('Second').id,
    );
  });
});
