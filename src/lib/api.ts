import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { Creative, FinalStatus, Region, ReviewStatus } from '@/lib/creatives';

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
  // FormData (file uploads) sets its own multipart Content-Type with the boundary.
  const isForm = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        ...TUNNEL_HEADERS,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
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

/** Laravel cursor pagination, plus how many match and how many of those still need your review. */
export type AssignedCreativesPage = {
  data: Creative[];
  next_cursor: string | null;
  per_page: number;
  total: number;
  to_review: number;
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
  show: (token: string, id: number) => apiRequest<{ data: Creative }>(`/creatives/${id}`, { token }),
  /** Needs `permissions.update_final_status`. */
  updateFinalStatus: (token: string, id: number, finalStatus: FinalStatus) =>
    apiRequest<{ data: Creative }>(`/creatives/${id}/final-status`, {
      method: 'PATCH',
      body: { final_status: finalStatus },
      token,
    }),
  /**
   * Needs `permissions.review`. A status is required; feedback, a voice message, an area of the
   * image (uploaded images only) and a second of the video (videos only) are optional.
   */
  review: async (token: string, id: number, input: ReviewInput) => {
    if (!input.voice) {
      const { status, feedback, region, timestampSeconds } = input;
      return apiRequest<{ data: Creative }>(`/creatives/${id}/reviews`, {
        method: 'POST',
        body: { status, feedback, region: region ?? undefined, timestamp_seconds: timestampSeconds ?? undefined },
        token,
      });
    }
    const form = new FormData();
    form.append('status', input.status);
    if (input.feedback) form.append('feedback', input.feedback);
    if (input.timestampSeconds != null) form.append('timestamp_seconds', String(input.timestampSeconds));
    // Laravel reads region[x]… back into an array.
    if (input.region) {
      for (const [key, value] of Object.entries(input.region)) form.append(`region[${key}]`, String(value));
    }
    form.append('voice_duration_seconds', String(Math.round(input.voice.durationSeconds)));
    await appendFile(form, 'voice', input.voice.uri, input.voice.mimeType);
    return apiRequest<{ data: Creative }>(`/creatives/${id}/reviews`, { method: 'POST', body: form, token });
  },
  /** Only your own reviews (`review.can_delete`). Returns the creative without it. */
  deleteReview: (token: string, id: number, reviewId: number) =>
    apiRequest<{ data: Creative }>(`/creatives/${id}/reviews/${reviewId}`, { method: 'DELETE', token }),
};

export type ReviewInput = {
  status: ReviewStatus;
  feedback?: string;
  /** A recording from the device: a file:// path on phones, a blob: URL on the web. */
  voice?: { uri: string; mimeType: string; durationSeconds: number };
  /** The area of the image the review points at. */
  region?: Region | null;
  /** The second of the video the review points at (video creatives only). */
  timestampSeconds?: number | null;
};

const EXTENSIONS: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/ogg': 'ogg' };

/** Adds a local file to a multipart form, the way each platform's fetch expects it. */
async function appendFile(form: FormData, field: string, uri: string, mimeType: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const type = blob.type || mimeType;
    form.append(field, blob, `${field}.${EXTENSIONS[type.split(';')[0]] ?? 'webm'}`);
    return;
  }
  // Expo's fetch (the global one since SDK 57) can't send React Native's `{ uri, name, type }`
  // parts: it throws before the request goes out. A file-system `File` it reads itself.
  form.append(field, new File(uri) as unknown as Blob);
}

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

/** A browser's Web Push subscription (`PushSubscription.toJSON()`), for the installed web app. */
export type WebPushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  content_encoding?: string;
};

export const webPushApi = {
  /** VAPID public key the browser subscribes with; null until the server is set up. */
  key: (token: string) => apiRequest<{ public_key: string | null }>('/web-push/key', { token }),
  subscribe: (token: string, input: WebPushSubscriptionInput) =>
    apiRequest<unknown>('/web-push/subscription', { method: 'POST', body: input, token }),
  unsubscribe: (token: string, endpoint: string) =>
    apiRequest<unknown>('/web-push/subscription', { method: 'DELETE', body: { endpoint }, token }),
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
