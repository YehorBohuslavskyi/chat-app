# Sideby frontend integration

The default workspace now uses the AdonisJS API and Supabase-backed accounts/channels. Vue components remain plain JavaScript. No Supabase password or key belongs in the frontend.

## Run

Keep the backend running on port 3333. In `frontend`, run `npm run dev` and open the URL printed by Quasar. The dev server proxies `/api` to `http://localhost:3333`; restart the frontend dev server if it was already running before the proxy configuration changed.

Use **Create an account** to register a real account. Old demo accounts and their browser-local channels are separate from API accounts. On refresh, the app restores the token from tab session storage and verifies it with `/account/profile`. Expired/revoked tokens clear account-specific stores and return to sign-in. Connection failures retain the token so Retry can restore the session.

For a production build, serve `/api` from the same origin through your reverse proxy, or set `SIDEBY_API_BASE_URL` to your backend's `/api/v1` URL before `npm run build`. If using a separate origin, configure the backend CORS policy for the frontend origin. These are build-time settings in `quasar.config.js`.

The old prototype is available explicitly by setting `SIDEBY_WORKSPACE_MODE=demo` before starting/building Quasar. API mode is the default. Never use demo mode to demonstrate persistent backend behavior.

## Implemented user flows

- Registration, login, verified session restoration, logout and authentication/validation errors.
- Current channel list, public channel discovery/search (up to 50 results per query), creation and joining by name.
- Public/private invitations, unseen invitation markers, member lists and administrator identification.
- Ordinary leaving, administrator deletion with confirmation, `/join`, `/invite`, `/revoke`, `/kick`, `/list`, `/cancel`, `/quit`, and local `/help`.
- API permission errors, stale-selection protection and channel/member refresh every 10 seconds while visible and when returning to the tab. This polling is temporary until the teammate's real-time transport is integrated.
- Account changes clear channel/message/draft/notification state. Tokens are stored in session storage; passwords are not stored.

Messaging, history, presence, notifications and live drafts belong to the teammate's half. API mode displays a messaging placeholder and accepts channel commands; it does not pretend to send/persist messages. Demo simulation controls and unsupported status/notification controls are hidden. Channel commands remain available in the fixed composer.

## Teammate integration points

- `src/services/api/workspace.js` is the API adapter. It maps backend `nickname` to existing UI `nickName`, numeric IDs to strings, and invitation state to the sidebar's expected shape.
- Implement `messageHistory`, `sendMessage`, `incoming`, `setStatus`, `setNotificationMode`, `drafts`, `setDraft`, and `onExternalChange` when their backend endpoints/events are ready. They currently reject unsupported operations or provide an unsubscribable no-op event hook.
- Update `mapUser` to carry actual persisted presence/preferences, then enable the corresponding flags in `src/services/index.js`. Do not mark users online based solely on their membership.
- Update `useLiveUpdates.js` to consume the authenticated transport, reconcile channel removals and reconnects, and drive messages/notifications/drafts. It currently has an API-mode branch that only polls memberships.
- Existing message and notification stores/components remain available. Review their prototype assumptions (including draft throttling) against the full assignment before enabling them.
- Backend contracts and authorization helpers are documented in `../backend/API.md`; ownership is in `../backend/BACKEND_HANDOFF.md`.

## Verification

`npm test` runs five adapter tests for payload mapping, session restoration/expiry, network failure retry, invitation state, late responses after logout, moderation and unavailable features. `npm run lint:check` and `npm run build` check the frontend.

On 2026-11-07, the adapter was also exercised against the running API through the Quasar dev proxy: registration, restoration, public discovery/private-channel exclusion, joins, invitations/seen state, member lists, revocation, bans/restoration, and leaving succeeded. Test channels were deleted and tokens revoked. Two test accounts remain: `ui-mw6oildy-admin@example.com` and `ui-mw6oildy-member@example.com`.

Visual desktop/mobile interaction has not been verified: browser access was unavailable and native Chrome access was not approved in the verification session.
