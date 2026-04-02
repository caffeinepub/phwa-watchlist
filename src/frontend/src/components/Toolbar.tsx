import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  Download,
  Heart,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MangaStatus, STATUS_LABELS, type SortOption } from "../types/manga";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";

const inputStyle: React.CSSProperties = {
  background: "#000",
  border: "1px solid oklch(0.82 0.17 85 / 0.6)",
  color: GOLD,
  height: "2.25rem",
  fontSize: "0.875rem",
};

const selectContentStyle: React.CSSProperties = {
  background: "#000",
  border: `1px solid ${GOLD}`,
  color: GOLD,
};

const PINK = "oklch(0.75 0.22 0)";

interface ToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  searchScope: "titles" | "notes" | "synopsis";
  onSearchScopeChange: (v: "titles" | "notes" | "synopsis") => void;
  statusFilter: MangaStatus | "all";
  onStatusFilterChange: (v: MangaStatus | "all") => void;
  genreFilter: string[];
  onGenreFilterChange: (v: string[]) => void;
  sortOption: SortOption;
  onSortChange: (v: SortOption) => void;
  onAddClick: () => void;
  allGenres: string[];
  showFavouritesOnly: boolean;
  onToggleFavouritesFilter: () => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onDeleteAllClick: () => void;
}

// ── Genre Multi-Select Dropdown ───────────────────────────────────────────────

interface GenreFilterDropdownProps {
  allGenres: string[];
  genreFilter: string[];
  onGenreFilterChange: (v: string[]) => void;
}

