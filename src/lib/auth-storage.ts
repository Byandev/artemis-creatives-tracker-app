import type { User } from '@/lib/api';
import { storage } from '@/lib/storage';

const TOKEN_KEY = 'artemis.token';
const USER_KEY = 'artemis.user';

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
