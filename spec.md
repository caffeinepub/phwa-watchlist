# Phwa Watchlist

## Current State
Full manga watchlist app with Internet Identity login, password gate, offline sync, and per-user manga entries stored in the backend canister. The backend uses an authorization module (`access-control.mo`) where `getUserRole()` calls `Runtime.trap("User is not registered")` when a principal has no role entry. `registerCaller()` in `main.mo` calls `getUserRole()` first to check the current role -- this causes a hard trap for any brand new principal, making `registerCaller()` always fail and the frontend unable to connect.

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- `access-control.mo`: Change `getUserRole()` so that when a principal is not found in the role map, it returns `#guest` instead of calling `Runtime.trap("User is not registered")`. This makes unregistered principals behave the same as anonymous principals -- as guests -- which is safe and correct since `registerCaller()` in `main.mo` already handles the `#guest` case by assigning `#user`.

### Remove
- Nothing

## Implementation Plan
1. Regenerate the backend with the single change: in `getUserRole`, replace `Runtime.trap("User is not registered")` with `return #guest` for the `case (null)` branch.
2. Keep all other backend logic (MangaEntry, all CRUD functions, MixinAuthorization, etc.) exactly as-is.
