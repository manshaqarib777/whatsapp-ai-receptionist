import { SystemStatus } from '@/features/health/components/system-status';

/**
 * Milestone 1 scaffold page.
 *
 * Exists only to prove the foundation is wired end to end. The design system is
 * Milestone 3 and the real dashboard is Milestone 5 — this page is replaced then,
 * and no product UI should be added here in the meantime.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <div className="max-w-lg space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          WhatsApp AI Receptionist
        </h1>
        <p className="text-muted-foreground text-sm">
          Milestone 1 — project foundation. Tooling, database, logging, error handling,
          and health checks are in place.
        </p>
      </div>

      <SystemStatus />
    </main>
  );
}
