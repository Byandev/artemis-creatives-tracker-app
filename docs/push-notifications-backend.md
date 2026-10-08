# Push notifications: backend contract

The Creatives Tracker app registers each phone's **native device push token** with Artemis: an FCM
token on Android, an APNs token on iOS. Artemis stores the tokens per user and sends pushes directly
through FCM / APNs when there is something to review.

The app side is done (`src/lib/notifications.ts`). This document is what the Laravel side needs to match.

## 1. Endpoints

Both endpoints sit in the existing `v1/creatives-tracker` group behind `auth:sanctum`, like `/me`.

### `POST /api/v1/creatives-tracker/push-token`

Called when the user turns notifications on, and again on every app launch (tokens can change).
It must be idempotent: the same token sent twice is a single row.

```json
{
  "token": "<FCM token on Android, APNs token on iOS>",
  "platform": "android",
  "device_name": "Juan's Galaxy S24"
}
```

| Field         | Rules                                                   |
| ------------- | ------------------------------------------------------- |
| `token`       | required, string, max 255                               |
| `platform`    | required, `ios` or `android`                            |
| `device_name` | optional, string, max 255                               |

- `200` or `204` on success. Body is ignored.
- `422` with Laravel validation errors if the input is invalid.
- If the token already belongs to **another user** (shared phone, different login), move it to the
  current user: a phone should only ever get one person's notifications.

### `DELETE /api/v1/creatives-tracker/push-token`

Called when the user turns notifications off, and on logout (before `/logout` revokes the Sanctum token).

```json
{ "token": "<device push token>" }
```

- `204` on success, also when the token isn't stored (nothing to delete).
- Only delete the token if it belongs to the current user.

Suggested table `creatives_tracker_push_tokens`: `id`, `user_id` (FK, cascade on delete),
`token` (unique), `platform`, `device_name` (nullable), `last_used_at` (nullable), timestamps.

## 2. When to send

### New creative assigned

When a user is added to a creative's assigned reviewers (and the creative is in a workspace with the
Creatives module on), send to all of that user's tokens:

- title: `New creative to review`
- body: `ECOBOOST — UGC 01 · Campaign A`
- data: `{ "type": "creative_assigned", "creative_id": 123 }`
- high priority

### Daily reminder

Once a day (suggested 9:00 AM Asia/Manila, via the scheduler), for each user with at least one
creative waiting on their review (the same query as `GET /creatives/assigned`):

- title: `Creatives waiting for review`
- body: `You have 4 creatives waiting for your review.`
- data: `{ "type": "pending_reminder", "count": 4 }`
- normal priority

Skip users with nothing pending: no "0 creatives" pushes.

High priority on the assignment push is what makes it arrive within seconds: without it, Android may
hold the push while the phone is idle (Doze / battery saver) and deliver it later.

The app reads `data.type`. Both types open the Creatives list when tapped.

## 3. Sending through FCM and APNs

Pick the service from the token's `platform`. Payload shapes follow
https://docs.expo.dev/push-notifications/sending-notifications-custom/ so `expo-notifications` in
the app can read them.

### Android (`platform: android`): FCM HTTP v1

`POST https://fcm.googleapis.com/v1/projects/<firebase-project-id>/messages:send`, authenticated with
an OAuth token from the Firebase service account JSON (keep the file path in `.env`). One token per request.

Send a **data-only** message (no `notification` block): `expo-notifications` builds the notification
from these fields. All `data` values must be strings, so the app data goes JSON-encoded in `body`.

```json
{
  "message": {
    "token": "<FCM token>",
    "android": { "priority": "HIGH" },
    "data": {
      "channelId": "reviews",
      "title": "New creative to review",
      "message": "ECOBOOST — UGC 01 · Campaign A",
      "body": "{\"type\":\"creative_assigned\",\"creative_id\":123}"
    }
  }
}
```

`channelId` must be `reviews` (the Android channel the app creates). Use `"priority": "NORMAL"` for the daily reminder.

- `404 UNREGISTERED` or `400 INVALID_ARGUMENT` on the token: delete that token.

### iOS (`platform: ios`): APNs

HTTP/2 `POST https://api.push.apple.com/3/device/<APNs token>` (`api.sandbox.push.apple.com` for
development builds), authenticated with a JWT from the APNs auth key (`.p8`, Key ID, Team ID, in `.env`).
Headers: `apns-topic: <iOS bundle identifier>`, `apns-push-type: alert`, `apns-priority: 10`
(`5` for the daily reminder).

App data goes as root-level keys next to `aps`:

```json
{
  "aps": {
    "alert": { "title": "New creative to review", "body": "ECOBOOST — UGC 01 · Campaign A" },
    "sound": "default"
  },
  "type": "creative_assigned",
  "creative_id": 123
}
```

- `410` or `400 BadDeviceToken` / `Unregistered`: delete that token.

### Both

- Send from a **queued job**, not in the request that assigned the reviewer. A queue worker
  (`php artisan queue:work` or Horizon) must be running, or the pushes wait in the queue unsent.
- `laravel-notification-channels/fcm` and `laravel-notification-channels/apn` can do the sending,
  or a small HTTP client call per service.

## 4. Testing without the backend

Once the app runs as a development build, the token is logged in dev (`[push] Device push token: ...`)
and stored in the `creatives_tracker_push_tokens` table. Send a test push to it with the Firebase
console (Android) or a direct APNs request (iOS).

## 5. Web app (PWA): Web Push

The installed web app can't use FCM/APNs device tokens, so it subscribes through the browser's Web Push instead
(`src/lib/notifications.web.ts`, service worker `public/push-sw.js`). Same notifications, same
`data`, sent alongside the FCM/APNs push by `ReviewerPush` in Artemis.

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