function GenreFilterDropdown({
  allGenres,
  genreFilter,
  onGenreFilterChange,
}: GenreFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        !containerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  const toggleGenre = (genre: string) => {
    if (genreFilter.includes(genre)) {
      onGenreFilterChange(genreFilter.filter((g) => g !== genre));
    } else {
      onGenreFilterChange([...genreFilter, genre]);
    }
  };

  const label =
    genreFilter.length === 0
      ? "All Genres"
      : genreFilter.length === 1
        ? genreFilter[0]
        : `${genreFilter.length} genres`;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        type="button"
        data-ocid="toolbar.genre_filter.toggle"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs"
        style={{
          ...inputStyle,
          height: "2rem",
          minWidth: 130,
          padding: "0 10px",
          borderRadius: "0.375rem",
          cursor: "pointer",
          justifyContent: "space-between",
        }}
        aria-label="Filter by genre"
        title="Filter by genre"
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 100,
            color: genreFilter.length > 0 ? GOLD : GOLD_DIM,
          }}
        >
          {label}
        </span>
        <ChevronDown
          size={12}
          strokeWidth={2}
          style={{
            color: GOLD_DIM,
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={dropdownRef}
          data-ocid="toolbar.genre_filter.dropdown_menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            background: "#000",
            border: `1px solid ${GOLD}`,
            borderRadius: "0.375rem",
            padding: "4px",
            minWidth: 180,
            maxHeight: 280,
            overflowY: "auto",
            scrollbarWidth: "none",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          }}
        >
          {/* Clear button */}
          {genreFilter.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onGenreFilterChange([]);
              }}
              className="flex items-center gap-1.5 w-full text-left text-xs px-2 py-1.5 rounded"
              style={{
                color: "oklch(0.7 0.22 25)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                marginBottom: 2,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "oklch(0.7 0.22 25 / 0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              <X size={11} strokeWidth={2} />
              Clear selection
            </button>
          )}

          {/* Divider after clear */}
          {genreFilter.length > 0 && (
            <div
              style={{
                height: 1,
                background: "oklch(0.82 0.17 85 / 0.15)",
                margin: "2px 4px 4px",
              }}
            />
          )}

          {/* Genre checkboxes */}
          {allGenres.map((genre) => {
            const checked = genreFilter.includes(genre);
            const checkboxId = `genre-filter-${genre.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <label
                key={genre}
                htmlFor={checkboxId}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs select-none"
                style={{
                  color: checked ? GOLD : GOLD_DIM,
                  background: checked
                    ? "oklch(0.82 0.17 85 / 0.08)"
                    : "transparent",
                  transition: "background 0.1s, color 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!checked) {
                    (e.currentTarget as HTMLElement).style.background =
                      "oklch(0.82 0.17 85 / 0.05)";
                    (e.currentTarget as HTMLElement).style.color = GOLD;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!checked) {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color = GOLD_DIM;
                  }
                }}
              >
                <Checkbox
                  id={checkboxId}
                  checked={checked}
                  onCheckedChange={() => toggleGenre(genre)}
                  style={{
                    width: 13,
                    height: 13,
                    flexShrink: 0,
                    borderColor: checked ? GOLD : "oklch(0.82 0.17 85 / 0.4)",
                    background: checked
                      ? "oklch(0.82 0.17 85 / 0.15)"
                      : "transparent",
                  }}
                />
                <span style={{ lineHeight: 1.3 }}>{genre}</span>
              </label>
            );
          })}

          {allGenres.length === 0 && (
            <p
              className="text-xs px-2 py-2"
              style={{ color: GOLD_DIM, fontStyle: "italic" }}
            >
              No genres yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function Toolbar({
  search,
  onSearchChange,
  searchScope,
  onSearchScopeChange,
  statusFilter,
  onStatusFilterChange,
  genreFilter,
  onGenreFilterChange,
  sortOption,
  onSortChange,
  onAddClick,
  allGenres,
  showFavouritesOnly,
  onToggleFavouritesFilter,
  onImportClick,
  onExportClick,
  onDeleteAllClick,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-2 px-4 md:px-6">
      {/* Row 1: Search + Add */}
      <div className="flex gap-2 items-center">
        <div className="relative" style={{ width: 240, flexShrink: 0 }}>
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: GOLD_DIM }}
          />
          <Input
            data-ocid="manga.search_input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            style={{ ...inputStyle, paddingLeft: "2.25rem" }}
            aria-label="Search manga"
          />
        </div>

        {/* Search scope dropdown */}
        <Select
          value={searchScope}
          onValueChange={(v) =>
            onSearchScopeChange(v as "titles" | "notes" | "synopsis")
          }
        >
          <SelectTrigger
            data-ocid="manga.search_scope.select"
            className="h-9 text-xs shrink-0"
            style={{ ...inputStyle, height: "2.25rem", minWidth: "110px" }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={selectContentStyle}>
            <SelectItem value="titles" style={{ color: GOLD }}>
              Titles
            </SelectItem>
            <SelectItem value="notes" style={{ color: GOLD }}>
              Notes
            </SelectItem>
            <SelectItem value="synopsis" style={{ color: GOLD }}>
              Synopsis
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Favourites filter button */}
        <button
          type="button"
          data-ocid="manga.favourites_filter.toggle"
          onClick={onToggleFavouritesFilter}
          aria-label={
            showFavouritesOnly ? "Show all manga" : "Show favourites only"
          }
          title={showFavouritesOnly ? "Show all manga" : "Show favourites only"}
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded transition-all duration-200"
          style={{
            background: showFavouritesOnly
              ? "oklch(0.75 0.22 0 / 0.12)"
              : "transparent",
            border: showFavouritesOnly
              ? `1.5px solid ${PINK}`
              : "1.5px solid oklch(0.82 0.17 85 / 0.5)",
            color: showFavouritesOnly ? PINK : GOLD_DIM,
          }}
        >
          <Heart
            size={15}
            strokeWidth={showFavouritesOnly ? 0 : 1.5}
            style={{
              fill: showFavouritesOnly ? PINK : "transparent",
              color: showFavouritesOnly ? PINK : GOLD_DIM,
              transition: "fill 0.2s, color 0.2s",
            }}
          />
        </button>

        <Button
          data-ocid="manga.add_button"
          onClick={onAddClick}
          className="h-9 px-4 shrink-0 font-semibold text-sm transition-all duration-200"
          style={{
            background: "transparent",
            border: `1.5px solid ${GOLD}`,
            color: GOLD,
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = GOLD;
            el.style.color = "#000";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "transparent";
            el.style.color = GOLD;
          }}
        >
          <Plus size={15} className="mr-1.5" strokeWidth={2.5} />
          <span className="hidden sm:inline">Add Manga</span>
          <span className="sm:hidden">Add</span>
        </Button>

        {/* Import button */}
        <button
          type="button"
          data-ocid="toolbar.import_button"
          onClick={onImportClick}
          className="h-9 px-3 shrink-0 flex items-center gap-1.5 text-sm font-semibold rounded transition-all duration-200"
          style={{
            background: "transparent",
            border: `1.5px solid ${GOLD}`,
            color: GOLD,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = GOLD;
            el.style.color = "#000";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "transparent";
            el.style.color = GOLD;
          }}
          aria-label="Import watchlist"
          title="Import watchlist"
        >
          <Upload size={14} strokeWidth={2} />
          <span className="hidden sm:inline">Import</span>
        </button>

        {/* Export button */}
        <button
          type="button"
          data-ocid="toolbar.export_button"
          onClick={onExportClick}
          className="h-9 px-3 shrink-0 flex items-center gap-1.5 text-sm font-semibold rounded transition-all duration-200"
          style={{
            background: "transparent",
            border: `1.5px solid ${GOLD}`,
            color: GOLD,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = GOLD;
            el.style.color = "#000";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "transparent";
            el.style.color = GOLD;
          }}
          aria-label="Export watchlist"
          title="Export watchlist"
        >
          <Download size={14} strokeWidth={2} />
          <span className="hidden sm:inline">Export</span>
        </button>

        {/* Delete All button */}
        <button
          type="button"
          data-ocid="toolbar.delete_all_button"
          onClick={onDeleteAllClick}
          className="h-9 px-3 shrink-0 flex items-center gap-1.5 text-sm font-semibold rounded transition-all duration-200"
          style={{
            background: "transparent",
            border: "1.5px solid oklch(0.65 0.22 25 / 0.7)",
            color: "oklch(0.65 0.22 25)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = "oklch(0.65 0.22 25 / 0.15)";
            el.style.borderColor = "oklch(0.65 0.22 25)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = "transparent";
            el.style.borderColor = "oklch(0.65 0.22 25 / 0.7)";
          }}
          aria-label="Delete all entries"
          title="Delete all entries"
        >
          <Trash2 size={14} strokeWidth={2} />
          <span className="hidden sm:inline">Delete All</span>
        </button>
      </div>

      {/* Row 2: Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <SlidersHorizontal size={13} style={{ color: GOLD_DIM }} />

        {/* Status filter */}
        <Select
          value={statusFilter}
          onValueChange={(v) => onStatusFilterChange(v as MangaStatus | "all")}
        >
          <SelectTrigger
            data-ocid="manga.status_filter.select"
            className="h-8 text-xs"
            style={{ ...inputStyle, height: "2rem", minWidth: "130px" }}
          >
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent style={selectContentStyle}>
            <SelectItem value="all" style={{ color: GOLD }}>
              All Status
            </SelectItem>
            {Object.values(MangaStatus).map((s) => (
              <SelectItem key={s} value={s} style={{ color: GOLD }}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Genre filter — multi-select checkboxes */}
        <GenreFilterDropdown
          allGenres={allGenres}
          genreFilter={genreFilter}
          onGenreFilterChange={onGenreFilterChange}
        />

        {/* Sort */}
        <Select
          value={sortOption}
          onValueChange={(v) => onSortChange(v as SortOption)}
        >
          <SelectTrigger
            data-ocid="manga.sort.select"
            className="h-8 text-xs"
            style={{ ...inputStyle, height: "2rem", minWidth: "160px" }}
          >
            <SelectValue placeholder="Sort by…" />
          </SelectTrigger>
          <SelectContent style={selectContentStyle}>
            <SelectItem value="updated-desc" style={{ color: GOLD }}>
              Recently Updated
            </SelectItem>
            <SelectItem value="title-asc" style={{ color: GOLD }}>
              Title A → Z
            </SelectItem>
            <SelectItem value="title-desc" style={{ color: GOLD }}>
              Title Z → A
            </SelectItem>
            <SelectItem value="rating-desc" style={{ color: GOLD }}>
              Rating High → Low
            </SelectItem>
            <SelectItem value="rating-asc" style={{ color: GOLD }}>
              Rating Low → High
            </SelectItem>
            <SelectItem value="cen-lvl-desc" style={{ color: GOLD }}>
              Cen LVL High → Low
            </SelectItem>
            <SelectItem value="cen-lvl-asc" style={{ color: GOLD }}>
              Cen LVL Low → High
            </SelectItem>
            <SelectItem value="chapter-progress" style={{ color: GOLD }}>
              Chapter Progress
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
