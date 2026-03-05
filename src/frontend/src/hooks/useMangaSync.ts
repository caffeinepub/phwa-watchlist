import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MangaEntry } from "../backend.d";
import { MangaStatus as BackendMangaStatus } from "../backend.d";
import type { MangaFormData, SyncOperation } from "../types/manga";
import { useOnlineStatus } from "./useOnlineStatus";

export type { MangaEntry };

const CACHE_KEY = "manga_cache";
const QUEUE_KEY = "manga_sync_queue";

// ── Serialization helpers for bigint ──────────────────────────────────────────

interface SerializedEntry {
  id: string;
  title: string;
  synopsis: string;
  altTitle1: string;
  altTitle2: string;
  status: string;
  currentChapter: string;
  totalChapters?: string;
  rating?: string;
  coverImageUrl?: string;
  notes: string;
  genres: string[];
  createdAt: string;
  updatedAt: string;
}

function serializeEntry(entry: MangaEntry): SerializedEntry {
  return {
    id: entry.id,
    title: entry.title,
    synopsis: entry.synopsis,
    altTitle1: entry.altTitle1,
    altTitle2: entry.altTitle2,
    status: entry.status as string,
    notes: entry.notes,
    genres: entry.genres,
    coverImageUrl: entry.coverImageUrl,
    currentChapter: entry.currentChapter.toString(),
    totalChapters: entry.totalChapters?.toString(),
    rating: entry.rating?.toString(),
    createdAt: entry.createdAt.toString(),
    updatedAt: entry.updatedAt.toString(),
  };
}

function deserializeEntry(s: SerializedEntry): MangaEntry {
  return {
    id: s.id,
    title: s.title,
    synopsis: s.synopsis ?? "",
    altTitle1: s.altTitle1 ?? "",
    altTitle2: s.altTitle2 ?? "",
    status: s.status as BackendMangaStatus,
    notes: s.notes,
    genres: s.genres,
    coverImageUrl: s.coverImageUrl,
    currentChapter: BigInt(s.currentChapter),
    totalChapters:
      s.totalChapters != null ? BigInt(s.totalChapters) : undefined,
    rating: s.rating != null ? BigInt(s.rating) : undefined,
    createdAt: BigInt(s.createdAt),
    updatedAt: BigInt(s.updatedAt),
  };
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function loadCache(): MangaEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed: SerializedEntry[] = JSON.parse(raw);
    return parsed.map(deserializeEntry);
  } catch {
    return [];
  }
}

function saveCache(entries: MangaEntry[]): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(entries.map(serializeEntry)),
    );
  } catch {
    // storage full — silently ignore
  }
}

function loadQueue(): SyncOperation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SyncOperation[];
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncOperation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // silently ignore
  }
}

// ── Sample seed data (shown when offline / before first sync) ─────────────────

const NOW = BigInt(Date.now()) * BigInt(1_000_000);

export const SEED_ENTRIES: MangaEntry[] = [
  {
    id: "seed-1",
    title: "Berserk",
    synopsis:
      "Guts, a former mercenary known as the 'Black Swordsman', wanders a dark medieval world seeking revenge against the God Hand, a group of demonical entities who led his former band of mercenaries to their doom. His journey leads him into a desperate struggle for survival in a world filled with demons and corrupt humans.",
    altTitle1: "Berserk: The Black Swordsman",
    altTitle2: "",
    status: BackendMangaStatus.Reading,
    currentChapter: BigInt(374),
    totalChapters: undefined,
    rating: BigInt(10),
    coverImageUrl: undefined,
    notes: "A dark fantasy masterpiece. The art is unparalleled.",
    genres: ["Dark Fantasy", "Action", "Horror"],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "seed-2",
    title: "Vinland Saga",
    synopsis:
      "Young Thorfinn grows up listening to the tales of old sailors who had been to a legendary land called Vinland. It's said to be a warm and fertile land where there are no wars and no slaves. However, his reality is far different — his father is killed by a mercenary named Askeladd, and Thorfinn vows to have his revenge in a duel.",
    altTitle1: "Vinurando Saga",
    altTitle2: "",
    status: BackendMangaStatus.Reading,
    currentChapter: BigInt(194),
    totalChapters: undefined,
    rating: BigInt(9),
    coverImageUrl: undefined,
    notes: "Themes of war, redemption and what it means to be a warrior.",
    genres: ["Historical", "Action", "Drama"],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "seed-3",
    title: "Fullmetal Alchemist",
    synopsis:
      "Two brothers, Edward and Alphonse Elric, attempt to resurrect their deceased mother through alchemy, defying its taboo. The attempt fails catastrophically, and Edward loses two limbs while Alphonse loses his entire body, his soul bound to a suit of armor. In their quest for the Philosopher's Stone to restore their bodies, they uncover a far-reaching conspiracy.",
    altTitle1: "Hagane no Renkinjutsushi",
    altTitle2: "FMA",
    status: BackendMangaStatus.Completed,
    currentChapter: BigInt(108),
    totalChapters: BigInt(108),
    rating: BigInt(10),
    coverImageUrl: undefined,
    notes: "Perfect ending. Ed and Al's journey is unforgettable.",
    genres: ["Fantasy", "Adventure", "Action"],
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "seed-4",
    title: "Chainsaw Man",
    synopsis:
      "Denji is a young man who works as a devil hunter to pay off his deceased father's debt to the yakuza. When he's killed by yakuza working with a devil, his pet devil Pochita merges with his dead body, resurrecting him as Chainsaw Man — a human with the ability to sprout chainsaws from his body.",
    altTitle1: "Chensoumanku",
    altTitle2: "",
    status: BackendMangaStatus.PlanToRead,
    currentChapter: BigInt(0),
    totalChapters: undefined,
    rating: undefined,
    coverImageUrl: undefined,
    notes: "Everyone says it's wild. Need to start soon.",
    genres: ["Action", "Horror", "Supernatural"],
    createdAt: NOW,
    updatedAt: NOW,
  },
];

