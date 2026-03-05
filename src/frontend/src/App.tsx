import { Toaster } from "@/components/ui/sonner";
import { BookOpen, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useMangaSync } from "./hooks/useMangaSync";

import { DeleteConfirmDialog } from "./components/DeleteConfirmDialog";
import { Header } from "./components/Header";
import { LoginPage } from "./components/LoginPage";
import { MangaCard } from "./components/MangaCard";
import { MangaFormModal } from "./components/MangaFormModal";
import { PasswordGate } from "./components/PasswordGate";
import { StatsBar } from "./components/StatsBar";
import { Toolbar } from "./components/Toolbar";

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

  // ── Password gate ───────────────────────────────────────────────────────────
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);

  useEffect(() => {
    if (!actor || !identity || isActorFetching) return;
    void (async () => {
      try {
        const trusted = await (
          actor as unknown as { checkTrusted: (p: unknown) => Promise<boolean> }
        ).checkTrusted(identity.getPrincipal());
        if (trusted) setIsPasswordVerified(true);
      } catch {
        // If the call fails, leave isPasswordVerified as false — gate will show
      }
    })();
  }, [actor, identity, isActorFetching]);

  const {
    entries,
    isLoading,
    isSyncing,
    fetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    pendingCount,
  } = useMangaSync();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MangaStatus | "all">("all");
  const [genreFilter, setGenreFilter] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updated-desc");

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
  }, [entries, search, statusFilter, genreFilter, sortOption]);

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
            data,
          );
          toast.success("Entry updated");
        } else {
          await addEntry(
            actor as unknown as Parameters<typeof addEntry>[0],
            data,
          );
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
    setIsPasswordVerified(false);
    toast("Signed out");
  }, [clear]);

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

  // ── Password gate ───────────────────────────────────────────────────────────
  if (isAuthenticated && !isPasswordVerified) {
    return (
      <PasswordGate
        actor={actor as unknown}
        onSuccess={() => setIsPasswordVerified(true)}
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
        />

        {/* List */}
        <section className="px-4 md:px-6" aria-label="Manga list">
          {/* Loading skeleton */}
          {isLoading && entries.length === 0 && (
            <div
              data-ocid="manga.list"
              className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              {Array.from({ length: 8 }, (_, i) => `skeleton-${i}`).map(
                (key) => (
                  <div
                    key={key}
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid oklch(0.82 0.17 85 / 0.2)" }}
                  >
                    <div
                      className="w-full"
                      style={{
                        aspectRatio: "3/4",
                        background:
                          "linear-gradient(90deg, oklch(0.05 0 0) 25%, oklch(0.08 0 0) 50%, oklch(0.05 0 0) 75%)",
                        backgroundSize: "200% 100%",
                        animation: "shimmer 1.5s linear infinite",
                      }}
                    />
                    <div className="p-3 space-y-2">
                      <div
                        className="h-3 rounded"
                        style={{ background: "oklch(0.1 0 0)", width: "80%" }}
                      />
                      <div
                        className="h-2 rounded"
                        style={{ background: "oklch(0.08 0 0)", width: "50%" }}
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
                  {search || statusFilter !== "all" || genreFilter
                    ? "No results found"
                    : "Your watchlist is empty"}
                </p>
                <p className="text-sm" style={{ color: "oklch(0.40 0.08 85)" }}>
                  {search || statusFilter !== "all" || genreFilter
                    ? "Try adjusting your filters"
                    : "Add your first manga to get started"}
                </p>
              </div>
              {!search && statusFilter === "all" && !genreFilter && (
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

          {/* Grid */}
          {filteredEntries.length > 0 && (
            <div
              data-ocid="manga.list"
              className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            >
              <AnimatePresence mode="popLayout">
                {filteredEntries.map((entry, index) => (
                  <MangaCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
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
