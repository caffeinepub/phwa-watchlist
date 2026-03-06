# Phwa Watchlist

## Current State
The app has a Motoko backend with an authorization system that requires callers to have the `#user` role before any data operations (getEntries, addEntry, updateEntry, etc.). The `getUserRole` function traps with "User is not registered" if a caller has no role assigned. There is no auto-registration path -- new users who log in via Internet Identity are never assigned a role, causing all backend calls to fail with "Unauthorized" or a trap. This manifests as "failed to save entry" errors on the frontend. The watchlist card width is currently 1300px with `minWidth: 1300` in multiple places.

## Requested Changes (Diff)

### Add
- `registerUser` public function in the backend that any non-anonymous caller can invoke to self-assign the `#user` role (if they don't already have one). This is safe because every authenticated user should be a `#user`.
- Frontend call to `actor.registerUser()` immediately after the actor is ready and the user is authenticated, before any data fetching.

### Modify
- Watchlist card width from 1300px to 1100px (update all `minWidth: 1300`, `width: 1300`, and `style={{ minWidth: 1300 }}` occurrences in App.tsx and MangaCard.tsx).

### Remove
- Nothing.

## Implementation Plan
1. Add `registerUser` to `main.mo` -- checks if caller is non-anonymous and has no role, then assigns `#user`.
2. Update `backend.d.ts` to add `registerUser(): Promise<void>`.
3. In `App.tsx`, call `actor.registerUser()` after actor is ready and authenticated (inside the `useEffect` that calls `fetchEntries`, before or alongside it).
4. Change all `1300` width values to `1100` in `App.tsx` and `MangaCard.tsx`.
