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
