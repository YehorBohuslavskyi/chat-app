# Sideby — frontend prototype

Vue single-file components, JavaScript, Quasar, and Pinia. The Slack/Discord-inspired flow is: sign in → choose or join a channel → read and send messages → inspect members or invite a teammate. No backend is needed for this milestone.

Sideby has its own paired speech-shape logo, forest navigation, cobalt actions, lime selection accents, and warm paper surfaces. Login, dialog, and empty-state copy is written for this identity. Decorative captions and composer keyboard hints have been removed; keyboard shortcuts still work.

## Run

From the repository root:

```sh
npm run dev:front
```

Open the local URL printed by Quasar, then choose **Try Sideby**. Demo login: `alex@loop.demo` / `LoopDemo123!`. Registration also works with sample details. The chat route is `/#/chat`; unauthenticated visits go to `/#/auth/login`.

## The requested 60% scope

The milestone has been reduced from approximately 70% to 60% by removing the complete history/search feature from the current implementation. This is a planning estimate, not a measured percentage of the assignment or backend. The six core areas below remain implemented, and the teammate has a concrete next feature to own.

| Core area                | Implemented                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace                | Workspace rail, channel filtering, responsive navigation drawer, fixed composer, member panel/dialog                                                                   |
| Accounts                 | Login, registration, validation, unique normalized nickname/email, route guard, logout and state clearing                                                              |
| Channels                 | Browse/join public channels; create public/private channels; leave; administrator deletion confirmation                                                                |
| Invitations and commands | Immediate invitations, unseen invitation highlight/top placement, `/join`, `/invite`, `/list`, `/cancel`, `/quit`, `/help`, syntax and permission feedback             |
| Messaging                | Full channel history (20-message pages loaded on upward scroll) plus new sends, Enter/send button, Shift+Enter, exact member mentions, recipient highlighting, mention suggestions, safe text rendering |
| Members and UI states    | Member identities, administrator marker, sample presence badges, loading/empty/error/retry states, keyboard labels and focus styles                                    |

### Remaining scope — intentionally not implemented

- Inactive-channel expiration scenario.
- Moderation (`/kick`, `/revoke`, distinct kick votes, bans, administrator restoration) is in progress; see *Moderation* below.
- Live behavior: typing, clickable live draft previews, status controls, notification preferences and Quasar App Visibility, offline delivery suspension and catch-up. Presence badges currently display sample data only.
- Integration and finalization: agreed API/event contracts, real authentication and authorization, real-time transport, cross-tab synchronization, PWA install/service worker, full desktop/mobile acceptance walkthrough and screenshots.

Direct messages, attachments, reactions, and editing are not part of the assignment's required scope and are not presented as working controls.

## Teammate handoff: message history and search

This is a proposed ownership boundary to agree together. The implementation was removed, not hidden behind a flag. Recent messages and sending still work. All stored messages and the 50-message general-channel fixture are retained.

Start with these files:

- `src/services/mock/workspace.js`: exposes `messageHistory(channelId, { before, limit })` returning `Promise<{ items, hasMore }>`. `before` is the oldest loaded message id (cursor), `limit` is clamped to 1–50, and only members may read. Agree the real API contract with the backend teammate.
- `src/features/chat/messages.store.js`: add pagination state, older-page actions, concurrent-request handling, page merging, and retry behavior. Preserve session/channel invalidation guards and send deduplication.
- `src/features/chat/components/MessageList.vue`: implement upward infinite scrolling, an accessible manual fallback, and scroll-position preservation when prepending older messages.
- `src/features/chat/components/ChatHeader.vue` and `src/pages/ChatPage.vue`: add search controls and query state. Define whether search covers loaded messages or all history, and label it accurately.

Acceptance criteria:

- [ ] Reach all 50 seeded general-channel messages with no gaps or duplicates.
- [ ] Preserve the visible message position when prepending, including during a new send.
- [ ] Rapid channel switching, leaving, or signing out must not reveal stale/private messages.
- [ ] Loading, empty, error, retry, and end-of-history states work on desktop and mobile.
- [ ] Search has clear scope, a clear action, and useful no-results behavior; switching channels clears the query.
- [ ] Verify the service contract and complete a visual walkthrough together.

