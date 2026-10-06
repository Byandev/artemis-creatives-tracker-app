import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { User } from '@/lib/api';

const TOKEN_KEY = 'artemis.token';
const USER_KEY = 'artemis.user';

// Keychain (iOS) / Keystore-encrypted SharedPreferences (Android).
// SecureStore has no web implementation, so web falls back to localStorage.
const storage = {
  get: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(key)) : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
  remove: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.removeItem(key)) : SecureStore.deleteItemAsync(key),
};

export type StoredSession = { token: string; user: User };

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const [token, user] = await Promise.all([storage.get(TOKEN_KEY), storage.get(USER_KEY)]);
    return token && user ? { token, user: JSON.parse(user) as User } : null;
  } catch {
    return null;
  }
}

export async function saveSession({ token, user }: StoredSession) {
  await Promise.all([storage.set(TOKEN_KEY, token), storage.set(USER_KEY, JSON.stringify(user))]);
}

export async function clearSession() {
  await Promise.all([storage.remove(TOKEN_KEY), storage.remove(USER_KEY)]);
}
