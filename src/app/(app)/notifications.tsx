import { ActivityIndicator, Pressable, View } from 'react-native';
import {
  Bell,
  Radio,
  ClipboardList,
  CalendarClock,
  ShieldCheck,
  ListChecks,
  CheckCheck,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { ConfirmationButton } from '@/components/ui/delete-button';
import { useRouter } from 'expo-router';
import { timeAgo } from '@/lib/format';
import { hrefForNotification } from '@/lib/notification-links';
import type { AppNotification, NotificationType } from '@/lib/types';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useClearNotification,
  useClearAllNotifications,
} from '@/lib/queries/notifications';

const ICONS: Record<NotificationType, LucideIcon> = {
  talkie_request: Radio,
  talkie_claimed: Radio,
  talkie_resolved: Radio,
  match_report: ClipboardList,
  assignment: CalendarClock,
  approval: ShieldCheck,
  task: ListChecks,
  general: Bell,
};

function NotificationRow({ item, onPress, onClear }: { item: AppNotification; onPress: () => void; onClear: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card className={item.read ? '' : 'border-primary/40 bg-primary/5'}>
        <View className="flex-row items-start gap-3 p-4">
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <Icon as={ICONS[item.type] ?? Bell} size={20} className="text-primary" />
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1 font-semibold" numberOfLines={1}>
                {item.title}
              </Text>
              {!item.read ? <View className="h-2 w-2 rounded-sm bg-primary" /> : null}
            </View>
            {item.body ? <Text variant="muted">{item.body}</Text> : null}
            <Text variant="small">{timeAgo(item.created_at)}</Text>
          </View>
          <ConfirmationButton
            variant="ghost"
            size="icon"
            icon={X}
            confirmationAction="clear"
            onPress={onClear}
            className="-mr-2 h-8 w-8"
            accessibilityLabel="Clear notification"
          />
        </View>
      </Card>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const clearNotification = useClearNotification();
  const clearAll = useClearAllNotifications();
  const router = useRouter();
  const notifications = data ?? [];
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <Screen maxWidth="max-w-2xl">
      <ScreenHeader title="Notifications" description="Talkie pings, submissions, and assignments.">
        {notifications.length > 0 ? (
          <View className="flex-row items-center gap-2">
            {hasUnread ? (
              <Button
                variant="outline"
                size="sm"
                label="Mark all read"
                icon={CheckCheck}
                loading={markAll.isPending}
                onPress={() => markAll.mutate()}
              />
            ) : null}
            <ConfirmationButton
              variant="outline"
              size="sm"
              label="Clear all"
              confirmationAction="clear all"
              loading={clearAll.isPending}
              onPress={() => clearAll.mutate()}
            />
          </View>
        ) : null}
      </ScreenHeader>

      {isLoading ? (
        <View className="py-12">
          <ActivityIndicator />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You’re all caught up"
          description="Notifications about talkies, match-report submissions, and your assignments will show up here."
        />
      ) : (
        <View className="gap-2">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              item={n}
              onPress={() => {
                if (!n.read) markRead.mutate(n.id);
                const href = hrefForNotification(n);
                if (href) router.push(href as never);
              }}
              onClear={() => clearNotification.mutate(n.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
