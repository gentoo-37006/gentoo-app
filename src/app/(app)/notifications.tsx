import { Bell } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotificationsScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Notifications"
        description="Talkie pings, scouting submissions, and assignments."
      />
      <EmptyState
        icon={Bell}
        title="You’re all caught up"
        description="Notifications about talkies, match-report submissions, and your assignments will show up here."
      />
    </Screen>
  );
}
