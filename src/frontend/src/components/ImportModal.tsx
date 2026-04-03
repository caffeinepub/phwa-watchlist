import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, FileJson, FolderOpen, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import type { MangaEntry } from "../hooks/useMangaSync";
import { type MangaFormData, MangaStatus } from "../types/manga";
import { saveCoverByTitleIDB } from "../utils/coverDb";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";
const GOLD_FAINT = "oklch(0.82 0.17 85 / 0.15)";
const GOLD_BORDER = "oklch(0.82 0.17 85 / 0.5)";

// All known fields in a BackupEntry
const KNOWN_FIELDS = new Set([
  "id",
  "mainTitle",
  "altTitle1",
  "altTitle2",
  "synopsis",
  "genres",
  "rating",
  "cenLVL",
  "art",
  "chaptersOwned",
  "chaptersRead",
  "personalNotes",
  "bookmarked",
  "imageFilename",
]);

// Known fields that can be mapped to (excluding id which is internal)
const MAPPABLE_FIELDS = [
  "mainTitle",
  "altTitle1",
  "altTitle2",
  "synopsis",
  "genres",
  "rating",
  "cenLVL",
  "art",
  "chaptersOwned",
  "chaptersRead",
  "personalNotes",
  "bookmarked",
  "imageFilename",
];

interface BackupEntry {
  id: string;
  mainTitle: string;
  altTitle1?: string;
  altTitle2?: string;
  synopsis?: string;
  genres?: string[];
  rating?: string;
  cenLVL?: string;
  art?: string;
  chaptersOwned?: string;
  chaptersRead?: string;
  personalNotes?: string;
  bookmarked?: boolean;
  imageFilename?: string;
  [key: string]: unknown;
}

interface BackupFile {
  version: string;
  timestamp: string;
  chunkIndex: number;
  totalChunks: number;
  totalEntries: number;
  chunkEntries: number;
  entries: BackupEntry[];
}

export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  existingEntries: MangaEntry[];
  onImportEntry: (data: MangaFormData) => Promise<void>;
}

type ImportPhase =
  | "idle"
  | "unknown-fields"
  | "parsed"
  | "conflicts"
  | "importing"
  | "done"
  | "cancelled";

interface ParsedEntry {
  data: MangaFormData;
  originalTitle: string;
  isDuplicate: boolean;
}

interface ImportResult {
  added: number;
  overwritten: number;
  skipped: number;
  failed: number;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export function ImportModal({
  open,
  onClose,
  existingEntries,
  onImportEntry,
}: ImportModalProps) {
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [jsonFiles, setJsonFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [conflictDecisions, setConflictDecisions] = useState<
    Record<string, "skip" | "overwrite">
  >({});
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Unknown fields state
  const [unknownFields, setUnknownFields] = useState<string[]>([]);
  // Map: unknown field name → "ignore" | known field name
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>(
    {},
  );
  // Store raw entries before field mapping is applied
  const [rawEntries, setRawEntries] = useState<BackupEntry[]>([]);
  const [imageFileMap, setImageFileMap] = useState<Map<string, File>>(
    new Map(),
  );

  // Cancellation flag: set to true when user cancels during import loop
  const cancelledRef = useRef(false);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    cancelledRef.current = true; // stop any in-progress import loop
    setPhase("idle");
    setJsonFiles([]);
    setImageFiles([]);
    setParsedEntries([]);
    setDuplicateCount(0);
    setConflictDecisions({});
    setProgress(0);
    setImportResult(null);
    setParseError(null);
    setUnknownFields([]);
    setFieldMappings({});
    setRawEntries([]);
    setImageFileMap(new Map());
  }

  function handleClose() {
    resetState();
    onClose();
  }

  function handleJsonChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setJsonFiles(files);
    setPhase("idle");
    setParsedEntries([]);
    setParseError(null);
    setImportResult(null);
  }

