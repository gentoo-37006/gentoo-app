import { View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { opModesForCategory, type OpModeCategory } from '@/lib/driver-station/opmode-selection';
import type { DriverStationSnapshot } from '@/lib/driver-station/client';

export function OpModePicker({ opModes, selected, connected, onSelect }: {
  opModes: DriverStationSnapshot['opModes'];
  selected: string | null;
  connected: boolean;
  onSelect: (name: string, category: OpModeCategory) => void;
}) {
  const categories: OpModeCategory[] = ['AUTONOMOUS', 'TELEOP'];
  if (opModesForCategory(opModes, 'OTHER').length) categories.push('OTHER');
  return (
    <View>
      <View className="flex-row gap-2">
        {categories.map((category) => {
          const label = category === 'AUTONOMOUS' ? 'Autonomous' : category === 'TELEOP' ? 'TeleOp' : 'Other';
          const options = opModesForCategory(opModes, category).map(({ name }) => ({ value: name, label: name }));
          return (
            <View key={category} className="min-w-0 flex-1">
              <Select options={options} value={selected} onChange={(name) => onSelect(name, category)}
                className="rounded-sm px-2"
                triggerContent={<View className="flex-row items-center justify-between gap-1"><Text className="text-xs font-bold">{label}</Text><Icon as={ChevronDown} size={16} className="text-foreground" /></View>} />
            </View>
          );
        })}
      </View>
      <Text className="mt-2 text-sm font-medium" numberOfLines={1}>
        {connected ? selected ?? 'Select an OpMode...' : 'Waiting for Control Hub...'}
      </Text>
    </View>
  );
}