History is assignment UC7. Message search is an additional frontend feature, not a required assignment deliverable. The remaining moderation, live behavior, integration, and PWA work above also provide substantial opportunities for shared development.

## Architecture and prototype decisions

- `layouts/` contains the page shells; `pages/` composes feature components.
- `features/auth`, `features/channels`, and `features/chat` own their Pinia state. Command execution lives in `useChatActions`; parsing and mention tokenization are pure utilities.
- `services/index.js` selects the asynchronous mock adapter. UI components do not make HTTP calls. Replace this adapter with real service implementations when the backend contract is agreed; the existing Axios boot file remains available for integration.
- Mock data persists in `localStorage` under `loop-prototype-v2`; the signed-in identity is tab-local `sessionStorage` under `loop-session-v1`. If storage is unavailable, the prototype runs in memory. Logout clears identity and Pinia caches, while sample workspace data remains available for subsequent sign-in. Clear these two keys to reset the demo.
- This is a single-tab local simulation, not a secure authentication system or synchronized multi-user app. Registered sample passwords are stored as mock digests, never plaintext; do not use real credentials. Server authorization is still required.
- Names are case-insensitive, normalized to lowercase, and use 2–32 letters, numbers, hyphens, or underscores. A nickname/channel name must begin with a letter or number.
- Invitations provisionally add membership immediately; opening the channel clears its unseen marker. This follows the proposed default in the project plan and still needs instructor/team confirmation for the final implementation.
- An administrator leaving deletes the channel and its messages; both UI actions and commands use the same confirmation and store operation. An ordinary member leaving loses access and cached messages. Private re-entry requires another invitation.
- Mentions recognize complete member nicknames, ignore email substrings and unknown nicknames, and allow multiple recipients. Drafts clear when switching channels. Opening a channel fetches the latest 20 messages; scrolling near the top (or the keyboard-accessible **Load older messages** button) fetches the previous 20 by id cursor, preserving the reading position. Pages merge by id, so overlaps and concurrent sends cannot duplicate messages. A fixed-height bar shows loading, retry, and "The beginning of #channel" states. Message search is not implemented at this milestone.

## Moderation

Provisional rules, pending instructor confirmation of the first/second kick behavior and vote lifetime:

- `/kick nickname` (public channels): the administrator bans immediately; any other member adds one vote. 3 distinct members' votes ban permanently. Repeat votes are rejected, votes never expire, and the target stays a member until banned.
- `/revoke nickname` (private channels, administrator only): removes the member without a ban; a new invitation restores access.
- Banned users cannot `/join`. Only the administrator can `/invite` them, which lifts the ban.
- Nobody can kick or revoke themselves or the administrator.
- Demo data: alex's `/kick james` in `#general` is the third vote, and alex is banned from `#feedback`.
- Two tabs signed in as different users share data through the `storage` event, so a kicked user's tab shows a lost-access notice.

## Verification

Run from `frontend/`:

```sh
npm run lint:check
npm run build
```

The earlier 70% version passed 14 behavior checks before its test files were removed at the user's request. Those results do not verify this reduced version. The current milestone passed lint, the production build, and a targeted in-memory service/store smoke check; no test files or test npm script were added.

**Browser walkthrough remains unverified:** browser access to the local preview was denied in the implementation session. Responsive CSS is implemented, but desktop/mobile layout, keyboard, focus, and scroll behavior still require a visual walkthrough. Do not treat this milestone as verification of all 11 assignment use cases.

### Manual walkthrough to complete

1. Enter the demo, switch channels, and open `launch-room` to clear its invitation badge.
2. Send a message and an `@alex` mention; test Shift+Enter and an invalid slash command.
3. Open `general` and scroll up through all 50 stored messages to "The beginning of #general"; confirm the position holds as each page loads and a new message still appends.
4. Create a private channel, invite `mia`, and inspect `/list`.
5. Try `/quit` in `general` to see the permission error; use `/cancel` in your own channel and inspect the deletion confirmation.
6. Leave a public channel and rejoin it through Browse channels. Sign out, register a sample account, and sign back in to verify isolation.
7. Repeat at desktop, tablet, and 390px mobile widths; check drawer dismissal, wrapping, member dialog, and composer access with the on-screen keyboard.
