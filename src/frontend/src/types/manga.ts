// Use the backend's MangaEntry to avoid structural incompatibility
export type { MangaEntry } from "../backend.d";

// Re-declare MangaStatus as a const enum compatible with backend values
export enum MangaStatus {
  OnHold = "OnHold",
  PlanToRead = "PlanToRead",
  Reading = "Reading",
  Dropped = "Dropped",
  Completed = "Completed",
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
  coverImageUrl?: string;
  notes: string;
  genres: string[];
}

export type SyncOperation =
  | { type: "add"; payload: MangaFormData; tempId: string; timestamp: number }
  | {
      type: "update";
      payload: MangaFormData & { id: string };
      timestamp: number;
    }
  | { type: "delete"; payload: { id: string }; timestamp: number };

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
};

export const STATUS_CLASS: Record<MangaStatus, string> = {
  [MangaStatus.Reading]: "status-reading",
  [MangaStatus.Completed]: "status-completed",
  [MangaStatus.OnHold]: "status-onhold",
  [MangaStatus.Dropped]: "status-dropped",
  [MangaStatus.PlanToRead]: "status-plantoread",
};
