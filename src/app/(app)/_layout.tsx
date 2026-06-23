import { Slot } from 'expo-router';
import { ResponsiveShell } from '@/components/responsive-shell';

export default function AppLayout() {
  return (
    <ResponsiveShell>
      <Slot />
    </ResponsiveShell>
  );
}
