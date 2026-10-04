import { lazy, Suspense, useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { Route, Routes } from 'react-router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { HomePage } from '@/pages/HomePage';
import { ScxnLoader } from '@/components/brand/ScxnLoader';
import { useSettings } from '@/stores/settingsStore';

const RoomEntryPage = lazy(() =>
  import('@/pages/RoomEntryPage').then((m) => ({ default: m.RoomEntryPage })),
);

export function App() {
  const reduced = useSettings((s) => s.reducedMotion);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <TooltipProvider delayDuration={300}>
        <Suspense
          fallback={
            <div className="flex h-dvh items-center justify-center">
              <ScxnLoader
                title="Preparando sua sala…"
                description="Carregando os controles de tela e voz."
              />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:code" element={<RoomEntryPage />} />
            <Route path="*" element={<HomePage notFound />} />
          </Routes>
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </MotionConfig>
  );
}
