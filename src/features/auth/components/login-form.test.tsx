import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/features/auth/components/login-form';

/**
 * Component tests for the sign-in form.
 *
 * The enumeration assertion is a security test, not a copy test: if the error
 * message ever distinguishes "no such account" from "wrong password", the form
 * becomes an account-enumeration oracle.
 */

const push = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(''),
}));

const signInEmail = vi.fn();
const signInMagicLink = vi.fn();
const signInSocial = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => signInEmail(...args),
      magicLink: (...args: unknown[]) => signInMagicLink(...args),
      social: (...args: unknown[]) => signInSocial(...args),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  signInEmail.mockResolvedValue({ data: { user: {} }, error: null });
  signInMagicLink.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('LoginForm — rendering', () => {
  it('renders labelled email and password fields', () => {
    render(<LoginForm providers={[]} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('does not render OAuth buttons when no provider is configured', () => {
    render(<LoginForm providers={[]} />);

    expect(screen.queryByRole('button', { name: /continue with/i })).toBeNull();
  });

  it('renders a button for each configured provider', () => {
    render(<LoginForm providers={['google', 'github']} />);

    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with github/i }),
    ).toBeInTheDocument();
  });
});

describe('LoginForm — validation', () => {
  it('reports an invalid email without calling the API', async () => {
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('requires a password', async () => {
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'alex@example.com');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/enter your password/i)).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });
});

describe('LoginForm — enumeration resistance', () => {
  it('shows an identical message whether the account exists or the password is wrong', async () => {
    const user = userEvent.setup();

    // Case 1: unknown account.
    signInEmail.mockResolvedValueOnce({ data: null, error: { status: 401 } });
    const { unmount } = render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const unknownAccountMessage = (await screen.findByRole('alert')).textContent;
    unmount();

    // Case 2: known account, wrong password.
    signInEmail.mockResolvedValueOnce({ data: null, error: { status: 401 } });
    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'real@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong password here');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const wrongPasswordMessage = (await screen.findByRole('alert')).textContent;

    expect(unknownAccountMessage).toBe(wrongPasswordMessage);
  });

  it('never says the account does not exist', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValueOnce({ data: null, error: { status: 401 } });

    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const message = (await screen.findByRole('alert')).textContent?.toLowerCase() ?? '';

    expect(message).not.toContain('no account');
    expect(message).not.toContain('not found');
    expect(message).not.toContain('does not exist');
    expect(message).not.toContain('unregistered');
  });
});

describe('LoginForm — submission', () => {
  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolve: (value: unknown) => void = () => {};
    signInEmail.mockReturnValueOnce(new Promise((r) => (resolve = r)));

    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled();

    resolve({ data: { user: {} }, error: null });
  });

  it('preserves the typed email after a failed submit', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValueOnce({ data: null, error: { status: 401 } });

    render(<LoginForm providers={[]} />);

    const emailField = screen.getByLabelText(/email/i);
    await user.type(emailField, 'alex@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await screen.findByRole('alert');

    expect(emailField).toHaveValue('alex@example.com');
  });

  it('redirects to the two-factor challenge when a second factor is required', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValueOnce({
      data: { twoFactorRedirect: true },
      error: null,
    });

    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(expect.stringContaining('/two-factor'));
    });
  });
});

describe('LoginForm — magic link', () => {
  it('switches to magic-link mode and hides the password field', async () => {
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    await user.click(screen.getByRole('button', { name: /sign in with a link/i }));

    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(
      screen.getByRole('button', { name: /send sign-in link/i }),
    ).toBeInTheDocument();
  });

  it('confirms without revealing whether the account exists', async () => {
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    await user.click(screen.getByRole('button', { name: /sign in with a link/i }));
    await user.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /send sign-in link/i }));

    const status = await screen.findByRole('status');

    expect(status).toHaveTextContent(/if an account exists/i);
  });
});

describe('LoginForm — accessibility', () => {
  it('marks an invalid field with aria-invalid and links the message', async () => {
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    await user.type(screen.getByLabelText(/email/i), 'bad');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    const field = await screen.findByLabelText(/email/i);

    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(field).toHaveAttribute('aria-describedby');
  });

  it('focuses the email field on mount so the form is usable without a mouse', () => {
    render(<LoginForm providers={[]} />);

    expect(screen.getByLabelText(/email/i)).toHaveFocus();
  });

  it('moves through the form in reading order by keyboard', async () => {
    const user = userEvent.setup();
    render(<LoginForm providers={[]} />);

    // Email already holds focus (autoFocus), so the first Tab reaches the password.
    await user.tab();
    expect(screen.getByLabelText(/password/i)).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toHaveFocus();
  });
});
