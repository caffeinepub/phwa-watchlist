import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface MangaEntry {
    id: string;
    status: MangaStatus;
    coverImageUrl?: string;
    title: string;
    altTitle1: string;
    altTitle2: string;
    createdAt: bigint;
    updatedAt: bigint;
    synopsis: string;
    genres: Array<string>;
    notes: string;
    rating?: bigint;
    totalChapters?: bigint;
    currentChapter: bigint;
}
export interface UserProfile {
    name: string;
}
export enum MangaStatus {
    OnHold = "OnHold",
    PlanToRead = "PlanToRead",
    Reading = "Reading",
    Dropped = "Dropped",
    Completed = "Completed"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addEntry(title: string, synopsis: string, altTitle1: string, altTitle2: string, status: MangaStatus, currentChapter: bigint, totalChapters: bigint | null, rating: bigint | null, coverImageUrl: string | null, notes: string, genres: Array<string>): Promise<MangaEntry>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    checkTrusted(user: Principal): Promise<boolean>;
    deleteEntry(id: string): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getEntries(): Promise<Array<MangaEntry>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    markTrusted(): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateEntry(id: string, title: string, synopsis: string, altTitle1: string, altTitle2: string, status: MangaStatus, currentChapter: bigint, totalChapters: bigint | null, rating: bigint | null, coverImageUrl: string | null, notes: string, genres: Array<string>): Promise<MangaEntry>;
}
