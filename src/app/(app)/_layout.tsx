import { Slot, usePathname } from 'expo-router';
import { ResponsiveShell } from '@/components/responsive-shell';
import { WhatsNewGate } from '@/components/whats-new';
import { useAuth } from '@/lib/auth';
import { usePushNavigation } from '@/lib/use-push-navigation';

export default function AppLayout() {
  const pathname = usePathname();
  const { session } = useAuth();
  usePushNavigation();
  const isDownloads = pathname === '/downloads';

  if (isDownloads && !session) return <Slot />;

  return (
    <ResponsiveShell>
      <Slot />
      <WhatsNewGate />
    </ResponsiveShell>
  );
}
