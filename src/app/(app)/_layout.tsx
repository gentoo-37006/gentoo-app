import { Slot, usePathname } from 'expo-router';
import { ResponsiveShell } from '@/components/responsive-shell';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const pathname = usePathname();
  const { session } = useAuth();
  const isDownloads = pathname === '/downloads';

  if (isDownloads && !session) return <Slot />;

  return (
    <ResponsiveShell>
      <Slot />
    </ResponsiveShell>
  );
}