// ── Actor interface ───────────────────────────────────────────────────────────

interface ActorLike {
  getEntries(): Promise<MangaEntry[]>;
  addEntry(
    title: string,
    synopsis: string,
    altTitle1: string,
    altTitle2: string,
    status: BackendMangaStatus,
    currentChapter: bigint,
    totalChapters: bigint | null,
    rating: bigint | null,
    coverImageUrl: string | null,
    notes: string,
    genres: string[],
  ): Promise<MangaEntry>;
  updateEntry(
    id: string,
    title: string,
    synopsis: string,
    altTitle1: string,
    altTitle2: string,
    status: BackendMangaStatus,
    currentChapter: bigint,
    totalChapters: bigint | null,
    rating: bigint | null,
    coverImageUrl: string | null,
    notes: string,
    genres: string[],
  ): Promise<MangaEntry>;
  deleteEntry(id: string): Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

interface UseMangaSyncReturn {
  entries: MangaEntry[];
  isLoading: boolean;
  isSyncing: boolean;
  fetchEntries: (actor: ActorLike) => Promise<void>;
  addEntry: (actor: ActorLike | null, data: MangaFormData) => Promise<void>;
  updateEntry: (
    actor: ActorLike | null,
    id: string,
    data: MangaFormData,
  ) => Promise<void>;
  deleteEntry: (actor: ActorLike | null, id: string) => Promise<void>;
  pendingCount: number;
}

export function useMangaSync(): UseMangaSyncReturn {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<MangaEntry[]>(() => {
    const cached = loadCache();
    return cached.length > 0 ? cached : SEED_ENTRIES;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => loadQueue().length);
  const actorRef = useRef<ActorLike | null>(null);

  // Flush queue when coming back online
  useEffect(() => {
    if (!isOnline) return;
    const queue = loadQueue();
    if (queue.length === 0 || !actorRef.current) return;

    const actor = actorRef.current;
    setIsSyncing(true);

    void (async () => {
      const remaining: SyncOperation[] = [];
      for (const op of queue) {
        try {
          if (op.type === "add") {
            const d = op.payload;
            await actor.addEntry(
              d.title,
              d.synopsis,
              d.altTitle1,
              d.altTitle2,
              d.status as BackendMangaStatus,
              BigInt(d.currentChapter),
              d.totalChapters != null ? BigInt(d.totalChapters) : null,
              d.rating != null ? BigInt(d.rating) : null,
              d.coverImageUrl ?? null,
              d.notes,
              d.genres,
            );
          } else if (op.type === "update") {
            const d = op.payload;
            await actor.updateEntry(
              d.id,
              d.title,
              d.synopsis,
              d.altTitle1,
              d.altTitle2,
              d.status as BackendMangaStatus,
              BigInt(d.currentChapter),
              d.totalChapters != null ? BigInt(d.totalChapters) : null,
              d.rating != null ? BigInt(d.rating) : null,
              d.coverImageUrl ?? null,
              d.notes,
              d.genres,
            );
          } else if (op.type === "delete") {
            await actor.deleteEntry(op.payload.id);
          }
        } catch {
          remaining.push(op);
        }
      }

      saveQueue(remaining);
      setPendingCount(remaining.length);

      // Refresh from backend
      try {
        const fresh = await actor.getEntries();
        setEntries(fresh);
        saveCache(fresh);
      } catch {
        // ignore
      }
      setIsSyncing(false);
      queryClient.invalidateQueries({ queryKey: ["manga"] });
    })();
  }, [isOnline, queryClient]);

  const fetchEntries = useCallback(async (actor: ActorLike) => {
    actorRef.current = actor;
    setIsLoading(true);
    try {
      const fresh = await actor.getEntries();
      const result = fresh.length > 0 ? fresh : SEED_ENTRIES;
      setEntries(result);
      if (fresh.length > 0) saveCache(fresh);
    } catch {
      // keep whatever is in state (cache or seed)
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addEntry = useCallback(
    async (actor: ActorLike | null, data: MangaFormData) => {
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const now = BigInt(Date.now()) * BigInt(1_000_000);
      const optimistic: MangaEntry = {
        id: tempId,
        title: data.title,
        synopsis: data.synopsis,
        altTitle1: data.altTitle1,
        altTitle2: data.altTitle2,
        status: data.status as BackendMangaStatus,
        currentChapter: BigInt(data.currentChapter),
        totalChapters:
          data.totalChapters != null ? BigInt(data.totalChapters) : undefined,
        rating: data.rating != null ? BigInt(data.rating) : undefined,
        coverImageUrl: data.coverImageUrl,
        notes: data.notes,
        genres: data.genres,
        createdAt: now,
        updatedAt: now,
      };

      setEntries((prev) => {
        const next = [optimistic, ...prev];
        saveCache(next);
        return next;
      });

      if (!isOnline || !actor) {
        const queue = loadQueue();
        queue.push({
          type: "add",
          payload: data,
          tempId,
          timestamp: Date.now(),
        });
        saveQueue(queue);
        setPendingCount(queue.length);
        return;
      }

      try {
        const created = await actor.addEntry(
          data.title,
          data.synopsis,
          data.altTitle1,
          data.altTitle2,
          data.status as BackendMangaStatus,
          BigInt(data.currentChapter),
          data.totalChapters != null ? BigInt(data.totalChapters) : null,
          data.rating != null ? BigInt(data.rating) : null,
          data.coverImageUrl ?? null,
          data.notes,
          data.genres,
        );
        setEntries((prev) => {
          const next = prev.map((e) => (e.id === tempId ? created : e));
          saveCache(next);
          return next;
        });
      } catch {
        setEntries((prev) => {
          const next = prev.filter((e) => e.id !== tempId);
          saveCache(next);
          return next;
        });
        throw new Error("Failed to add entry");
      }
    },
    [isOnline],
  );

  const updateEntry = useCallback(
    async (actor: ActorLike | null, id: string, data: MangaFormData) => {
      const now = BigInt(Date.now()) * BigInt(1_000_000);
      let previous: MangaEntry | undefined;

      setEntries((prev) => {
        previous = prev.find((e) => e.id === id);
        const next = prev.map((e) =>
          e.id === id
            ? {
                ...e,
                title: data.title,
                synopsis: data.synopsis,
                altTitle1: data.altTitle1,
                altTitle2: data.altTitle2,
                status: data.status as BackendMangaStatus,
                currentChapter: BigInt(data.currentChapter),
                totalChapters:
                  data.totalChapters != null
                    ? BigInt(data.totalChapters)
                    : undefined,
                rating: data.rating != null ? BigInt(data.rating) : undefined,
                coverImageUrl: data.coverImageUrl,
                notes: data.notes,
                genres: data.genres,
                updatedAt: now,
              }
            : e,
        );
        saveCache(next);
        return next;
      });

      if (!isOnline || !actor) {
        const queue = loadQueue();
        queue.push({
          type: "update",
          payload: { ...data, id },
          timestamp: Date.now(),
        });
        saveQueue(queue);
        setPendingCount(queue.length);
        return;
      }

      try {
        const updated = await actor.updateEntry(
          id,
          data.title,
          data.synopsis,
          data.altTitle1,
          data.altTitle2,
          data.status as BackendMangaStatus,
          BigInt(data.currentChapter),
          data.totalChapters != null ? BigInt(data.totalChapters) : null,
          data.rating != null ? BigInt(data.rating) : null,
          data.coverImageUrl ?? null,
          data.notes,
          data.genres,
        );
        setEntries((prev) => {
          const next = prev.map((e) => (e.id === id ? updated : e));
          saveCache(next);
          return next;
        });
      } catch {
        if (previous) {
          const prev_entry = previous;
          setEntries((prev) => {
            const next = prev.map((e) => (e.id === id ? prev_entry : e));
            saveCache(next);
            return next;
          });
        }
        throw new Error("Failed to update entry");
      }
    },
    [isOnline],
  );

  const deleteEntry = useCallback(
    async (actor: ActorLike | null, id: string) => {
      let removed: MangaEntry | undefined;

      setEntries((prev) => {
        removed = prev.find((e) => e.id === id);
        const next = prev.filter((e) => e.id !== id);
        saveCache(next);
        return next;
      });

      if (!isOnline || !actor) {
        const queue = loadQueue();
        queue.push({ type: "delete", payload: { id }, timestamp: Date.now() });
        saveQueue(queue);
        setPendingCount(queue.length);
        return;
      }

      try {
        await actor.deleteEntry(id);
      } catch {
        if (removed) {
          const removedEntry = removed;
          setEntries((prev) => {
            const next = [...prev, removedEntry];
            saveCache(next);
            return next;
          });
        }
        throw new Error("Failed to delete entry");
      }
    },
    [isOnline],
  );

  return {
    entries,
    isLoading,
    isSyncing,
    fetchEntries,
    addEntry,
    updateEntry,
    deleteEntry,
    pendingCount,
  };
}
