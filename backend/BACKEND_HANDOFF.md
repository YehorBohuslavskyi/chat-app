# Backend ownership and Supabase setup

Status: our backend foundation is implemented. On 2026-11-07, the user supplied successful Supabase `migration:status` output: all five migrations completed in batch 1, including the application-table security migration. TLS is configured using the downloaded certificate. Local validation covers ten functional tests, including public-channel discovery, plus lint and the production build. A live smoke test against the user's running API passed 29 HTTP checks plus response assertions: signup, login/logout, authentication, unique channel names, commands, membership, private access, invitation highlighting/seen state, administrator bans/restoration, revocation, leaving and deletion. Test channels were deleted and test tokens revoked; two accounts remain (`smoke-mw6o7ysu-admin@example.com`, `smoke-mw6o7ysu-member@example.com`) because no account-delete endpoint is implemented. PostgreSQL concurrency and scheduled cleanup deployment remain to be verified. See `API.md` for endpoint contracts, testing, setup and teammate integration. The frontend now uses the real account/channel APIs by default; see ../frontend/README.md for integration behavior, verification and remaining teammate work.

Both halves use AdonisJS and Lucid with Supabase-hosted PostgreSQL. The frontend calls AdonisJS. Keep application authentication in AdonisJS. Use Lucid migrations as the source of truth for application tables.

This is an approximate split by effort, not by number of tables or use cases. Reference: `../data_model/logical_model.md` and the local project plan. The week 9 checkpoint requires contributions from both halves (UC1–6).

## Our half: accounts, channels, and access control

- Configure PostgreSQL connectivity and validated environment variables, preserving local secrets.
- Extend registration with first name, last name, unique normalized nickname and email; login, profile, logout, validation and token authentication.
- Implement channel creation/listing, public joining, private access, invitation highlighting and marking invitations seen.
- Implement invitations, private revocation, public kick votes and bans, and administrator restoration.
- Implement ordinary leave, administrator leave/deletion, and expiration after more than 30 days without messages.
- Provide shared membership/administrator authorization services for the teammate's HTTP and real-time handlers.
- Expose domain operations behind `/join`, `/invite`, `/revoke`, `/kick`, `/quit`, `/cancel`, and member lookup for `/list`; UI actions use the same operations.
- Add targeted tests for authentication, permissions, unique names, moderation, deletion, and expiration.

Owned tables: `users`, existing `auth_access_tokens`, `channels`, `channel_members`, `channel_bans`, `kick_votes`. Invitation state belongs on `channel_members` as specified by the existing model; no separate invitations table.

Owned files: database connection/environment configuration; migrations/models for the above tables; account/channel validators, controllers, services, and their tests. Do not create message tables or real-time implementations in this half.

## Teammate's half: messages and live behavior

- [ ] Create `messages` and `message_mentions` migrations/models, foreign keys and history indexes.
- [ ] Implement member-only text sending, body validation, persistence and exact-member nickname mentions (UC3/UC6).
- [ ] Update `channels.last_message_at` in the same transaction as each saved message.
- [ ] Implement bounded cursor pagination and missed-message catch-up (UC7), including duplicate/gap handling during live delivery.
- [ ] Choose and document authenticated real-time transport; authorize subscriptions and delivery.
- [ ] Broadcast persisted messages and channel/membership changes; immediately revoke live access when membership is removed or a channel disappears.
- [ ] Implement online/DND/offline persistence and delivery behavior; offline suspends incoming live messages, resuming delivery reconciles channels and messages (UC9).
- [ ] Add `users.status` and `users.notification_mode` through a separate additive migration, with settings endpoints (UC8/UC9).
- [ ] Enrich member lookup with presence and publish presence changes (UC10).
- [ ] Implement transient typing and every draft edit, clickable draft-preview support, ordering and cleanup on send/clear/disconnect (UC11).
- [ ] Supply recipient and mention metadata for frontend notification decisions. Coordinate visibility checks, DND suppression and all/mentions preferences with the frontend owner (UC8).
- [ ] Test unauthorized reads/writes/subscriptions, pagination, disconnect/reconnect, offline catch-up, drafts and revocation using multiple users.

## Shared integration contract

These are implementation boundaries; exact endpoint paths and payloads are documented in `API.md`.

1. Reuse the existing AdonisJS token guard and user IDs; never introduce a second account system.
2. Follow names and constraints in `../data_model/logical_model.md`. Use the existing Adonis `password` and token column conventions where the logical diagram uses conceptual names.
3. Our half owns membership and channel lifecycle writes. The teammate uses the shared authorization service, including expiration checks, for history, sending, subscriptions and drafts.
4. Creation initializes `last_message_at`; only successful message creation refreshes it. Serialize message writes and expiry decisions appropriately so active channels are not deleted by a racing cleanup job.
5. Teammate-owned message/mention foreign keys must cascade on channel/message deletion. Our half must work before those tables exist.
6. Our channel services expose committed lifecycle events for channel deletion, member addition and member removal. The teammate supplies transport publication and subscription eviction; never broadcast a rolled-back operation.
7. Bans are enforced through revoked membership plus join/invite restrictions. Cached subscriptions must not retain access after removal.
8. Migrations have unique ordered filenames. The teammate's migrations run after our foundation migrations and add presence/preferences without rewriting our migrations.
9. Document response shapes and error codes; clients must distinguish validation, unauthenticated, forbidden and missing-resource failures.
10. Live message reconciliation needs a documented race-safe ordering/catch-up strategy; an auto-increment ID alone does not guarantee transaction commit ordering.

## Supabase setup: user action

1. Create a Supabase project for this application, choose a nearby region, and save the database password privately.
2. Wait for provisioning, then open **Connect** and select **Session pooler** (PostgreSQL port 5432), suitable for IPv4 development connections.
3. Copy the host, port, database and username exactly from that project's connection details. Save the password only in the local backend `.env` when configuring connectivity; do not send it in chat or commit it.
4. Report that the project is ready and provide the non-secret connection fields. We will prepare the environment keys and configure verified TLS in our implementation step.
5. Leave application tables empty. We will create only our half's tables through AdonisJS migrations; the teammate adds their own migrations later.

Connection reference: https://supabase.com/docs/guides/database/connecting-to-postgres

## Final joint verification

- Create all application tables in an empty development database using migrations in order.
- Demonstrate UC1–6 together for the checkpoint; neither half alone completes it.
- Demonstrate all UC1–11, frontend notification behavior and PWA installation for final delivery.
- Each teammate reviews and can explain the other half; record model changes and final architecture in submission documentation.
