# Phwa Watchlist

## Current State
Full-stack manga watchlist app with Motoko backend and React frontend. Backend exposes manga CRUD, authentication via Internet Identity, authorization via role-based access. Frontend has Header, Toolbar, MangaCard, Import/Export, and a last-synced timestamp. There is currently no cycle monitoring.

## Requested Changes (Diff)

### Add
- `getCycleBalance` query method in the Motoko backend that returns the canister's current cycle balance as a `Nat`
- `getCycleBalance(): Promise<bigint>` entry in `backend.d.ts`
- A `CycleMonitor` component (or inline widget) that displays the cycle balance in the Header's left section, alongside the sync indicator. It fetches the balance once on load (when online and authenticated), and shows the value formatted as TC (trillions of cycles) with a warning color when balance is low (< 0.5 TC). Balance is slightly stale by design -- no live polling needed.

### Modify
- `Header.tsx` to accept and display an optional `cycleBalance` prop (in TC, as a number)
- `App.tsx` to call `getCycleBalance` once after authentication and pass the result to Header

### Remove
- Nothing

## Implementation Plan
1. Add `getCycleBalance` to `main.mo` using `ExperimentalCycles.balance()`
2. Add `getCycleBalance(): Promise<bigint>` to `backend.d.ts`
3. In `App.tsx`, call `actor.getCycleBalance()` once after `registerCaller()` and store in state
4. Pass cycle balance to `Header` as an optional prop
5. In `Header.tsx`, render a small cycle balance badge next to the sync indicator, formatted as `X.XX TC`, amber/red colored when < 0.5 TC
