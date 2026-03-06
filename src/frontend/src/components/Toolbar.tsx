import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heart, Plus, Search, SlidersHorizontal } from "lucide-react";
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
  statusFilter: MangaStatus | "all";
  onStatusFilterChange: (v: MangaStatus | "all") => void;
  genreFilter: string;
  onGenreFilterChange: (v: string) => void;
  sortOption: SortOption;
  onSortChange: (v: SortOption) => void;
  onAddClick: () => void;
  allGenres: string[];
  showFavouritesOnly: boolean;
  onToggleFavouritesFilter: () => void;
}

export function Toolbar({
  search,
  onSearchChange,
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
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-2 px-4 md:px-6">
      {/* Row 1: Search + Add */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: GOLD_DIM }}
          />
          <Input
            data-ocid="manga.search_input"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search your watchlist…"
            style={{ ...inputStyle, paddingLeft: "2.25rem" }}
            aria-label="Search manga"
          />
        </div>
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

        {/* Genre filter */}
        {allGenres.length > 0 && (
          <Select
            value={genreFilter || "all"}
            onValueChange={(v) => onGenreFilterChange(v === "all" ? "" : v)}
          >
            <SelectTrigger
              className="h-8 text-xs"
              style={{ ...inputStyle, height: "2rem", minWidth: "130px" }}
            >
              <SelectValue placeholder="All Genres" />
            </SelectTrigger>
            <SelectContent style={selectContentStyle}>
              <SelectItem value="all" style={{ color: GOLD }}>
                All Genres
              </SelectItem>
              {allGenres.map((g) => (
                <SelectItem key={g} value={g} style={{ color: GOLD }}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

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
            <SelectItem value="chapter-progress" style={{ color: GOLD }}>
              Chapter Progress
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
