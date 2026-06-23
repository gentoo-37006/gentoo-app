import { ListChecks } from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';

export default function TasksScreen() {
  return (
    <Screen>
      <ScreenHeader
        title="Tasks"
        description="Organize work into projects and assignable tasks."
      />
      <EmptyState
        icon={ListChecks}
        title="No projects yet"
        description="Create projects with a status and priority, then break them into tasks with assignees, due dates, and tags."
      />
    </Screen>
  );
}
