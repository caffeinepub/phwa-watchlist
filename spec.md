# Phwa Watchlist

## Current State
Pagination buttons appear floating in the middle of the page (horizontally next to the list content) because the outer scroll wrapper uses `display: flex; justifyContent: center` which places the list div and pagination div side-by-side in a row.

## Requested Changes (Diff)

### Add
- Nothing new

### Modify
- Outer scroll wrapper div: change from `display: flex; justifyContent: center` to `display: flex; flexDirection: column; alignItems: center` so pagination flows below the list
- Move `overflowX: auto`, `overflowY: auto`, padding to the inner `maxWidth: 1160px` content div

### Remove
- Nothing removed

## Implementation Plan
1. Update the outer div flex direction to column so pagination appears below the list, horizontally centered — matching the layout behavior of all other page elements
