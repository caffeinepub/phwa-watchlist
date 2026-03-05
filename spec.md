# Phwa Watchlist

## Current State
- Full-stack manga watchlist app with Internet Identity (II) authentication
- Authorization system using role-based access control (admin/user/guest)
- After II login, users are registered and can manage their manga entries
- No additional access control beyond II authentication

## Requested Changes (Diff)

### Add
- A password gate screen that appears after II login (before accessing the app)
- Password: `kamehamea` -- must be entered correctly to proceed
- Lockout: 3 consecutive wrong attempts triggers a 5-minute timeout (per browser session, tracked in localStorage)
- Trusted principal storage: when password is entered correctly, the principal is stored as "trusted" in the backend so they skip the password next time
- A backend method `checkTrusted(principal)` -> Bool to verify if a principal has been previously verified
- A backend method `markTrusted(principal)` -> () called after correct password entry

### Modify
- App.tsx: insert password gate check between II authentication and the main app view
- After II login, query the backend `checkTrusted`. If trusted -> go straight to main app. If not trusted -> show password gate.

### Remove
- Nothing removed

## Implementation Plan
1. Add `trustedPrincipals` map and two query/update functions (`checkTrusted`, `markTrusted`) to `main.mo`
2. Create `PasswordGate.tsx` component:
   - Password input field (masked)
   - Submit button
   - Error message on wrong password
   - After 3 wrong attempts: show countdown timer (5 minutes), disable input/button
   - Lockout state stored in localStorage (`phwa_lockout_until`, `phwa_fail_count`)
   - On correct password: call `markTrusted` on backend, proceed to app
3. Update `App.tsx`:
   - Add `isPasswordVerified` state
   - After II login, call `checkTrusted(principal)` -- if true, set `isPasswordVerified = true`
   - If not trusted, show `PasswordGate` component
   - On gate success, set `isPasswordVerified = true`
