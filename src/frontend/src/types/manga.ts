// Use the backend's MangaEntry to avoid structural incompatibility
export type { MangaEntry } from "../backend.d";

// Re-declare MangaStatus as a const enum compatible with backend values
export enum MangaStatus {
  OnHold = "OnHold",
  PlanToRead = "PlanToRead",
  Reading = "Reading",
  Dropped = "Dropped",
  Completed = "Completed",
  Incomplete = "Incomplete",
}

export interface MangaFormData {
  title: string;
  synopsis: string;
  altTitle1: string;
  altTitle2: string;
  status: MangaStatus;
  currentChapter: number;
  totalChapters?: number;
  rating?: number;
  artRating?: number;
  cenLvl?: number;
  coverImageUrl?: string;
  notes: string;
  genres: string[];
  isFavourite?: boolean;
}

export type SyncOperation =
  | { type: "add"; payload: MangaFormData; tempId: string; timestamp: number }
  | {
      type: "update";
      payload: MangaFormData & { id: string };
      timestamp: number;
    }
  | { type: "delete"; payload: { id: string }; timestamp: number }
  | { type: "toggleFavourite"; payload: { id: string }; timestamp: number }
  | {
      type: "updateStatus";
      payload: { id: string; status: string };
      timestamp: number;
    }
  | {
      type: "updateChapters";
      payload: { id: string; currentChapter: number; totalChapters?: number };
      timestamp: number;
    }
  | {
      type: "updateRating";
      payload: { id: string; rating?: number };
      timestamp: number;
    }
  | {
      type: "updateArtRating";
      payload: { id: string; artRating?: number };
      timestamp: number;
    }
  | {
      type: "updateCenLvl";
      payload: { id: string; cenLvl?: number };
      timestamp: number;
    };

export type SortOption =
  | "title-asc"
  | "title-desc"
  | "rating-desc"
  | "rating-asc"
  | "chapter-progress"
  | "updated-desc";

export const STATUS_LABELS: Record<MangaStatus, string> = {
  [MangaStatus.Reading]: "Reading",
  [MangaStatus.Completed]: "Completed",
  [MangaStatus.OnHold]: "On Hold",
  [MangaStatus.Dropped]: "Dropped",
  [MangaStatus.PlanToRead]: "Plan to Read",
  [MangaStatus.Incomplete]: "Incomplete",
};

export const STATUS_CLASS: Record<MangaStatus, string> = {
  [MangaStatus.Reading]: "status-reading",
  [MangaStatus.Completed]: "status-completed",
  [MangaStatus.OnHold]: "status-onhold",
  [MangaStatus.Dropped]: "status-dropped",
  [MangaStatus.PlanToRead]: "status-plantoread",
  [MangaStatus.Incomplete]: "status-incomplete",
};
