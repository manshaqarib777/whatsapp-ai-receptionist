'use client';

/**
 * Root error boundary — catches failures in the root layout itself, where the
 * normal error.tsx boundary cannot render. Must supply its own <html>/<body>.
 * Deliberately dependency-free: if the layout is broken, imports may be too.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: '#666', maxWidth: '28rem', fontSize: '0.875rem' }}>
          The application failed to load. Please try again.
          {error.digest ? ` Reference: ${error.digest}` : ''}
        </p>
        <button
          onClick={reset}
          style={{
            borderRadius: '0.75rem',
            border: '1px solid #ddd',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            font: 'inherit',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
