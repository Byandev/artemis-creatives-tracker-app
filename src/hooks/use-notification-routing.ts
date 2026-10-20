import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { loadNotifications, syncPushToken } from '@/lib/notifications';
import { useSession } from '@/providers/session';

function openFromNotification(response: NotificationResponse | null) {
  const data = response?.notification.request.content.data;
  const creativeId = Number(data?.creative_id);
  if (data?.type === 'creative_assigned' && Number.isInteger(creativeId) && creativeId > 0) {
    router.navigate({ pathname: '/creatives/[id]', params: { id: String(creativeId) } });
  } else if (data?.type === 'creative_assigned' || data?.type === 'pending_reminder') {
    router.navigate('/');
  }
}

/**
 * While signed in: keeps this device's push token registered, and opens the right screen when
 * a review notification is tapped: "assigned" opens that creative, "daily reminder" the list.
 * Does nothing where push isn't available (web, Expo Go on Android).
 */
export function useNotificationRouting() {
  const { token } = useSession();

  useEffect(() => {
    if (token) syncPushToken(token);
  }, [token]);

  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications) return;

    // Tapped while the app was closed, then taps while it's running.
    Notifications.getLastNotificationResponseAsync().then(openFromNotification).catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => subscription.remove();
  }, []);
}
