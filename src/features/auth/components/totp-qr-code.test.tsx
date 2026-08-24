import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TotpQrCode } from '@/features/auth/components/totp-qr-code';

const toString = vi.fn();
vi.mock('qrcode', () => ({
  default: { toString: (...args: unknown[]) => toString(...args) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  toString.mockResolvedValue('<svg>qr</svg>');
});

describe('TotpQrCode', () => {
  it('renders a locally generated, labelled QR image', async () => {
    render(<TotpQrCode uri="otpauth://totp/example" />);
    const image = await screen.findByRole('img', { name: /authenticator app setup/i });
    expect(image.getAttribute('src')).toContain('data:image/svg+xml');
    expect(toString).toHaveBeenCalledWith('otpauth://totp/example', expect.any(Object));
  });

  it('keeps a recoverable error state', async () => {
    toString.mockRejectedValue(new Error('encoding unavailable'));
    render(<TotpQrCode uri="otpauth://totp/example" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/setup key below/i);
  });
});
