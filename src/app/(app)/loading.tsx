import { LoadingState } from '@/components/states';

export default function AppLoading() {
  return (
    <main className="p-6" aria-label="Loading page">
      <LoadingState rows={8} label="Loading page" />
    </main>
  );
}