  function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImageFiles(files);
  }

  async function handleParse() {
    if (jsonFiles.length === 0) return;
    setParseError(null);

    try {
      // Read all JSON files and collect entries
      const allEntries: BackupEntry[] = [];
      for (const file of jsonFiles) {
        const text = await readFileAsText(file);
        const parsed = JSON.parse(text) as BackupFile;
        if (!parsed.entries || !Array.isArray(parsed.entries)) {
          throw new Error(`File "${file.name}" has no valid "entries" array.`);
        }
        allEntries.push(...parsed.entries);
      }

      // Build a map of image files by filename for quick lookup
      const imgMap = new Map<string, File>();
      for (const f of imageFiles) {
        imgMap.set(f.name, f);
        // Also map by just the base filename (without directory path)
        const parts = f.name.split(/[/\\]/);
        const base = parts[parts.length - 1];
        if (base !== f.name) imgMap.set(base, f);
      }

      // Also map the webkitRelativePath name
      for (const f of imageFiles) {
        const rel = (f as File & { webkitRelativePath?: string })
          .webkitRelativePath;
        if (rel) {
          const parts = rel.split("/");
          const base = parts[parts.length - 1];
          if (!imgMap.has(base)) imgMap.set(base, f);
        }
      }

      // ── Scan for unknown fields ─────────────────────────────────────────────
      const foundUnknown = new Set<string>();
      for (const entry of allEntries) {
        for (const key of Object.keys(entry)) {
          if (!KNOWN_FIELDS.has(key)) {
            foundUnknown.add(key);
          }
        }
      }

      const unknownList = Array.from(foundUnknown).sort();

      // Store raw entries and image map for use after field mapping step
      setRawEntries(allEntries);
      setImageFileMap(imgMap);

      if (unknownList.length > 0) {
        // Initialize all unknown fields as "ignore"
        const defaultMappings: Record<string, string> = {};
        for (const f of unknownList) {
          defaultMappings[f] = "ignore";
        }
        setUnknownFields(unknownList);
        setFieldMappings(defaultMappings);
        setPhase("unknown-fields");
      } else {
        // No unknown fields — proceed directly to parse/conflicts
        await processEntries(allEntries, imgMap, {});
      }
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to parse JSON files.",
      );
    }
  }

  async function handleUnknownFieldsConfirm() {
    await processEntries(rawEntries, imageFileMap, fieldMappings);
  }

  async function processEntries(
    allEntries: BackupEntry[],
    imgMap: Map<string, File>,
    mappings: Record<string, string>,
  ) {
    try {
      // Apply field mappings: copy mapped unknown fields to known fields
      const mappedEntries = allEntries.map((entry) => {
        const result = { ...entry };
        for (const [unknownKey, targetField] of Object.entries(mappings)) {
          if (targetField !== "ignore" && unknownKey in entry) {
            // biome-ignore lint/suspicious/noExplicitAny: dynamic mapping
            (result as any)[targetField] = entry[unknownKey];
          }
          // Always delete the unknown field itself (it's not a known field)
          delete result[unknownKey];
        }
        return result;
      });

      // Build existing title set for duplicate detection
      const existingTitles = new Set(
        existingEntries.map((e) => e.title.toLowerCase().trim()),
      );

      let dupes = 0;
      const parsed: ParsedEntry[] = [];

      for (const entry of mappedEntries) {
        const titleLower = entry.mainTitle.toLowerCase().trim();
        const isDuplicate = existingTitles.has(titleLower);
        if (isDuplicate) dupes++;

        // Parse rating
        let rating: number | undefined;
        if (entry.rating && entry.rating !== "N/A") {
          const r = Number.parseFloat(entry.rating as string);
          if (!Number.isNaN(r)) rating = r;
        }

        // Parse cenLVL
        let cenLvl: number | undefined;
        if (entry.cenLVL !== undefined && entry.cenLVL !== "") {
          const c = Number.parseFloat(entry.cenLVL as string);
          if (!Number.isNaN(c)) cenLvl = c;
        }

        // Parse art
        let artRating: number | undefined;
        if (entry.art !== undefined && entry.art !== "") {
          const a = Number.parseFloat(entry.art as string);
          if (!Number.isNaN(a)) artRating = a;
        }

        // Parse chapters
        const totalChapters = entry.chaptersOwned
          ? Number.parseFloat(entry.chaptersOwned as string) || 0
          : 0;
        const currentChapter = entry.chaptersRead
          ? Number.parseFloat(entry.chaptersRead as string) || 0
          : 0;

        // Determine status from genres
        const rawGenres = entry.genres;
        const genres: string[] = Array.isArray(rawGenres)
          ? (rawGenres as string[])
          : typeof rawGenres === "string"
            ? (rawGenres as string)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
        const genresWithoutComplete = genres.filter((g) => g !== "Complete");
        // Read status from JSON field if present; fall back to genre-based inference for legacy backups
        const validStatuses = new Set(Object.values(MangaStatus));
        const rawStatus = entry.status as string | undefined;
        const status: MangaStatus =
          rawStatus && validStatuses.has(rawStatus as MangaStatus)
            ? (rawStatus as MangaStatus)
            : genres.includes("Complete")
              ? MangaStatus.Completed
              : MangaStatus.Incomplete;

        // Handle image
        let coverImageUrl: string | undefined;
        if (entry.imageFilename) {
          // Try exact filename, then just the base name
          const imgFile =
            imgMap.get(entry.imageFilename as string) ??
            imgMap.get(
              (entry.imageFilename as string).split(/[/\\]/).pop() ?? "",
            );
          if (imgFile) {
            try {
              coverImageUrl = await readFileAsBase64(imgFile);
              // Pre-save cover to IDB keyed by title immediately during parse.
              // This ensures covers survive the backend ID assignment race during
              // bulk import: fetchEntries will look up covers by title for any
              // entry whose addEntry hasn't completed yet.
              if (coverImageUrl) {
                await saveCoverByTitleIDB(entry.mainTitle, coverImageUrl);
              }
            } catch {
              // Image read failed, skip it
            }
          }
        }

        const data: MangaFormData = {
          title: entry.mainTitle,
          altTitle1: (entry.altTitle1 as string) ?? "",
          altTitle2: (entry.altTitle2 as string) ?? "",
          synopsis: (entry.synopsis as string) ?? "",
          genres: genresWithoutComplete,
          status,
          currentChapter,
          totalChapters: totalChapters > 0 ? totalChapters : undefined,
          rating,
          artRating,
          cenLvl,
          notes: (entry.personalNotes as string) ?? "",
          isFavourite: (entry.bookmarked as boolean) ?? false,
          coverImageUrl,
        };

        parsed.push({ data, originalTitle: entry.mainTitle, isDuplicate });
      }

      setParsedEntries(parsed);
      setDuplicateCount(dupes);

      if (dupes > 0) {
        // Build default conflict decisions (all skip)
        const decisions: Record<string, "skip" | "overwrite"> = {};
        for (const entry of parsed) {
          if (entry.isDuplicate) {
            decisions[entry.originalTitle] = "skip";
          }
        }
        setConflictDecisions(decisions);
        setPhase("conflicts");
      } else {
        setPhase("parsed");
      }
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : "Failed to parse JSON files.",
      );
    }
  }

  async function handleImport() {
    cancelledRef.current = false; // reset cancellation flag for this import run
    setPhase("importing");
    setProgress(0);

    // Non-duplicates always get imported; duplicates only if overwrite
    const toImport = parsedEntries.filter(
      (e) =>
        !e.isDuplicate || conflictDecisions[e.originalTitle] === "overwrite",
    );

    const skippedCount = Object.values(conflictDecisions).filter(
      (d) => d === "skip",
    ).length;

    let added = 0;
    let overwritten = 0;
    let failed = 0;

    for (let i = 0; i < toImport.length; i++) {
      // Check cancellation flag before each entry
      if (cancelledRef.current) break;

      const entry = toImport[i];
      try {
        await onImportEntry(entry.data);
        if (entry.isDuplicate) {
          overwritten++;
        } else {
          added++;
        }
      } catch {
        failed++;
      }
      setProgress(Math.round(((i + 1) / toImport.length) * 100));
      // Small yield to keep UI responsive
      await new Promise((r) => setTimeout(r, 0));
    }

    // Only update result if not cancelled
    if (!cancelledRef.current) {
      setImportResult({ added, overwritten, skipped: skippedCount, failed });
      setPhase("done");
    }
  }

  const btnBase: React.CSSProperties = {
    background: "transparent",
    border: `1.5px solid ${GOLD}`,
    color: GOLD,
    cursor: "pointer",
    borderRadius: "0.375rem",
    padding: "0.4rem 1rem",
    fontSize: "0.875rem",
    fontWeight: 600,
    transition: "background 0.15s, color 0.15s",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  };

  // Derived counts for parsed phase summary
  const newCount = parsedEntries.filter((e) => !e.isDuplicate).length;
  const overwriteCount = Object.values(conflictDecisions).filter(
    (d) => d === "overwrite",
  ).length;
  const skipCount = Object.values(conflictDecisions).filter(
    (d) => d === "skip",
  ).length;
  const totalToImport = newCount + overwriteCount;

  const duplicateEntries = parsedEntries.filter((e) => e.isDuplicate);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent
        style={{
          background: "#000",
          border: `1px solid ${GOLD_BORDER}`,
          color: GOLD,
          maxWidth: 520,
          width: "90vw",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: GOLD, fontSize: "1.1rem" }}>
            Import Watchlist
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* ── JSON File Input ── */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold" style={{ color: GOLD_DIM }}>
              Backup JSON file(s)
              <span
                className="ml-1 font-normal"
                style={{ color: "oklch(0.50 0.08 85)" }}
              >
                (select multiple for chunked backups)
              </span>
            </p>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json"
              multiple
              style={{ display: "none" }}
              onChange={handleJsonChange}
            />
            <button
              type="button"
              data-ocid="import.upload_button"
              onClick={() => jsonInputRef.current?.click()}
              style={{
                ...btnBase,
                border: `1.5px solid ${jsonFiles.length > 0 ? GOLD : GOLD_BORDER}`,
                color: jsonFiles.length > 0 ? GOLD : GOLD_DIM,
                justifyContent: "flex-start",
                padding: "0.5rem 0.75rem",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = GOLD_FAINT;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              <FileJson size={15} strokeWidth={1.5} />
              {jsonFiles.length > 0
                ? `${jsonFiles.length} file${jsonFiles.length > 1 ? "s" : ""} selected`
                : "Choose JSON file(s)…"}
            </button>
            {jsonFiles.length > 0 && (
              <div className="flex flex-col gap-0.5 pl-1">
                {jsonFiles.map((f) => (
                  <span
                    key={f.name}
                    className="text-xs"
                    style={{ color: "oklch(0.55 0.10 85)" }}
                  >
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Image Folder Input ── */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold" style={{ color: GOLD_DIM }}>
              Image folder
              <span
                className="ml-1 font-normal"
                style={{ color: "oklch(0.50 0.08 85)" }}
              >
                (optional — select the folder containing cover images)
              </span>
            </p>
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              multiple
              style={{ display: "none" }}
              onChange={handleFolderChange}
            />
            <button
              type="button"
              data-ocid="import.folder_upload_button"
              onClick={() => folderInputRef.current?.click()}
              style={{
                ...btnBase,
                border: `1.5px solid ${imageFiles.length > 0 ? GOLD : GOLD_BORDER}`,
                color: imageFiles.length > 0 ? GOLD : GOLD_DIM,
                justifyContent: "flex-start",
                padding: "0.5rem 0.75rem",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = GOLD_FAINT;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              <FolderOpen size={15} strokeWidth={1.5} />
              {imageFiles.length > 0
                ? `${imageFiles.length} image${imageFiles.length !== 1 ? "s" : ""} found`
                : "Choose image folder…"}
            </button>
          </div>

          {/* ── Parse Error ── */}
          {parseError && (
            <div
              className="flex items-start gap-2 rounded px-3 py-2 text-sm"
              style={{
                background: "oklch(0.5 0.15 20 / 0.12)",
                border: "1px solid oklch(0.6 0.15 20 / 0.5)",
                color: "oklch(0.75 0.15 20)",
              }}
            >
              <XCircle size={15} className="shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}

          {/* ── Unknown Fields Resolution ── */}
          {phase === "unknown-fields" && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: GOLD }}>
                  {unknownFields.length} unfamiliar field
                  {unknownFields.length !== 1 ? "s" : ""} found
                </p>
                <p className="text-xs mt-0.5" style={{ color: GOLD_DIM }}>
                  Choose to ignore each field or map it to a known field.
                </p>
              </div>

              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  border: `1px solid ${GOLD_BORDER}`,
                  borderRadius: "0.375rem",
                  background: "oklch(0.06 0 0)",
                }}
              >
                {unknownFields.map((field) => {
                  const mapping = fieldMappings[field] ?? "ignore";
                  return (
                    <div
                      key={field}
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{
                        borderBottom: `1px solid ${GOLD_FAINT}`,
                        gap: "0.75rem",
                      }}
                    >
                      {/* Unknown field name */}
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span
                          className="text-xs font-mono truncate"
                          style={{ color: GOLD }}
                          title={field}
                        >
                          {field}
                        </span>
                        <span
                          className="text-xs"
                          style={{ color: "oklch(0.45 0.08 85)" }}
                        >
                          unknown field
                        </span>
                      </div>

                      {/* Mapping selector */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs" style={{ color: GOLD_DIM }}>
                          →
                        </span>
                        <select
                          value={mapping}
                          onChange={(e) =>
                            setFieldMappings((prev) => ({
                              ...prev,
                              [field]: e.target.value,
                            }))
                          }
                          data-ocid="import.unknown_field.select"
                          style={{
                            background: "#0a0a0a",
                            border: `1px solid ${mapping === "ignore" ? GOLD_BORDER : GOLD}`,
                            color: mapping === "ignore" ? GOLD_DIM : GOLD,
                            borderRadius: "0.25rem",
                            padding: "0.2rem 0.4rem",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            outline: "none",
                            maxWidth: 140,
                          }}
                        >
                          <option value="ignore">Ignore</option>
                          <optgroup
                            label="Map to known field"
                            style={{ color: GOLD_DIM }}
                          >
                            {MAPPABLE_FIELDS.map((kf) => (
                              <option key={kf} value={kf}>
                                {kf}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary */}
              <p className="text-xs" style={{ color: GOLD_DIM }}>
                {
                  Object.values(fieldMappings).filter((v) => v !== "ignore")
                    .length
                }{" "}
                field
                {Object.values(fieldMappings).filter((v) => v !== "ignore")
                  .length !== 1
                  ? "s"
                  : ""}{" "}
                will be mapped ·{" "}
                {
                  Object.values(fieldMappings).filter((v) => v === "ignore")
                    .length
                }{" "}
                will be ignored
              </p>

              {/* Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  data-ocid="import.unknown_fields.back_button"
                  onClick={resetState}
                  style={{
                    ...btnBase,
                    border: `1.5px solid ${GOLD_BORDER}`,
                    color: GOLD_DIM,
                    padding: "0.35rem 0.9rem",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      GOLD_FAINT;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  data-ocid="import.unknown_fields.confirm_button"
                  onClick={handleUnknownFieldsConfirm}
                  style={{ ...btnBase, padding: "0.35rem 0.9rem" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = GOLD;
                    (e.currentTarget as HTMLElement).style.color = "#000";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color = GOLD;
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          {/* ── Conflict Resolution ── */}
          {phase === "conflicts" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: GOLD }}>
                  {duplicateCount} duplicate{duplicateCount !== 1 ? "s" : ""}{" "}
                  found — choose action for each:
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-ocid="import.conflicts.skip_all_button"
                    onClick={() => {
                      const all: Record<string, "skip" | "overwrite"> = {};
                      for (const e of duplicateEntries)
                        all[e.originalTitle] = "skip";
                      setConflictDecisions(all);
                    }}
                    style={{
                      background: "transparent",
                      border: `1px solid ${GOLD_BORDER}`,
                      color: GOLD_DIM,
                      cursor: "pointer",
                      borderRadius: "0.25rem",
                      padding: "0.2rem 0.6rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        GOLD_FAINT;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                    }}
                  >
                    Skip All
                  </button>
                  <button
                    type="button"
                    data-ocid="import.conflicts.overwrite_all_button"
                    onClick={() => {
                      const all: Record<string, "skip" | "overwrite"> = {};
                      for (const e of duplicateEntries)
                        all[e.originalTitle] = "overwrite";
                      setConflictDecisions(all);
                    }}
                    style={{
                      background: "transparent",
                      border: `1px solid ${GOLD_BORDER}`,
                      color: GOLD_DIM,
                      cursor: "pointer",
                      borderRadius: "0.25rem",
                      padding: "0.2rem 0.6rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        GOLD_FAINT;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "transparent";
                    }}
                  >
                    Overwrite All
                  </button>
                </div>
              </div>

              {/* Conflict list */}
              <div
                style={{
                  maxHeight: 280,
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  border: `1px solid ${GOLD_BORDER}`,
                  borderRadius: "0.375rem",
                  background: "oklch(0.06 0 0)",
                }}
              >
                {duplicateEntries.map((entry) => {
                  const decision =
                    conflictDecisions[entry.originalTitle] ?? "skip";
                  return (
                    <div
                      key={entry.originalTitle}
                      className="flex items-center justify-between px-3 py-2"
                      style={{
                        borderBottom: `1px solid ${GOLD_FAINT}`,
                        gap: "0.75rem",
                      }}
                    >
                      <span
                        className="text-xs truncate flex-1"
                        style={{ color: GOLD_DIM }}
                        title={entry.originalTitle}
                      >
                        {entry.originalTitle}
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          data-ocid="import.conflict.skip_button"
                          onClick={() =>
                            setConflictDecisions((prev) => ({
                              ...prev,
                              [entry.originalTitle]: "skip",
                            }))
                          }
                          style={{
                            background:
                              decision === "skip" ? GOLD : "transparent",
                            border: `1px solid ${decision === "skip" ? GOLD : GOLD_BORDER}`,
                            color: decision === "skip" ? "#000" : GOLD_DIM,
                            cursor: "pointer",
                            borderRadius: "0.25rem",
                            padding: "0.15rem 0.5rem",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            transition: "all 0.12s",
                          }}
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          data-ocid="import.conflict.overwrite_button"
                          onClick={() =>
                            setConflictDecisions((prev) => ({
                              ...prev,
                              [entry.originalTitle]: "overwrite",
                            }))
                          }
                          style={{
                            background:
                              decision === "overwrite" ? GOLD : "transparent",
                            border: `1px solid ${decision === "overwrite" ? GOLD : GOLD_BORDER}`,
                            color: decision === "overwrite" ? "#000" : GOLD_DIM,
                            cursor: "pointer",
                            borderRadius: "0.25rem",
                            padding: "0.15rem 0.5rem",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            transition: "all 0.12s",
                          }}
                        >
                          Overwrite
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary line */}
              <p className="text-xs" style={{ color: GOLD_DIM }}>
                <span style={{ color: GOLD }}>{newCount}</span> will be added
                {overwriteCount > 0 && (
                  <>
                    {" "}
                    · <span style={{ color: GOLD }}>{overwriteCount}</span> will
                    be overwritten
                  </>
                )}
                {skipCount > 0 && (
                  <>
                    {" "}
                    · <span style={{ color: GOLD_DIM }}>{skipCount}</span> will
                    be skipped
                  </>
                )}
              </p>

              {/* Conflict action buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  data-ocid="import.conflicts.back_button"
                  onClick={resetState}
                  style={{
                    ...btnBase,
                    border: `1.5px solid ${GOLD_BORDER}`,
                    color: GOLD_DIM,
                    padding: "0.35rem 0.9rem",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      GOLD_FAINT;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  data-ocid="import.conflicts.confirm_button"
                  onClick={() => setPhase("parsed")}
                  style={{ ...btnBase, padding: "0.35rem 0.9rem" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = GOLD;
                    (e.currentTarget as HTMLElement).style.color = "#000";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color = GOLD;
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          {/* ── Parse Preview ── */}
          {phase === "parsed" && (
            <div
              className="rounded px-3 py-3 flex flex-col gap-2"
              style={{
                background: GOLD_FAINT,
                border: `1px solid ${GOLD_BORDER}`,
              }}
            >
              <p className="text-sm font-semibold" style={{ color: GOLD }}>
                Ready to import
              </p>
              <p className="text-xs" style={{ color: GOLD_DIM }}>
                {duplicateCount > 0 ? (
                  <>
                    <span style={{ color: GOLD }}>{newCount}</span> new
                    {overwriteCount > 0 && (
                      <>
                        {" "}
                        + <span style={{ color: GOLD }}>{overwriteCount}</span>{" "}
                        to overwrite
                      </>
                    )}
                    {skipCount > 0 && (
                      <>
                        {" "}
                        · <span style={{ color: GOLD_DIM }}>{skipCount}</span>{" "}
                        skipped
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {parsedEntries.length} entr
                    {parsedEntries.length === 1 ? "y" : "ies"} to import
                  </>
                )}
              </p>
            </div>
          )}

          {/* ── Progress bar ── */}
          {phase === "importing" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: GOLD_DIM }}>
                Importing… {progress}%
              </p>
              <div
                style={{
                  height: 6,
                  background: "oklch(0.15 0 0)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progress}%`,
                    background: GOLD,
                    borderRadius: 3,
                    transition: "width 0.1s linear",
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Done result ── */}
          {phase === "done" && importResult && (
            <div
              className="flex items-start gap-2 rounded px-3 py-3 text-sm"
              style={{
                background: "oklch(0.5 0.12 140 / 0.1)",
                border: "1px solid oklch(0.6 0.12 140 / 0.5)",
                color: "oklch(0.75 0.12 140)",
              }}
            >
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">Import complete</span>
                <span className="text-xs" style={{ opacity: 0.9 }}>
                  {importResult.added} added
                  {importResult.overwritten > 0 &&
                    ` · ${importResult.overwritten} overwritten`}
                  {importResult.skipped > 0 &&
                    ` · ${importResult.skipped} skipped`}
                  {importResult.failed > 0 &&
                    ` · ${importResult.failed} failed`}
                </span>
              </div>
            </div>
          )}

          {/* ── Action buttons (idle + parsed + done) ── */}
          {phase !== "conflicts" && phase !== "unknown-fields" && (
            <div className="flex gap-3 justify-end mt-1">
              <Button
                type="button"
                data-ocid="import.close_button"
                onClick={handleClose}
                variant="ghost"
                className="text-sm"
                style={{ color: GOLD_DIM, borderColor: "transparent" }}
              >
                {phase === "done" ? "Close" : "Cancel"}
              </Button>

              {phase === "idle" && (
                <button
                  type="button"
                  data-ocid="import.submit_button"
                  disabled={jsonFiles.length === 0}
                  onClick={handleParse}
                  style={{
                    ...btnBase,
                    opacity: jsonFiles.length === 0 ? 0.4 : 1,
                    cursor: jsonFiles.length === 0 ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (jsonFiles.length > 0) {
                      (e.currentTarget as HTMLElement).style.background = GOLD;
                      (e.currentTarget as HTMLElement).style.color = "#000";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color = GOLD;
                  }}
                >
                  Parse Files
                </button>
              )}

              {phase === "parsed" && (
                <button
                  type="button"
                  data-ocid="import.submit_button"
                  disabled={totalToImport === 0}
                  onClick={handleImport}
                  style={{
                    ...btnBase,
                    opacity: totalToImport === 0 ? 0.4 : 1,
                    cursor: totalToImport === 0 ? "not-allowed" : "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (totalToImport > 0) {
                      (e.currentTarget as HTMLElement).style.background = GOLD;
                      (e.currentTarget as HTMLElement).style.color = "#000";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color = GOLD;
                  }}
                >
                  Start Import ({totalToImport})
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
