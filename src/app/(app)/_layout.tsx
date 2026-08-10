import { Slot, usePathname } from 'expo-router';
import { ResponsiveShell } from '@/components/responsive-shell';
import { WhatsNewGate } from '@/components/whats-new';
import { useAuth } from '@/lib/auth';
import { usePushNavigation } from '@/lib/use-push-navigation';
import { DragOverlayProvider } from '@/components/drag-overlay';

export default function AppLayout() {
  const pathname = usePathname();
  const { session, profile } = useAuth();
  usePushNavigation();
  const isStandaloneDownloads =
    pathname === '/downloads' && (!session || profile?.status !== 'approved');

  if (isStandaloneDownloads) return <Slot />;

  return (
    <DragOverlayProvider>
      <ResponsiveShell>
        <Slot />
        <WhatsNewGate />
      </ResponsiveShell>
    </DragOverlayProvider>
  );
}
