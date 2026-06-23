import { Radio } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';

export default function TalkieScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Talkie"
        description="Send a request and ping the pit crew to go talk to a team."
      />
      <EmptyState
        icon={Radio}
        title="No active talkies"
        description="When something happens in a match, raise a talkie here and an available pit member will be notified to go investigate."
      />
    </Screen>
  );
}
