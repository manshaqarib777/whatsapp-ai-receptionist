'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export function TotpQrCode({ uri }: { uri: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void QRCode.toString(uri, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 224,
    })
      .then((svg) => {
        if (active) setDataUrl(`data:image/svg+xml,${encodeURIComponent(svg)}`);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [uri]);

  if (error) {
    return (
      <p role="alert" className="text-destructive text-sm">
        Could not draw the QR code. Use the setup key below.
      </p>
    );
  }
  if (!dataUrl)
    return (
      <p role="status" className="text-sm">
        Preparing QR code…
      </p>
    );

  // A data URL is generated locally from the TOTP URI; the secret is never sent to
  // an external QR service. The URI remains visible below for non-visual setup.
  return (
    <Image
      src={dataUrl}
      width={224}
      height={224}
      alt="QR code for authenticator app setup"
      className="rounded-lg border"
      unoptimized
    />
  );
}
