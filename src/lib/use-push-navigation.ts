import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Platform } from 'react-native';
import { hrefForNotification } from '@/lib/notification-links';

/**
 * Navigate when the user taps an OS push notification — both while the app is
 * running and when the tap cold-started it. Push payloads carry the in-app
 * notification's `data` (plus `type`, for payloads sent by newer send-push).
 */
export function usePushNavigation() {
  const router = useRouter();
  const handledId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (Platform.OS === 'web') return;

    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledId.current === id) return; // cold-start + listener overlap
      handledId.current = id;
      const href = hrefForNotification({
        data: response.notification.request.content.data,
      });
      if (href) router.push(href as never);
    };

    Notifications.getLastNotificationResponseAsync().then(handle);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [router]);
}
