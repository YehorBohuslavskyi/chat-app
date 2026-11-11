# Backend foundation API

Implemented scope: accounts, channels, membership, moderation and expiration. The frontend now uses these APIs by default; message/presence/live endpoints belong to the teammate's half.

Base path: `/api/v1`. Send JSON with `Content-Type: application/json`. Protected endpoints require `Authorization: Bearer <token>`. Successful responses use `{ "data": ... }`. Validation errors use `{ "errors": [...] }`; domain errors include `code` and `message`. No password or password hash is serialized.

## Accounts

| Method | Path | Request | Result |
| --- | --- | --- | --- |
| POST | `/auth/signup` | `firstName`, `lastName`, `nickname`, `email`, `password`, `passwordConfirmation` | `{ data: { user, token } }`, 200 |
| POST | `/auth/login` | `email`, `password` | `{ data: { user, token } }`, 200 |
| GET | `/account/profile` | Bearer token | `{ data: user }` |
| POST | `/account/logout` | Bearer token | Revokes current token; `{ message: "Logged out successfully" }` |

The logout response retains the original starter format. User fields: `id`, `firstName`, `lastName`, `nickname`, `fullName` (compatibility), `email`, `initials`, `createdAt`, `updatedAt`.

Names are trimmed; nicknames and emails are lowercased. Nicknames/channel names are 2–32 characters matching `[a-z0-9][a-z0-9_-]*`. First/last names are required and at most 100 characters each. Passwords retain the starter's 8–32 character rule. Login does not trim or lowercase passwords.

Existing starter accounts are preserved by an additive migration. Their nicknames become `legacy-<id>`, their previous full name is retained and copied (up to 100 characters) to `first_name`, and `last_name` remains empty. New registrations require both names. Existing account data is not moved from SQLite to Supabase automatically.

## Channels (all authenticated)

| Method | Path | Request | Result data |
| --- | --- | --- | --- |
| GET | `/channels` | — | Current memberships, unseen invitations first |
| GET | `/channels/discover?q=name` | Optional search, max 32 characters | Up to 50 matching public channels with `isMember`; excludes expired channels and channels where the caller is banned |
| POST | `/channels` | `name`, `type` (`public`/`private`), optional `description` (max 160) | Created channel, 201; duplicate name 409 |
| POST | `/channels/join` | `name`, optional `type` (default public) | Joined or created channel |
| GET | `/channels/:id/members` | — | Member IDs, nicknames, names and `isAdmin` |
| POST | `/channels/:id/seen` | — | `{ seen: true }` |
| POST | `/channels/:id/invite` | `nickname` | `{ userId, invited, restored }` |
| POST | `/channels/:id/revoke` | `nickname` | `{ removed: true }` |
| POST | `/channels/:id/kick` | `nickname` | `{ banned, votes }` |
| POST | `/channels/:id/leave` | — | `{ deleted }`; administrator leave deletes the channel |
| DELETE | `/channels/:id` | — | Administrator-only deletion, `{ deleted: true }` |
| POST | `/commands` | `command`, optional `channelId` | Corresponding operation's data |

Channel fields: `id`, `name`, `description`, `type`, `adminId`, `createdAt`, `lastMessageAt`. The list also includes `invitedAt` and `invitationSeen`. PostgreSQL dates are serialized as ISO date strings. SQLite is used for isolated tests only; its raw numeric timestamps are not the frontend contract.

Commands: `/join name`, `/join name private`, `/invite nickname`, `/revoke nickname`, `/kick nickname`, `/quit`, `/cancel`, `/list`. All except `/join` require `channelId`. Unknown commands or extra arguments are rejected. Ordinary message text is not accepted by this endpoint.

Existing private channels require existing membership, even with `/join name private`. Joining never changes a channel's type. Private invitations/revocations require the administrator. Public invitations permit any current member unless restoring a banned user, which requires the administrator. Invitations immediately add membership; reinviting an existing member is idempotent and does not reset the invitation marker.

Ordinary public kicks record votes; the first two votes leave membership intact. Three distinct current members cause a permanent ban; repeated votes do not add to the total. An administrator kick bans immediately (`votes: 0`). Self-targeting and administrator-targeting are forbidden. Leaving/removal clears votes cast by or targeting that user; restoration starts a new vote round. These rules follow the existing logical model, with vote removal on leaving made explicit here.

