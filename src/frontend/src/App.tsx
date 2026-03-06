import { Toaster } from "@/components/ui/sonner";
import { BookOpen, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useActor } from "./hooks/useActorFixed";
import { useCycleBalance } from "./hooks/useCycleBalance";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useMangaSync } from "./hooks/useMangaSync";

import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import { Header } from "./components/Header";
import { ImportModal } from "./components/ImportModal";
import { LoginPage } from "./components/LoginPage";
import { MangaCard } from "./components/MangaCard";
import { MangaFormModal } from "./components/MangaFormModal";
import { PasswordGate } from "./components/PasswordGate";
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
    updateArtRating,
    updateCenLvl,
    pendingCount,
    lastSynced,
  } = useMangaSync();

  // ── Cycle balance monitor ───────────────────────────────────────────────────
  const { cycleBalance } = useCycleBalance(isAuthenticated);

  // ── Password gate state ─────────────────────────────────────────────────────
  const [passwordCleared, setPasswordCleared] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [searchScope, setSearchScope] = useState<
    "titles" | "notes" | "synopsis"
  >("titles");
  const [statusFilter, setStatusFilter] = useState<MangaStatus | "all">("all");
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("title-asc");
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);

  // ── Pagination ──────────────────────────────────────────────────────────────
  const ITEMS_PER_PAGE = 30;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");
  const isFirstFilterRender = useRef(true);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MangaEntry | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<MangaEntry | null>(null);

  // Soft-delete / undo state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Import/Export state
  const [importOpen, setImportOpen] = useState(false);

  // ── Fetch entries when actor is ready ──────────────────────────────────────
  useEffect(() => {
    if (actor && isAuthenticated && !isActorFetching) {
      const init = async () => {
        // Step 1: Register the caller using the safe initialization path.
        // _initializeAccessControlWithSecret uses AccessControl.initialize()
        // which safely registers any unregistered non-anonymous caller as a
        // #user without trapping — unlike registerCaller() which calls
        // getUserRole() first and Runtime.trap()s for brand new principals.
        // Retry up to 6 times to handle transient canister startup delays.
        const delays = [500, 1000, 1500, 2000, 3000];
        let registered = false;
        for (let attempt = 0; attempt <= delays.length; attempt++) {
          try {
            await (actor as any)._initializeAccessControlWithSecret("");
            registered = true;
            break;
          } catch {
            if (attempt < delays.length) {
              await new Promise((r) => setTimeout(r, delays[attempt]));
            }
          }
        }

        if (!registered) {
          toast.error(
            "Could not connect to backend. Please refresh and try again.",
          );
          return;
        }

        // Step 2: Fetch entries. The caller is now registered and authorized.
        await fetchEntries(
          actor as unknown as Parameters<typeof fetchEntries>[0],
        );
      };
      void init();
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

  // ── Stable sort order ──────────────────────────────────────────────────────
  // We keep a stable ordered list of IDs that only re-sorts when the user
  // explicitly changes a sort/filter option — NOT when individual entries are
  // mutated (status, chapters, rating, etc.). This prevents the list from
  // reshuffling under the user's mouse after every quick edit.
  const stableOrderRef = useRef<string[]>([]);
  const sortKeyRef = useRef("");

  // Build a string key from all options that should trigger a re-sort
  const sortKey = `${sortOption}|${search}|${searchScope}|${statusFilter}|${genreFilter.join(",")}|${showFavouritesOnly}`;

  // Helper: sort + filter entries into an ordered list of IDs
  const buildSortedIds = useCallback(
    (source: typeof entries) => {
      let result = source;

      if (showFavouritesOnly) {
        result = result.filter((e) => e.isFavourite === true);
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        if (searchScope === "titles") {
          result = result.filter(
            (e) =>
              e.title.toLowerCase().includes(q) ||
              (e.altTitle1 ?? "").toLowerCase().includes(q) ||
              (e.altTitle2 ?? "").toLowerCase().includes(q),
          );
        } else if (searchScope === "notes") {
          result = result.filter((e) =>
            (e.notes ?? "").toLowerCase().includes(q),
          );
        } else if (searchScope === "synopsis") {
          result = result.filter((e) =>
            (e.synopsis ?? "").toLowerCase().includes(q),
          );
        }
      }

      if (statusFilter !== "all") {
        result = result.filter((e) => e.status === statusFilter);
      }

      if (genreFilter.length > 0) {
        result = result.filter((e) =>
          e.genres.some((g) => genreFilter.includes(g)),
        );
      }

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

      return result.map((e) => e.id);
    },
    [
      sortOption,
      search,
      searchScope,
      statusFilter,
      genreFilter,
      showFavouritesOnly,
    ],
  );

  // ── Filtered + sorted entries ──────────────────────────────────────────────
  // Re-sort only when sort/filter options change, not on data mutations.
  const filteredEntries = useMemo(() => {
    // Build an entry map for fast lookup
    const entryMap = new Map(entries.map((e) => [e.id, e]));

    // If sort key changed, rebuild the stable order
    if (sortKey !== sortKeyRef.current) {
      sortKeyRef.current = sortKey;
      stableOrderRef.current = buildSortedIds(entries);
    } else {
      // Sort key unchanged — data was mutated (e.g. status change).
      // Reconcile stable order: remove deleted IDs, append any new IDs at top.
      const existingIds = new Set(stableOrderRef.current);
      const newIds = entries
        .filter((e) => !existingIds.has(e.id))
        .map((e) => e.id);
      const reconciled = [
        ...newIds,
        ...stableOrderRef.current.filter((id) => entryMap.has(id)),
      ];

      // Re-apply filters (but NOT re-sort) so deleted/status-filtered entries
      // disappear correctly without changing positions of remaining entries.
      let filtered = reconciled
        .map((id) => entryMap.get(id))
        .filter((e): e is (typeof entries)[0] => e !== undefined);

      if (showFavouritesOnly) {
        filtered = filtered.filter((e) => e.isFavourite === true);
      }
      if (statusFilter !== "all") {
        filtered = filtered.filter((e) => e.status === statusFilter);
      }
      if (genreFilter.length > 0) {
        filtered = filtered.filter((e) =>
          e.genres.some((g) => genreFilter.includes(g)),
        );
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (searchScope === "titles") {
          filtered = filtered.filter(
            (e) =>
              e.title.toLowerCase().includes(q) ||
              (e.altTitle1 ?? "").toLowerCase().includes(q) ||
              (e.altTitle2 ?? "").toLowerCase().includes(q),
          );
        } else if (searchScope === "notes") {
          filtered = filtered.filter((e) =>
            (e.notes ?? "").toLowerCase().includes(q),
          );
        } else if (searchScope === "synopsis") {
          filtered = filtered.filter((e) =>
            (e.synopsis ?? "").toLowerCase().includes(q),
          );
        }
      }

      stableOrderRef.current = filtered.map((e) => e.id);
      return filtered;
    }

    // Map stable IDs back to live entry objects
    return stableOrderRef.current
      .map((id) => entryMap.get(id))
      .filter((e): e is (typeof entries)[0] => e !== undefined);
  }, [
    entries,
    sortKey,
    buildSortedIds,
    search,
    searchScope,
    statusFilter,
    genreFilter,
    showFavouritesOnly,
  ]);

  // ── Reset page when filters/sort change ───────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: sortKey encodes all filter values
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    setCurrentPage(1);
    setPageInputValue("1");
  }, [sortKey]);

  // ── Pagination computed values ──────────────────────────────────────────────
  // Filter out any entry that is pending deletion (soft-delete / undo window)
  const visibleEntries = pendingDeleteId
    ? filteredEntries.filter((e) => e.id !== pendingDeleteId)
    : filteredEntries;

  const totalPages = Math.max(
    1,
    Math.ceil(visibleEntries.length / ITEMS_PER_PAGE),
  );
  const pagedEntries = visibleEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.min(Math.max(1, page), totalPages);
      setCurrentPage(clamped);
      setPageInputValue(String(clamped));
    },
    [totalPages],
  );

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
        // Treat seed/temp entries (ids that never existed in the backend) as new adds
        const isSeedOrTemp =
          editingEntry &&
          (editingEntry.id.startsWith("seed-") ||
            editingEntry.id.startsWith("temp-"));

        if (editingEntry && !isSeedOrTemp) {
          await updateEntry(
            actor as unknown as Parameters<typeof updateEntry>[0],
            editingEntry.id,
            { ...data, isFavourite: editingEntry.isFavourite },
          );
          toast.success("Entry updated");
        } else if (editingEntry && isSeedOrTemp) {
          // Remove the old seed/temp entry first, then add as a real entry
          await deleteEntry(
            actor as unknown as Parameters<typeof deleteEntry>[0],
            editingEntry.id,
          ).catch(() => {
            // seed entries don't exist on backend — deletion is best-effort
          });
          await addEntry(actor as unknown as Parameters<typeof addEntry>[0], {
            ...data,
            isFavourite: editingEntry.isFavourite ?? false,
          });
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
    [editingEntry, actor, updateEntry, addEntry, deleteEntry],
  );

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    const title = deleteTarget.title;
    const entryToDelete = deleteTarget;
    setDeleteTarget(null);

    // Cancel any existing pending delete
    if (pendingDeleteTimerRef.current) {
      clearTimeout(pendingDeleteTimerRef.current);
      pendingDeleteTimerRef.current = null;
    }

    // Optimistically hide the entry in UI immediately
    setPendingDeleteId(entryToDelete.id);

    // Show toast with Undo action
    toast(`"${title}" removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          // Cancel the pending delete
          if (pendingDeleteTimerRef.current) {
            clearTimeout(pendingDeleteTimerRef.current);
            pendingDeleteTimerRef.current = null;
          }
          setPendingDeleteId(null);
        },
      },
      duration: 5000,
    });

    // After 5s, commit the delete for real
    pendingDeleteTimerRef.current = setTimeout(() => {
      pendingDeleteTimerRef.current = null;
      setPendingDeleteId(null);
      void deleteEntry(
        actor as unknown as Parameters<typeof deleteEntry>[0],
        entryToDelete.id,
      ).catch(() => {
        toast.error(`Failed to delete "${title}"`);
      });
    }, 5000);
  }, [deleteTarget, actor, deleteEntry]);

  const handleLogout = useCallback(() => {
    clear();
    setPasswordCleared(false);
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

  const handleQuickArtRatingChange = useCallback(
    (entry: MangaEntry, artRating: number | undefined) => {
      void updateArtRating(
        actor as unknown as Parameters<typeof updateArtRating>[0],
        entry.id,
        artRating,
      );
    },
    [updateArtRating, actor],
  );

  const handleQuickCenLvlChange = useCallback(
    (entry: MangaEntry, cenLvl: number | undefined) => {
      void updateCenLvl(
        actor as unknown as Parameters<typeof updateCenLvl>[0],
        entry.id,
        cenLvl,
      );
    },
    [updateCenLvl, actor],
  );

  const handleQuickNotesChange = useCallback(
    async (entry: MangaEntry, notes: string) => {
      try {
        await updateEntry(
          actor as unknown as Parameters<typeof updateEntry>[0],
          entry.id,
          {
            title: entry.title,
            synopsis: entry.synopsis,
            altTitle1: entry.altTitle1,
            altTitle2: entry.altTitle2,
            status: entry.status as unknown as MangaStatus,
            currentChapter: Number(entry.currentChapter),
            totalChapters:
              entry.totalChapters != null
                ? Number(entry.totalChapters)
                : undefined,
            rating: entry.rating != null ? Number(entry.rating) : undefined,
            artRating:
              entry.artRating != null ? Number(entry.artRating) : undefined,
            cenLvl: entry.cenLvl != null ? Number(entry.cenLvl) : undefined,
            coverImageUrl: entry.coverImageUrl,
            notes,
            genres: entry.genres,
            isFavourite: entry.isFavourite,
          },
        );
      } catch {
        toast.error("Failed to save notes");
      }
    },
    [updateEntry, actor],
  );

  const handleExport = useCallback(() => {
    const exportEntries = entries.map((entry) => ({
      id: entry.id,
      mainTitle: entry.title,
      ...(entry.altTitle1 ? { altTitle1: entry.altTitle1 } : {}),
      ...(entry.altTitle2 ? { altTitle2: entry.altTitle2 } : {}),
      synopsis: entry.synopsis || "",
      genres: entry.genres,
      rating: entry.rating != null ? String(Number(entry.rating)) : "N/A",
      cenLVL: entry.cenLvl != null ? String(entry.cenLvl) : "0",
      art: entry.artRating != null ? String(entry.artRating) : "0",
      chaptersOwned: String(Number(entry.totalChapters ?? 0)),
      chaptersRead: String(Number(entry.currentChapter)),
      personalNotes: entry.notes || "",
      bookmarked: entry.isFavourite,
      imageFilename: `${entry.id}.jpg`,
    }));

    const backup = {
      version: "2.0",
      timestamp: new Date().toISOString(),
      chunkIndex: 0,
      totalChunks: 1,
      totalEntries: exportEntries.length,
      chunkEntries: exportEntries.length,
      entries: exportEntries,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phwa-watchlist-export-${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportEntries.length} entries`);
  }, [entries]);

  const handleImportEntry = useCallback(
    async (data: MangaFormData) => {
      await addEntry(actor as unknown as Parameters<typeof addEntry>[0], {
        ...data,
        isFavourite: data.isFavourite ?? false,
      });
    },
    [addEntry, actor],
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

  // ── Password gate ──────────────────────────────────────────────────────────
  if (!passwordCleared) {
    return (
      <PasswordGate
        principalText={identity.getPrincipal().toText()}
        onSuccess={() => setPasswordCleared(true)}
      />
    );
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
        currentPage={currentPage}
        totalPages={totalPages}
        onGoToPage={goToPage}
        lastSynced={lastSynced}
        cycleBalance={cycleBalance}
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
          searchScope={searchScope}
          onSearchScopeChange={setSearchScope}
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
          onImportClick={() => setImportOpen(true)}
          onExportClick={handleExport}
        />

        {/* List — scroll wrapper handles overflow without dynamic sizing */}
        <section aria-label="Manga list">
          <div
            style={{
              overflowX: "auto",
              overflowY: "auto",
              paddingLeft: "1rem",
              paddingRight: "1rem",
            }}
          >
            {/* Loading skeleton */}
            {isLoading && entries.length === 0 && (
              <div
                data-ocid="manga.list"
                className="flex flex-col gap-3"
                style={{ minWidth: 1100 }}
              >
                {Array.from({ length: 5 }, (_, i) => `skeleton-${i}`).map(
                  (key) => (
                    <div
                      key={key}
                      className="rounded-lg overflow-hidden flex flex-row"
                      style={{
                        width: 1100,
                        height: 119,
                        border: "1px solid oklch(0.82 0.17 85 / 0.2)",
                      }}
                    >
                      {/* Cover skeleton */}
                      <div
                        style={{
                          width: 115,
                          height: 119,
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
                          height: 119,
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
                          style={{
                            background: "oklch(0.08 0 0)",
                            width: "70%",
                          }}
                        />
                        <div
                          className="h-3 rounded"
                          style={{
                            background: "oklch(0.07 0 0)",
                            width: "55%",
                          }}
                        />
                      </div>
                      {/* Info skeleton */}
                      <div
                        style={{
                          flex: 1,
                          height: 119,
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
            {!isLoading && visibleEntries.length === 0 && (
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
                      : search ||
                          statusFilter !== "all" ||
                          genreFilter.length > 0
                        ? "No results found"
                        : "Your watchlist is empty"}
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: "oklch(0.40 0.08 85)" }}
                  >
                    {showFavouritesOnly
                      ? "Click the heart icon on any title to favourite it"
                      : search ||
                          statusFilter !== "all" ||
                          genreFilter.length > 0
                        ? "Try adjusting your filters"
                        : "Add your first manga to get started"}
                  </p>
                </div>
                {!showFavouritesOnly &&
                  !search &&
                  statusFilter === "all" &&
                  genreFilter.length === 0 && (
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
            {visibleEntries.length > 0 && (
              <div
                data-ocid="manga.list"
                className="flex flex-col gap-3"
                style={{ minWidth: 1100 }}
              >
                <AnimatePresence mode="popLayout">
                  {pagedEntries.map((entry, index) => (
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
                      onQuickArtRatingChange={handleQuickArtRatingChange}
                      onQuickCenLvlChange={handleQuickCenLvlChange}
                      onQuickNotesChange={handleQuickNotesChange}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Pagination — outside scroll container so always visible */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-center gap-3 px-4 pt-4 pb-2 flex-wrap"
              style={{ color: GOLD_DIM }}
            >
              {/* Previous button */}
              <button
                type="button"
                data-ocid="pagination.pagination_prev"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center justify-center w-8 h-8 rounded transition-all duration-150"
                style={{
                  background: "transparent",
                  border: `1px solid ${currentPage === 1 ? "oklch(0.82 0.17 85 / 0.2)" : GOLD}`,
                  color:
                    currentPage === 1 ? "oklch(0.82 0.17 85 / 0.25)" : GOLD,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== 1) {
                    const el = e.currentTarget;
                    el.style.background = GOLD;
                    el.style.color = "#000";
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== 1) {
                    const el = e.currentTarget;
                    el.style.background = "transparent";
                    el.style.color = GOLD;
                  }
                }}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} strokeWidth={2} />
              </button>

              {/* Page indicator */}
              <span
                className="text-sm font-medium"
                style={{ color: GOLD_DIM, minWidth: 80, textAlign: "center" }}
              >
                Page {currentPage} of {totalPages}
              </span>

              {/* Next button */}
              <button
                type="button"
                data-ocid="pagination.pagination_next"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center w-8 h-8 rounded transition-all duration-150"
                style={{
                  background: "transparent",
                  border: `1px solid ${currentPage === totalPages ? "oklch(0.82 0.17 85 / 0.2)" : GOLD}`,
                  color:
                    currentPage === totalPages
                      ? "oklch(0.82 0.17 85 / 0.25)"
                      : GOLD,
                  cursor:
                    currentPage === totalPages ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (currentPage !== totalPages) {
                    const el = e.currentTarget;
                    el.style.background = GOLD;
                    el.style.color = "#000";
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentPage !== totalPages) {
                    const el = e.currentTarget;
                    el.style.background = "transparent";
                    el.style.color = GOLD;
                  }
                }}
                aria-label="Next page"
              >
                <ChevronRight size={16} strokeWidth={2} />
              </button>

              {/* Go to page input */}
              <div className="flex items-center gap-2 ml-2">
                <span
                  className="text-xs"
                  style={{ color: "oklch(0.50 0.08 85)" }}
                >
                  Go to:
                </span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  data-ocid="pagination.page_input"
                  onChange={(e) => setPageInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const parsed = Number.parseInt(pageInputValue, 10);
                      if (!Number.isNaN(parsed)) {
                        goToPage(parsed);
                      }
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number.parseInt(pageInputValue, 10);
                    if (!Number.isNaN(parsed)) {
                      goToPage(parsed);
                    } else {
                      setPageInputValue(String(currentPage));
                    }
                  }}
                  className="text-center text-sm"
                  style={{
                    width: 52,
                    background: "#000",
                    border: "1px solid oklch(0.82 0.17 85 / 0.4)",
                    color: GOLD,
                    borderRadius: "0.25rem",
                    padding: "3px 6px",
                    outline: "none",
                  }}
                  aria-label="Go to page number"
                />
              </div>
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

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingEntries={entries}
        onImportEntry={handleImportEntry}
      />
    </div>
  );
}
