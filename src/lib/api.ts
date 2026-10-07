import type { AssignedCreative } from '@/lib/creatives';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const TIMEOUT_MS = 15_000;

// ngrok's free tier answers browser-like requests with an HTML warning page unless this is set.
const TUNNEL_HEADERS: Record<string, string> = BASE_URL?.includes('ngrok')
  ? { 'ngrok-skip-browser-warning': 'true' }
  : {};

export type User = { id: number; name: string; email: string };

/** A failed API call. `status` is 0 when the request never got a response. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** First message per field from a Laravel 422 response. */
  get fieldErrors(): Record<string, string> {
    const errors = this.body.errors as Record<string, string[]> | undefined;
    return Object.fromEntries(Object.entries(errors ?? {}).map(([field, messages]) => [field, messages[0]]));
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError('EXPO_PUBLIC_API_URL is not set. Add it to .env and restart Expo.', 0);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const url = `${BASE_URL}/api/v1/creatives-tracker${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...TUNNEL_HEADERS,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (__DEV__) console.warn(`[api] ${method} ${url} failed:`, error);
    throw new ApiError("Can't reach Artemis. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timeout);
  }

  // 204 No Content (e.g. push-token register/delete) is success with no body.
  if (response.status === 204) {
    return {} as T;
  }

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  // Dev-only trace. Never logs the request body, which may hold a password.
  if (__DEV__) console.log(`[api] ${method} ${url} → ${response.status}`, response.ok ? '' : data);

  // Not JSON at all: a tunnel/proxy page (e.g. an offline Expose or ngrok URL), not the API.
  // Treat it like no response, so screens show "can't reach" instead of a generic error.
  if (data === null) {
    throw new ApiError("Can't reach Artemis. The server address may be offline.", 0, { httpStatus: response.status });
  }

  if (!response.ok) {
    const body = data;
    const message =
      (typeof body.error === 'string' && body.error) ||
      (typeof body.message === 'string' && body.message) ||
      (response.status === 429 ? 'Too many attempts. Wait a minute and try again.' : 'Something went wrong. Try again.');
    throw new ApiError(message, response.status, body);
  }

  return data as T;
}

// Endpoints

export type LoginInput = {
  email: string;
  password: string;
  device_name?: string;
  code?: string;
  recovery_code?: string;
};

export type LoginResponse = { token: string; token_type: 'Bearer'; user: User };

export type AssignedCreativesParams = {
  search?: string;
  format?: 'all' | 'image' | 'video';
  /** Workspace slug */
  workspace?: string;
  perPage?: number;
  /** `next_cursor` from the previous page */
  cursor?: string | null;
};

/** Laravel cursor pagination, plus the total number of matching creatives. */
export type AssignedCreativesPage = {
  data: AssignedCreative[];
  next_cursor: string | null;
  per_page: number;
  total: number;
};

function toQuery(params: Record<string, string | number | null | undefined>) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

export const creativesApi = {
  assigned: (token: string, { search, format, workspace, perPage, cursor }: AssignedCreativesParams = {}) =>
    apiRequest<AssignedCreativesPage>(
      `/creatives/assigned${toQuery({
        search: search?.trim(),
        format: format === 'all' ? undefined : format,
        workspace,
        per_page: perPage,
        cursor,
      })}`,
      { token },
    ),
};

/** Push token registration. Backend contract: docs/push-notifications-backend.md */
export type PushTokenInput = {
  token: string;
  platform: 'ios' | 'android';
  device_name?: string;
};

export const notificationsApi = {
  registerToken: (token: string, input: PushTokenInput) =>
    apiRequest<unknown>('/push-token', { method: 'POST', body: input, token }),
  unregisterToken: (token: string, pushToken: string) =>
    apiRequest<unknown>('/push-token', { method: 'DELETE', body: { token: pushToken }, token }),
};

/** The daily "creatives waiting" push. `time` is 24-hour "HH:mm" in `timezone` (Asia/Manila). */
export type DailyReminder = { enabled: boolean; time: string; timezone: string };

export const reminderApi = {
  get: (token: string) => apiRequest<{ daily_reminder: DailyReminder }>('/reminder-settings', { token }),
  update: (token: string, input: { enabled: boolean; time: string }) =>
    apiRequest<{ daily_reminder: DailyReminder }>('/reminder-settings', { method: 'PUT', body: input, token }),
};

export const authApi = {
  login: (input: LoginInput) => apiRequest<LoginResponse>('/login', { method: 'POST', body: input }),
  me: (token: string) => apiRequest<{ user: User }>('/me', { token }),
  logout: (token: string) => apiRequest<{ message: string }>('/logout', { method: 'POST', token }),
};
