import { Pressable, View } from 'react-native';
import { CircleStop, type Power } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { controllerPressHaptic } from '@/lib/driver-station/haptics';

type Action = {
  label: string; icon: typeof Power; enabled: boolean; className: string;
  iconClassName: string; textClassName: string; onPress: () => void;
};

export function OpModeActionButton({ action, canStop, onStop, compact = false }: {
  action: Action; canStop: boolean; onStop: () => void; compact?: boolean;
}) {
  return (
    <View className={compact ? 'h-12 w-36' : 'h-32 w-32'}>
      <Pressable accessibilityRole="button" accessibilityLabel={action.label} disabled={!action.enabled}
        onPress={() => { controllerPressHaptic(action.label === 'STOP'); action.onPress(); }}
        className={cn(compact ? 'h-12 w-36 flex-row gap-2 rounded-sm' : 'h-32 w-32 rounded-full border-4 border-background',
          'items-center justify-center active:opacity-85', action.className, !action.enabled && 'opacity-40')}>
        <Icon as={action.icon} size={compact ? 24 : 32} className={action.iconClassName} />
        <Text className={cn('text-base font-extrabold', !compact && 'mt-1', action.textClassName)}>{action.label}</Text>
      </Pressable>
      {canStop && action.label !== 'STOP' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Stop initialized OpMode" onPress={() => { controllerPressHaptic(true); onStop(); }}
          className="absolute -bottom-1 -left-2 h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-destructive active:opacity-85">
          <Icon as={CircleStop} size={23} className="text-destructive-foreground" />
        </Pressable>
      ) : null}
    </View>
  );
}