Typical errors: 401 unauthenticated, 403 `E_NOT_MEMBER`/`E_NOT_ADMIN`/`E_BANNED`/`E_PRIVATE_CHANNEL`/`E_PROTECTED_MEMBER`, 404 `E_CHANNEL_NOT_FOUND`/`E_USER_NOT_FOUND`, 409 `E_ALREADY_EXISTS`, 422 validation or command syntax errors. Expired channels behave as missing.

## Messages (all authenticated, members only)

- `POST /api/v1/channels/:id/messages` with `{ "body": "..." }` → `201 { data: message }`.
  - `body` is trimmed and must be 1–4000 characters (422 otherwise).
  - Message: `id`, `channelId`, `senderId`, `body`, `createdAt` (ISO), `sender` (`id`, `nickname`, `firstName`, `lastName`), `mentions` (user IDs).
  - `@nickname` mentions use the same pattern as the frontend (`(?<![\w@])@name`, case-insensitive). Only current channel members other than the sender are stored in `message_mentions`.
  - The message, its mentions and `channels.last_message_at` are saved in one transaction under the channel lock (`ChannelService.withMember`).
  - Errors: 401 unauthenticated, 403 `E_NOT_MEMBER`, 404 `E_CHANNEL_NOT_FOUND` (also for expired channels), 422 validation.
- `GET /api/v1/channels/:id/messages?limit=20[&before=<id>|&after=<id>]` → `{ data: { items, hasMore } }`.
  - No cursor: the newest `limit` messages. `before`: the page just older than that id. `after`: messages newer than that id (catch-up). Not both at once.
  - `limit` is 1–50 (default 20). `items` are always oldest first, in the same shape as above.
  - Same errors as sending.
  - The frontend currently polls this with `after` every 3 seconds as a stand-in for real-time delivery. Ordering by `id` is fine for this; real-time delivery still needs the race-safe strategy from the handoff.

## Teammate integration

Use `ChannelService.withMember(channelId, userId, async (trx, channel) => ...)` for message creation/history. This locks the channel, commits expiration if necessary, and authorizes membership. Write messages and update `last_message_at` using that same transaction; acquire the channel lock before other locks. Keep network calls outside this callback. Sending must set the clock from server time, never from client input. Do not wrap the service in another transaction: its event boundary assumes it owns the outer commit.

`channelEvents.on('change', listener)` from `#services/channel_events` provides committed `channel.created`, `channel.deleted`, `member.added` and `member.removed` events. All carry `channelId`; creation/membership events also carry `userId`. The listener belongs to your real-time provider. Revoke removed users' subscriptions and notify affected clients when channels disappear. Never grant subscription access merely because the client supplies a channel ID.

This event emitter is in-process and best-effort, not a durable queue. A separate cleanup process needs your publication provider loaded there as well, and multiple server processes need a shared transport. Reconnect must always reconcile current database state. Do not assume events replace authorization checks on subsequent reads/draft sends.

Your migrations follow `1794000000002`. Create `messages` and `message_mentions` with cascading foreign keys and add `users.status`/`users.notification_mode`. Protect your new tables from Supabase public API access as our security migration does. Extend `User` with the new Lucid columns; schema auto-generation is disabled so shared schema files are not unexpectedly overwritten.

## Running and verification

1. Local `backend/.env` contains the supplied Supabase host/user/database and `DB_CONNECTION=postgres`. Set `DB_PASSWORD` privately. Keep `DB_SSL=true`. If the CA is not trusted by the system, download the Supabase database certificate and set `DB_SSL_CA_PATH` to its local path; certificate verification remains enabled.
2. From `backend`, run `node ace migration:run --no-schema-generate`. This creates only our six application tables plus Adonis migration metadata. Run migrations with the project's database owner account.
3. Run `npm run dev` to start the API.
4. Schedule `node ace channels:expire` on the backend host (for example every hour); the scheduling service is deployment-specific and is not installed by this change. Channel access, listing and joining also perform expiration checks. Exactly 30 days does not expire a channel; more than 30 does. Creation initializes the clock for empty channels.
5. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` from `backend` for local verification.

Tests force a separate `tmp/test.sqlite3` database regardless of `.env`, migrate it, and roll it back afterward. They do not validate PostgreSQL row-lock concurrency or Supabase role/TLS behavior. Validate those against a dedicated PostgreSQL development environment before the checkpoint. Do not run destructive test/reset commands on a shared project.

References: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase data protection](https://supabase.com/docs/guides/database/secure-data), [Lucid transactions](https://lucid.adonisjs.com/docs/transactions).
