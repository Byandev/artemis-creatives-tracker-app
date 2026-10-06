import * as Device from 'expo-device';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { ApiError, authApi, type User } from '@/lib/api';
import { clearSession, loadSession, saveSession } from '@/lib/auth-storage';

export type SignInInput = {
  email: string;
  password: string;
  code?: string;
  recoveryCode?: string;
};

type SessionContextValue = {
  /** True until the stored token has been read on launch. */
  isLoading: boolean;
  token: string | null;
  user: User | null;
  /** Throws ApiError; check `body.two_factor_required` to prompt for a 2FA code. */
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Restore the saved session, then confirm the token is still valid.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      if (stored) {
        setToken(stored.token);
        setUser(stored.user);
      }
      setIsLoading(false);

      if (!stored) return;
      try {
        const { user: fresh } = await authApi.me(stored.token);
        if (cancelled) return;
        setUser(fresh);
        await saveSession({ token: stored.token, user: fresh });
      } catch (error) {
        // Revoked or expired token: sign out. Offline: keep the cached session.
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          await clearSession();
          setToken(null);
          setUser(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn({ email, password, code, recoveryCode }: SignInInput) {
    const response = await authApi.login({
      email,
      password,
      device_name: Device.deviceName ?? Device.modelName ?? undefined,
      code: code || undefined,
      recovery_code: recoveryCode || undefined,
    });
    await saveSession({ token: response.token, user: response.user });
    setToken(response.token);
    setUser(response.user);
  }

  async function signOut() {
    const current = token;
    await clearSession();
    setToken(null);
    setUser(null);
    // Revoke the token server-side; local sign-out already happened if this fails.
    if (current) {
      await authApi.logout(current).catch(() => {});
    }
  }

  return (
    <SessionContext value={{ isLoading, token, user, signIn, signOut }}>{children}</SessionContext>
  );
}

export function useSession() {
  const value = use(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
}
