# Push notifications: backend contract

The Creatives Tracker app registers each phone's **Expo push token** with Artemis. Artemis stores
the tokens per user and sends pushes through Expo's push service when there is something to review.

The app side is done (`src/lib/notifications.ts`). This document is what the Laravel side needs to match.

## 1. Endpoints

Both endpoints sit in the existing `v1/creatives-tracker` group behind `auth:sanctum`, like `/me`.

### `POST /api/v1/creatives-tracker/push-token`

Called when the user turns notifications on, and again on every app launch (tokens can change).
It must be idempotent: the same token sent twice is a single row.

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "android",
  "device_name": "Juan's Galaxy S24"
}
```

| Field         | Rules                                                   |
| ------------- | ------------------------------------------------------- |
| `token`       | required, string, max 255, starts with `ExponentPushToken[` |
| `platform`    | required, `ios` or `android`                            |
| `device_name` | optional, string, max 255                               |

- `200` or `204` on success. Body is ignored.
- `422` with Laravel validation errors if the input is invalid.
- If the token already belongs to **another user** (shared phone, different login), move it to the
  current user: a phone should only ever get one person's notifications.

### `DELETE /api/v1/creatives-tracker/push-token`

Called when the user turns notifications off, and on logout (before `/logout` revokes the Sanctum token).

```json
{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }
```

- `204` on success, also when the token isn't stored (nothing to delete).
- Only delete the token if it belongs to the current user.

Suggested table `creatives_tracker_push_tokens`: `id`, `user_id` (FK, cascade on delete),
`token` (unique), `platform`, `device_name` (nullable), `last_used_at` (nullable), timestamps.

## 2. When to send

### New creative assigned

When a user is added to a creative's assigned reviewers (and the creative is in a workspace with the
Creatives module on), send to all of that user's tokens:

```json
{
  "to": ["ExponentPushToken[...]"],
  "title": "New creative to review",
  "body": "ECOBOOST — UGC 01 · Campaign A",
  "sound": "default",
  "priority": "high",
  "channelId": "reviews",
  "data": { "type": "creative_assigned", "creative_id": 123 }
}
```

### Daily reminder

Once a day (suggested 9:00 AM Asia/Manila, via the scheduler), for each user with at least one
creative waiting on their review (the same query as `GET /creatives/assigned`):

```json
{
  "to": ["ExponentPushToken[...]"],
  "title": "Creatives waiting for review",
  "body": "You have 4 creatives waiting for your review.",
  "sound": "default",
  "channelId": "reviews",
  "data": { "type": "pending_reminder", "count": 4 }
}
```

Skip users with nothing pending: no "0 creatives" pushes.

`"priority": "high"` on the assignment push is what makes it arrive within seconds: without it,
Android may hold the push while the phone is idle (Doze / battery saver) and deliver it later.
The daily reminder can use the default priority.

The app reads `data.type`. Both types open the Creatives list when tapped. `channelId` must be
`reviews` (the Android channel the app creates).

## 3. Sending through Expo

`POST https://exp.host/--/api/v2/push/send` with `Content-Type: application/json`, up to 100
messages per request. Docs: https://docs.expo.dev/push-notifications/sending-notifications/

- Send from a **queued job**, not in the request that assigned the reviewer. A queue worker
  (`php artisan queue:work` or Horizon) must be running, or the pushes wait in the queue unsent.
- If a ticket or receipt comes back with `DeviceNotRegistered`, delete that token.
- If the Expo project has "enhanced push security" turned on, add an
  `Authorization: Bearer <EXPO_ACCESS_TOKEN>` header (keep it in `.env`).
- The `laravel-notification-channels/expo` package can do the sending, or a small HTTP client call.

## 4. Testing without the backend

Once the app runs as a development build, copy a token from the `creatives_tracker_push_tokens` table
(or log it in the app) and send a test push from https://expo.dev/notifications.

## 5. Web app (PWA): Web Push

The installed web app can't use Expo push, so it subscribes through the browser's Web Push instead
(`src/lib/notifications.web.ts`, service worker `public/push-sw.js`). Same notifications, same
`data`, sent alongside the Expo push by `ReviewerPush` in Artemis.

| Endpoint | Body | Response |
| --- | --- | --- |
| `GET /web-push/key` | | `{ "public_key": "<VAPID public key>" }`, or `null` when not configured |
| `POST /web-push/subscription` | `{ "endpoint", "keys": { "p256dh", "auth" }, "content_encoding" }` | `204`; keyed on `endpoint`, moves to the current user |
| `DELETE /web-push/subscription` | `{ "endpoint" }` | `204`; only the current user's |

Payload the service worker expects: `{ "title", "body", "data": { "type", ... }, "url": "/" }`.

Server setup, once per environment: `php artisan creatives:web-push-keys`, then put
`WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` and `WEB_PUSH_SUBJECT` (a `mailto:` or `https:` URL)
in `.env`. Changing the keys later cuts off every subscribed browser until it re-subscribes on next launch.

Limits: iPhone/iPad only allow Web Push for an app added to the Home Screen (iOS 16.4+). The
service worker only ships with the production export (`npm run build:web`), not `expo start`.
