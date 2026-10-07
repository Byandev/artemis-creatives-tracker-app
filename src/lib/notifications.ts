import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { ApiError, notificationsApi } from '@/lib/api';
import { storage } from '@/lib/storage';

const ENABLED_KEY = 'artemis.notifications';
const PUSH_TOKEN_KEY = 'artemis.pushToken';
export const REVIEWS_CHANNEL = 'reviews';

/**
 * Data the backend puts on each push, so taps can route to the right place.
 * - creative_assigned: a creative was assigned to this reviewer
 * - pending_reminder: daily "N creatives waiting" reminder
 */
export type PushData =
  | { type: 'creative_assigned'; creative_id: number }
  | { type: 'pending_reminder'; count: number };

/** Expo Go on Android dropped push in SDK 53, and importing expo-notifications there throws. */
const isExpoGoAndroid = Platform.OS === 'android' && isRunningInExpoGo();

let notificationsModule: typeof NotificationsModule | null | undefined;

/**
 * expo-notifications, loaded on first use, or null where it can't run (web, Expo Go on Android).
 * Never import it statically: on Expo Go Android the import itself crashes the app.
 */
export function loadNotifications(): typeof NotificationsModule | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (Platform.OS === 'web' || isExpoGoAndroid) {
    notificationsModule = null;
    return null;
  }
  notificationsModule = require('expo-notifications') as typeof NotificationsModule;
  // Show notifications as banners even while the app is open.
  notificationsModule.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  return notificationsModule;
}

/** Why push can't work in this build, or null if it can. */
export function pushUnsupportedReason(): string | null {
  if (Platform.OS === 'web') return 'Push notifications are only available in the mobile app.';
  if (!Device.isDevice && Platform.OS === 'android') return 'Use a real phone or an emulator with Google Play to test notifications.';
  if (isExpoGoAndroid) {
    return 'Expo Go on Android can’t receive push notifications. Use a development build.';
  }
  if (!projectId()) return 'Notifications aren’t set up for this build yet (missing EAS project ID).';
  return null;
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  const Notifications = loadNotifications();
  if (!Notifications) return 'undetermined';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function isNotificationsEnabled() {
  return (await storage.get(ENABLED_KEY)) === 'true';
}

/**
 * Asks for permission, gets this device's Expo push token and sends it to Artemis.
 * Throws an Error with a user-facing message if any step fails.
 */
export async function enablePushNotifications(authToken: string) {
  const unsupported = pushUnsupportedReason();
  const Notifications = loadNotifications();
  if (unsupported || !Notifications) throw new Error(unsupported ?? 'Push notifications aren’t available here.');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REVIEWS_CHANNEL, {
      name: 'Creative reviews',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#047857',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    throw new Error('Notifications are turned off for Artemis in your phone settings.');
  }

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  // Dev only: copy this into https://expo.dev/notifications to send a test push before the backend is ready.
  if (__DEV__) console.log(`[push] Expo push token: ${pushToken}`);

  try {
    await notificationsApi.registerToken(authToken, {
      token: pushToken,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      device_name: Device.deviceName ?? Device.modelName ?? undefined,
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
      throw new Error('Artemis can’t send notifications yet. The server side isn’t set up.');
    }
    throw err;
  }

  await Promise.all([storage.set(ENABLED_KEY, 'true'), storage.set(PUSH_TOKEN_KEY, pushToken)]);
}

/** Removes this device's token on the server (e.g. on logout). Keeps the user's on/off choice. */
export async function unregisterPushToken(authToken: string) {
  const pushToken = await storage.get(PUSH_TOKEN_KEY);
  if (!pushToken) return;
  await storage.remove(PUSH_TOKEN_KEY);
  await notificationsApi.unregisterToken(authToken, pushToken).catch(() => {});
}

/** Turns notifications off for this device. Local state is cleared even if the server call fails. */
export async function disablePushNotifications(authToken: string | null) {
  await storage.set(ENABLED_KEY, 'false');
  if (authToken) {
    await unregisterPushToken(authToken);
  } else {
    await storage.remove(PUSH_TOKEN_KEY);
  }
}

/** Re-sends the token on launch: Expo push tokens can change, and the server may have dropped it. */
export async function syncPushToken(authToken: string) {
  if (pushUnsupportedReason() || !(await isNotificationsEnabled())) return;
  if ((await getPermissionState()) !== 'granted') return;
  await enablePushNotifications(authToken).catch(() => {});
}
