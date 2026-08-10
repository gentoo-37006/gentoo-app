import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, Moon, Sun } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { Button } from '@/components/ui/button';
import { useThemeMode } from '@/lib/theme-mode';

export function ThemeToggleButton() {
  const { colorScheme } = useColorScheme();
  const { setMode } = useThemeMode();
  const isDark = colorScheme === 'dark';
  const target = isDark ? 'light' : 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      icon={isDark ? Sun : Moon}
      accessibilityLabel={`Switch to ${target} mode`}
      onPress={() => setMode(target)}
    />
  );
}

export function AuthScreenActions() {
  const router = useRouter();

  return (
    <View className="flex-row gap-2">
      <Button
        variant="outline"
        size="icon"
        icon={Download}
        accessibilityLabel="Open downloads"
        onPress={() => router.push('/downloads')}
      />
      <ThemeToggleButton />
    </View>
  );
}
