import { ShieldCheck } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';

export default function AdminScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Admin"
        description="Approve members and manage team settings."
      />
      <EmptyState
        icon={ShieldCheck}
        title="Admin tools"
        description="Approve or reject new accounts, assign roles, and configure scouting questions. Available once accounts are connected."
      />
    </Screen>
  );
}
