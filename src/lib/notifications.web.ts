import { ApiError, webPushApi } from '@/lib/api';
import { storage } from '@/lib/storage';

/**
 * Web counterpart of notifications.ts, for the installed web app (PWA). Same exports, but
 * through the browser's Web Push instead of Expo: the service worker (public/push-sw.js)
 * shows each push and opens the app when it's tapped.
 */

const ENABLED_KEY = 'artemis.notifications';
const ENDPOINT_KEY = 'artemis.webPushEndpoint';
export const REVIEWS_CHANNEL = 'reviews';

export type PushData =
  | { type: 'creative_assigned'; creative_id: number }
  | { type: 'pending_reminder'; count: number };

/** expo-notifications doesn't run on web; taps are handled by the service worker instead. */
export function loadNotifications(): null {
  return null;
}

function isIos() {
  // iPadOS reports itself as a Mac, so also check for touch.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Why push can't work in this browser, or null if it can. */
export function pushUnsupportedReason(): string | null {
  // Static rendering runs this in Node, where there's no browser to ask.
  if (typeof window === 'undefined') return null;
  // iPhone only offers Web Push to an app added to the Home Screen.
  if (isIos() && !isInstalled()) {
    return 'On iPhone, add Artemis to your Home Screen first (Share → Add to Home Screen), then open it from there.';
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'This browser can’t receive push notifications.';
  }
  return null;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermissionState(): Promise<PermissionState> {
  if (pushUnsupportedReason() || typeof Notification === 'undefined') return 'undetermined';
  return Notification.permission === 'default' ? 'undetermined' : Notification.permission;
}

export async function isNotificationsEnabled() {
  return (await storage.get(ENABLED_KEY)) === 'true';
}

/** VAPID keys are base64url; PushManager.subscribe wants the raw bytes. */
function keyBytes(base64Url: string) {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** The service worker only ships with the production export (`npm run build:web`). */
async function serviceWorker() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    throw new Error(
      __DEV__
        ? 'Web push needs the service worker, which only ships with `npm run build:web`.'
        : 'Artemis isn’t fully loaded yet. Reload the app and try again.',
    );
  }
  return navigator.serviceWorker.ready;
}

/**
 * Asks for permission, subscribes this browser to Web Push and sends the subscription to Artemis.
 * Throws an Error with a user-facing message if any step fails.
 */
export async function enablePushNotifications(authToken: string) {
  const unsupported = pushUnsupportedReason();
  if (unsupported) throw new Error(unsupported);

  // First, before any other await: Safari only shows the prompt straight from the user's tap.
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked for Artemis in your browser settings.');
  }

  const registration = await serviceWorker();

  let publicKey: string | null;
  try {
    ({ public_key: publicKey } = await webPushApi.key(authToken));
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405)) publicKey = null;
    else throw err;
  }
  if (!publicKey) throw new Error('Artemis can’t send notifications yet. The server side isn’t set up.');

  let subscription = await registration.pushManager.getSubscription();
  // A subscription made with an older server key can't receive pushes signed with the new one.
  const currentKey = subscription?.options.applicationServerKey;
  if (subscription && currentKey && !sameBytes(new Uint8Array(currentKey), keyBytes(publicKey))) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });

  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Couldn’t turn on notifications in this browser.');

  await webPushApi.subscribe(authToken, {
    endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
    content_encoding: PushManager.supportedContentEncodings?.includes('aes128gcm') === false ? 'aesgcm' : 'aes128gcm',
  });

  await Promise.all([storage.set(ENABLED_KEY, 'true'), storage.set(ENDPOINT_KEY, endpoint)]);
}

function sameBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** Removes this browser's subscription on the server and in the browser (e.g. on logout). */
export async function unregisterPushToken(authToken: string) {
  const endpoint = await storage.get(ENDPOINT_KEY);
  if (!endpoint) return;
  await storage.remove(ENDPOINT_KEY);
  await webPushApi.unsubscribe(authToken, endpoint).catch(() => {});
  const registration = await navigator.serviceWorker?.getRegistration();
  await (await registration?.pushManager.getSubscription())?.unsubscribe().catch(() => {});
}

/** Turns notifications off for this browser. Local state is cleared even if the server call fails. */
export async function disablePushNotifications(authToken: string | null) {
  await storage.set(ENABLED_KEY, 'false');
  if (authToken) {
    await unregisterPushToken(authToken);
  } else {
    await storage.remove(ENDPOINT_KEY);
  }
}

/** Re-sends the subscription on launch: browsers rotate them, and the server may have dropped it. */
export async function syncPushToken(authToken: string) {
  if (pushUnsupportedReason() || !(await isNotificationsEnabled())) return;
  if ((await getPermissionState()) !== 'granted') return;
  await enablePushNotifications(authToken).catch(() => {});
}
