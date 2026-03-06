import { Toaster } from "@/components/ui/sonner";
import { BookOpen, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useActor } from "./hooks/useActorFixed";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useMangaSync } from "./hooks/useMangaSync";

import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import { Header } from "./components/Header";
import { LoginPage } from "./components/LoginPage";
import { MangaCard } from "./components/MangaCard";
import { MangaFormModal } from "./components/MangaFormModal";
import { StatsBar } from "./components/StatsBar";
import { Toolbar } from "./components/Toolbar";

import type { MangaStatus as BackendMangaStatus } from "./backend.d";
import type { MangaEntry } from "./hooks/useMangaSync";
import type { MangaFormData, SortOption } from "./types/manga";
import type { MangaStatus } from "./types/manga";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";

// Register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failed — not critical
    });
  });
}

export default function App() {
  const { identity, clear, isInitializing } = useInternetIdentity();
  const { actor, isFetching: isActorFetching } = useActor();
  const isAuthenticated = !!identity;

  const {
    entries,
    isLoading,
    isSyncing,
    fetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleFavourite,
    updateStatus,
    updateChapters,
    updateRating,
    pendingCount,
  } = useMangaSync();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MangaStatus | "all">("all");
  const [genreFilter, setGenreFilter] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated-desc");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MangaEntry | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<MangaEntry | null>(null);

  // ── Fetch entries when actor is ready ──────────────────────────────────────
  useEffect(() => {
    if (actor && isAuthenticated && !isActorFetching) {
      void fetchEntries(actor as unknown as Parameters<typeof fetchEntries>[0]);
    }
  }, [actor, isAuthenticated, isActorFetching, fetchEntries]);

  // ── All genres for filter ──────────────────────────────────────────────────
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      for (const g of e.genres) {
        set.add(g);
      }
    }
    return Array.from(set).sort();
  }, [entries]);

  // ── Filtered + sorted entries ──────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    let result = entries;

    if (showFavouritesOnly) {
      result = result.filter((e) => e.isFavourite === true);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.genres.some((g) => g.toLowerCase().includes(q)) ||
          e.notes.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    if (genreFilter) {
      result = result.filter((e) => e.genres.includes(genreFilter));
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "rating-desc": {
          const ra = a.rating != null ? Number(a.rating) : -1;
          const rb = b.rating != null ? Number(b.rating) : -1;
          return rb - ra;
        }
        case "rating-asc": {
          const ra = a.rating != null ? Number(a.rating) : 11;
          const rb = b.rating != null ? Number(b.rating) : 11;
          return ra - rb;
        }
        case "chapter-progress": {
          const ap =
            a.totalChapters != null && Number(a.totalChapters) > 0
              ? Number(a.currentChapter) / Number(a.totalChapters)
              : Number(a.currentChapter);
          const bp =
            b.totalChapters != null && Number(b.totalChapters) > 0
              ? Number(b.currentChapter) / Number(b.totalChapters)
              : Number(b.currentChapter);
          return bp - ap;
        }
        default:
          return Number(b.updatedAt - a.updatedAt);
      }
    });

    return result;
  }, [
    entries,
    search,
    statusFilter,
    genreFilter,
    sortOption,
    showFavouritesOnly,
  ]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddClick = useCallback(() => {
    setEditingEntry(null);
    setFormOpen(true);
  }, []);

  const handleEditClick = useCallback((entry: MangaEntry) => {
    setEditingEntry(entry);
    setFormOpen(true);
  }, []);

  const handleDeleteClick = useCallback((entry: MangaEntry) => {
    setDeleteTarget(entry);
  }, []);

  const handleFormSubmit = useCallback(
    async (data: MangaFormData) => {
      try {
        if (editingEntry) {
          await updateEntry(
            actor as unknown as Parameters<typeof updateEntry>[0],
            editingEntry.id,
            { ...data, isFavourite: editingEntry.isFavourite },
          );
          toast.success("Entry updated");
        } else {
          await addEntry(actor as unknown as Parameters<typeof addEntry>[0], {
            ...data,
            isFavourite: false,
          });
          toast.success(`"${data.title}" added to watchlist`);
        }
      } catch {
        toast.error("Failed to save entry");
        throw new Error("Failed to save entry");
      }
    },
    [editingEntry, actor, updateEntry, addEntry],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    const title = deleteTarget.title;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteEntry(
        actor as unknown as Parameters<typeof deleteEntry>[0],
        id,
      );
      toast.success(`"${title}" removed`);
    } catch {
      toast.error("Failed to delete entry");
    }
  }, [deleteTarget, actor, deleteEntry]);

  const handleLogout = useCallback(() => {
    clear();
    toast("Signed out");
  }, [clear]);

  const handleToggleFavourite = useCallback(
    (entry: MangaEntry) => {
      void toggleFavourite(
        actor as unknown as Parameters<typeof toggleFavourite>[0],
        entry.id,
      );
    },
    [toggleFavourite, actor],
  );

  const handleQuickStatusChange = useCallback(
    (entry: MangaEntry, status: MangaStatus) => {
      void updateStatus(
        actor as unknown as Parameters<typeof updateStatus>[0],
        entry.id,
        status as unknown as BackendMangaStatus,
      );
    },
    [updateStatus, actor],
  );

  const handleQuickChapterChange = useCallback(
    (entry: MangaEntry, current: number, total: number | undefined) => {
      void updateChapters(
        actor as unknown as Parameters<typeof updateChapters>[0],
        entry.id,
        current,
        total,
      );
    },
    [updateChapters, actor],
  );

  const handleQuickRatingChange = useCallback(
    (entry: MangaEntry, rating: number | undefined) => {
      void updateRating(
        actor as unknown as Parameters<typeof updateRating>[0],
        entry.id,
        rating,
      );
    },
    [updateRating, actor],
  );

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        >
          <RefreshCw size={24} style={{ color: GOLD_DIM }} strokeWidth={1.5} />
        </motion.div>
      </div>
    );
  }

  // ── Login screen ───────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-black flex flex-col">
      <Toaster
        toastOptions={{
          style: {
            background: "#000",
            border: `1px solid ${GOLD}`,
            color: GOLD,
          },
        }}
      />

      <Header
        onLogout={handleLogout}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
      />

      <main className="flex-1 flex flex-col gap-4 py-4">
        {/* Stats bar */}
        <StatsBar entries={entries} />

        {/* Divider */}
        <div
          className="mx-4 md:mx-6 h-px"
          style={{ background: "oklch(0.82 0.17 85 / 0.15)" }}
          aria-hidden="true"
        />

        {/* Toolbar */}
        <Toolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          genreFilter={genreFilter}
          onGenreFilterChange={setGenreFilter}
          sortOption={sortOption}
          onSortChange={setSortOption}
          onAddClick={handleAddClick}
          allGenres={allGenres}
          showFavouritesOnly={showFavouritesOnly}
          onToggleFavouritesFilter={() => setShowFavouritesOnly((v) => !v)}
        />

        {/* List */}
        <section className="px-4 md:px-6" aria-label="Manga list">
          {/* Loading skeleton */}
          {isLoading && entries.length === 0 && (
            <div data-ocid="manga.list" className="flex flex-col gap-3">
              {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map(
                (key) => (
                  <div
                    key={key}
                    className="rounded-lg overflow-hidden flex flex-row"
                    style={{
                      width: 1300,
                      maxWidth: "100%",
                      height: 150,
                      border: "1px solid oklch(0.82 0.17 85 / 0.2)",
                    }}
                  >
                    {/* Cover skeleton */}
                    <div
                      style={{
                        width: 115,
                        height: 150,
                        flexShrink: 0,
                        background:
                          "linear-gradient(90deg, oklch(0.05 0 0) 25%, oklch(0.08 0 0) 50%, oklch(0.05 0 0) 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.5s linear infinite",
                      }}
                    />
                    {/* Title skeleton */}
                    <div
                      style={{
                        width: 240,
                        height: 150,
                        flexShrink: 0,
                        padding: "12px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        borderLeft: "1px solid oklch(0.82 0.17 85 / 0.1)",
                      }}
                    >
                      <div
                        className="h-3 rounded"
                        style={{ background: "oklch(0.1 0 0)", width: "90%" }}
                      />
                      <div
                        className="h-3 rounded"
                        style={{ background: "oklch(0.08 0 0)", width: "70%" }}
                      />
                      <div
                        className="h-3 rounded"
                        style={{ background: "oklch(0.07 0 0)", width: "55%" }}
                      />
                    </div>
                    {/* Info skeleton */}
                    <div
                      style={{
                        flex: 1,
                        height: 150,
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        justifyContent: "center",
                        borderLeft: "1px solid oklch(0.82 0.17 85 / 0.1)",
                      }}
                    >
                      <div
                        className="h-4 rounded"
                        style={{ background: "oklch(0.1 0 0)", width: 80 }}
                      />
                      <div
                        className="h-2 rounded"
                        style={{ background: "oklch(0.08 0 0)", width: 120 }}
                      />
                      <div
                        className="h-2 rounded"
                        style={{ background: "oklch(0.07 0 0)", width: 90 }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && filteredEntries.length === 0 && (
            <div
              data-ocid="manga.empty_state"
              className="flex flex-col items-center justify-center py-20 gap-4"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ border: "1px solid oklch(0.82 0.17 85 / 0.3)" }}
              >
                <BookOpen
                  size={28}
                  style={{ color: "oklch(0.82 0.17 85 / 0.4)" }}
                  strokeWidth={1}
                />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold" style={{ color: GOLD_DIM }}>
                  {showFavouritesOnly
                    ? "No favourites yet"
                    : search || statusFilter !== "all" || genreFilter
                      ? "No results found"
                      : "Your watchlist is empty"}
                </p>
                <p className="text-sm" style={{ color: "oklch(0.40 0.08 85)" }}>
                  {showFavouritesOnly
                    ? "Click the heart icon on any title to favourite it"
                    : search || statusFilter !== "all" || genreFilter
                      ? "Try adjusting your filters"
                      : "Add your first manga to get started"}
                </p>
              </div>
              {!showFavouritesOnly &&
                !search &&
                statusFilter === "all" &&
                !genreFilter && (
                  <button
                    type="button"
                    onClick={handleAddClick}
                    className="text-sm font-medium px-4 py-2 rounded transition-all duration-200"
                    style={{
                      border: `1px solid ${GOLD}`,
                      color: GOLD,
                      background: "transparent",
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
                    Add your first manga
                  </button>
                )}
            </div>
          )}

          {/* List */}
          {filteredEntries.length > 0 && (
            <div data-ocid="manga.list" className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {filteredEntries.map((entry, index) => (
                  <MangaCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onToggleFavourite={handleToggleFavourite}
                    onQuickStatusChange={handleQuickStatusChange}
                    onQuickChapterChange={handleQuickChapterChange}
                    onQuickRatingChange={handleQuickRatingChange}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="px-4 md:px-6 py-4 mt-auto">
        <div
          className="h-px mb-4"
          style={{ background: "oklch(0.82 0.17 85 / 0.1)" }}
          aria-hidden="true"
        />
        <p
          className="text-center text-xs"
          style={{ color: "oklch(0.40 0.08 85)" }}
        >
          © {new Date().getFullYear()}. Built with{" "}
          <span style={{ color: GOLD_DIM }}>♥</span> using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors"
            style={{ color: GOLD_DIM }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = GOLD;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = GOLD_DIM;
            }}
          >
            caffeine.ai
          </a>
        </p>
      </footer>

      {/* Modals */}
      <MangaFormModal
        open={formOpen}
        entry={editingEntry}
        onClose={() => {
          setFormOpen(false);
          setEditingEntry(null);
        }}
        onSubmit={handleFormSubmit}
        allGenres={allGenres}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.title ?? ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
