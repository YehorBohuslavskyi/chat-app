# Sideby — frontend prototype

Vue single-file components, JavaScript, Quasar, and Pinia. The Slack/Discord-inspired flow is: sign in → choose or join a channel → read and send messages → inspect members or invite a teammate. No backend is needed for this milestone.

Sideby has its own paired speech-shape logo, forest navigation, cobalt actions, lime selection accents, and warm paper surfaces. Login, dialog, and empty-state copy is written for this identity. Decorative captions and composer keyboard hints have been removed; keyboard shortcuts still work.

## Run

From the repository root:

```sh
npm run dev:front
```

Open the local URL printed by Quasar, then choose **Try Sideby**. Demo login: `alex@loop.demo` / `LoopDemo123!`. Registration also works with sample details. The chat route is `/#/chat`; unauthenticated visits go to `/#/auth/login`.

## The requested 70% scope

This is an approximate frontend milestone, not a claim that 70% of the full assignment or its backend is finished. The seven core prototype areas below are implemented; advanced behavior is deliberately left for the remaining milestone.

| Core area                | Implemented                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace                | Workspace rail, channel filtering, responsive navigation drawer, fixed composer, member panel/dialog                                                       |
| Accounts                 | Login, registration, validation, unique normalized nickname/email, route guard, logout and state clearing                                                  |
| Channels                 | Browse/join public channels; create public/private channels; leave; administrator deletion confirmation                                                    |
| Invitations and commands | Immediate invitations, unseen invitation highlight/top placement, `/join`, `/invite`, `/list`, `/cancel`, `/quit`, `/help`, syntax and permission feedback |
| Messaging                | Per-channel messages, Enter/send button, Shift+Enter, exact member mentions, recipient highlighting, mention suggestions, safe text rendering              |
| History                  | Latest 20 messages, older cursor pages on upward scrolling or button, deduplication, scroll-offset preservation, search within loaded messages             |
| Members and UI states    | Member identities, administrator marker, sample presence badges, loading/empty/error/retry states, keyboard labels and focus styles                        |

### Remaining scope — intentionally not implemented

- Advanced moderation: `/kick`, `/revoke`, distinct kick votes, bans, administrator restoration, and the inactive-channel expiration scenario. Resolve the assignment's kick-vote ambiguities first.
- Live behavior: typing, clickable live draft previews, status controls, notification preferences and Quasar App Visibility, offline delivery suspension and catch-up. Presence badges currently display sample data only.
- Integration and finalization: agreed API/event contracts, real authentication and authorization, real-time transport, cross-tab synchronization, PWA install/service worker, full desktop/mobile acceptance walkthrough and screenshots.

Direct messages, attachments, reactions, and editing are not part of the assignment's required scope and are not presented as working controls.

## Architecture and prototype decisions

- `layouts/` contains the page shells; `pages/` composes feature components.
- `features/auth`, `features/channels`, and `features/chat` own their Pinia state. Command execution lives in `useChatActions`; parsing and mention tokenization are pure utilities.
- `services/index.js` selects the asynchronous mock adapter. UI components do not make HTTP calls. Replace this adapter with real service implementations when the backend contract is agreed; the existing Axios boot file remains available for integration.
- Mock data persists in `localStorage` under `loop-prototype-v1`; the signed-in identity is tab-local `sessionStorage` under `loop-session-v1`. If storage is unavailable, the prototype runs in memory. Logout clears identity and Pinia caches, while sample workspace data remains available for subsequent sign-in. Clear these two keys to reset the demo.
- This is a single-tab local simulation, not a secure authentication system or synchronized multi-user app. Registered sample passwords are stored as mock digests, never plaintext; do not use real credentials. Server authorization is still required.
- Names are case-insensitive, normalized to lowercase, and use 2–32 letters, numbers, hyphens, or underscores. A nickname/channel name must begin with a letter or number.
- Invitations provisionally add membership immediately; opening the channel clears its unseen marker. This follows the proposed default in the project plan and still needs instructor/team confirmation for the final implementation.
- An administrator leaving deletes the channel and its messages; both UI actions and commands use the same confirmation and store operation. An ordinary member leaving loses access and cached messages. Private re-entry requires another invitation.
- Mentions recognize complete member nicknames, ignore email substrings and unknown nicknames, and allow multiple recipients. Drafts clear when switching channels. Search explicitly covers loaded messages, not an unimplemented server search.

## Verification

Run from `frontend/`:

```sh
npm run lint:check
npm run build
```

All 14 existing behavior checks passed after the redesign. The frontend test files and `test` npm script were then removed at the user's request. Lint and production build remain available as the ongoing checks.

**Browser walkthrough remains unverified:** browser access to the local preview was denied in the implementation session. Responsive CSS is implemented, but desktop/mobile layout, keyboard, focus, and scroll behavior still require a visual walkthrough. Do not treat this milestone as verification of all 11 assignment use cases.

### Manual walkthrough to complete

1. Enter the demo, switch channels, and open `launch-room` to clear its invitation badge.
2. Send a message and an `@alex` mention; test Shift+Enter and an invalid slash command.
3. Scroll up in `general` to reach all 50 seeded messages; check scroll stability and search.
4. Create a private channel, invite `mia`, and inspect `/list`.
5. Try `/quit` in `general` to see the permission error; use `/cancel` in your own channel and inspect the deletion confirmation.
6. Leave a public channel and rejoin it through Browse channels. Sign out, register a sample account, and sign back in to verify isolation.
7. Repeat at desktop, tablet, and 390px mobile widths; check drawer dismissal, wrapping, member dialog, and composer access with the on-screen keyboard.
