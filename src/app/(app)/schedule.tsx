import { CalendarClock } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';

export default function ScheduleScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Pit schedule"
        description="Auto-generate fair rotations for who staffs the pit."
      />
      <EmptyState
        icon={CalendarClock}
        title="No shifts scheduled"
        description="Set your competition hours and shift length, and the app will build a balanced pit-duty rotation across your team."
      />
    </Screen>
  );
}
