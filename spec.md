# Phwa Watchlist

## Current State
- Watchlist cards are 1300px wide x 170px tall
- Cover image: max width 130px, auto height
- Title area: 240px wide with smooth vertical scrolling animation
- Info column: status badge, chapter progress (current/total), star rating
- Genre column: 180px wide, shows up to 5 genre tags
- MangaStatus enum: Reading, Completed, OnHold, Dropped, PlanToRead
- MangaEntry backend type has no `isFavourite` field
- MangaFormModal: free-text genre input (Enter to add), no genre suggestions
- Status badge in card is a plain non-interactive span
- No favourites system anywhere

## Requested Changes (Diff)

### Add
- `isFavourite: Bool` field to backend `MangaEntry` type
- `Incomplete` as a new `MangaStatus` variant in backend and frontend enum/labels/classes
- Heart icon on each watchlist card (toggles favourite state; turns pink when active)
- Heart icon in toolbar/top of page that, when clicked, filters list to favourited only
- Clickable chapter display on card: clicking opens a small inline popup to edit current chapter and total chapters numbers
- Clickable rating display on card: clicking opens a small inline popup to edit the rating number (1-10)
- Clickable status badge on card: clicking opens a dropdown to quickly pick a new status
- Genre suggestion box in MangaFormModal: shows all currently-existing genres (derived from all entries) as clickable chips the user can click to add without typing; only displays genres that actually exist in the list (dynamic, no stale mis-spelled genres)
- `toggleFavourite(id: Text) : async MangaEntry` backend endpoint
- `updateStatus(id: Text, status: MangaStatus) : async MangaEntry` backend endpoint
- `updateChapters(id: Text, currentChapter: Nat, totalChapters: ?Nat) : async MangaEntry` backend endpoint
- `updateRating(id: Text, rating: ?Nat) : async MangaEntry` backend endpoint

### Modify
- `CARD_HEIGHT` constant: 170 → 150
- `COVER_WIDTH_MAX` constant: 130 → 150 (increase cover width by 20px)
- All skeleton loader heights to match 150px
- `MangaStatus` enum: add `Incomplete` variant
- `STATUS_LABELS`: add `Incomplete: "Incomplete"`
- `STATUS_CLASS`: add `Incomplete: "status-incomplete"`
- `useMangaSync`: add `isFavourite` field to optimistic entries (default false); handle new backend endpoints; add `toggleFavourite`, `updateStatus`, `updateChapters`, `updateRating` mutation helpers
- `MangaFormModal`: add genre suggestion chip box above the genre input, showing existing genres from all entries (passed as prop `allGenres: string[]`); clicking a chip adds it to the current genre list if not already present
- `App.tsx`: pass `allGenres` to `MangaFormModal`; add favourites filter state; pass handlers to `MangaCard` for toggleFavourite, inline status change, inline chapter change, inline rating change
- `Toolbar`: add heart filter button next to Add button (or near filters); active state turns pink
- `SerializedEntry` in useMangaSync: add `isFavourite: boolean` field
- SEED_ENTRIES: add `isFavourite: false` to each seed

### Remove
- Nothing removed

## Implementation Plan
1. Update `main.mo`: add `isFavourite` to `MangaEntry`, add `Incomplete` to `MangaStatus`, add `toggleFavourite`, `updateStatus`, `updateChapters`, `updateRating` endpoints; update `addEntry` and `updateEntry` to accept/preserve `isFavourite`
2. Update `src/frontend/src/types/manga.ts`: add `Incomplete` to `MangaStatus` enum, add to `STATUS_LABELS` and `STATUS_CLASS`
3. Update `src/frontend/src/hooks/useMangaSync.ts`: add `isFavourite` to `SerializedEntry` and `ActorLike`; update serialize/deserialize; update seed entries; add `toggleFavourite`, `updateStatus`, `updateChapters`, `updateRating` helpers
4. Update `src/frontend/src/components/MangaCard.tsx`:
   - Change `CARD_HEIGHT` to 150, `COVER_WIDTH_MAX` to 150
   - Add heart icon button (pink when `isFavourite`, gold-dim outline otherwise)
   - Make chapter display clickable → opens inline popover with number inputs for current/total chapters
   - Make rating display clickable → opens inline popover with a 1-10 number input
   - Make status badge clickable → dropdown menu with all status options
5. Update `src/frontend/src/components/MangaFormModal.tsx`:
   - Accept `allGenres: string[]` prop
   - Show existing genre chips above the genre text input; clicking one adds it (if not already added)
6. Update `src/frontend/src/components/Toolbar.tsx`: add heart filter toggle button
7. Update `src/frontend/src/App.tsx`:
   - Add `showFavouritesOnly` filter state
   - Apply favourites filter in `filteredEntries`
   - Pass `allGenres` to `MangaFormModal`
   - Pass `onToggleFavourite`, `onQuickStatusChange`, `onQuickChapterChange`, `onQuickRatingChange` handlers down to `MangaCard`
   - Pass `showFavouritesOnly` and `onToggleFavouritesFilter` to `Toolbar`
8. Update skeleton loaders in `App.tsx` to use 150px height
