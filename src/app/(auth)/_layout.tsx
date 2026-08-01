import { Stack } from 'expo-router';
import { DragOverlayProvider } from '@/components/drag-overlay';

export default function AuthLayout() {
  return (
    <DragOverlayProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </DragOverlayProvider>
  );
}
