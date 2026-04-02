import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { MangaEntry } from "../hooks/useMangaSync";
import type { MangaFormData } from "../types/manga";
import { MangaStatus, STATUS_LABELS } from "../types/manga";

interface MangaFormModalProps {
  open: boolean;
  entry?: MangaEntry | null;
  onClose: () => void;
  onSubmit: (data: MangaFormData) => Promise<void>;
  allGenres: string[];
}

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";

const inputStyle: React.CSSProperties = {
  background: "#000",
  border: `1px solid ${GOLD}`,
  color: GOLD,
  borderRadius: "0.375rem",
};

export function MangaFormModal({
  open,
  entry,
  onClose,
  onSubmit,
  allGenres,
}: MangaFormModalProps) {
  const isEdit = !!entry;

  const [title, setTitle] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [altTitle1, setAltTitle1] = useState("");
  const [altTitle2, setAltTitle2] = useState("");
  const [status, setStatus] = useState<MangaStatus>(MangaStatus.PlanToRead);
  const [currentChapter, setCurrentChapter] = useState("");
  const [totalChapters, setTotalChapters] = useState("");
  const [rating, setRating] = useState("");
  const [artRating, setArtRating] = useState("");
  const [cenLvl, setCenLvl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [genreInput, setGenreInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when entry changes or modal opens
  // biome-ignore lint/correctness/useExhaustiveDependencies: `open` is intentionally listed to reset on re-open
  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setSynopsis(entry.synopsis ?? "");
      setAltTitle1(entry.altTitle1 ?? "");
      setAltTitle2(entry.altTitle2 ?? "");
      setStatus(entry.status as unknown as MangaStatus);
      setCurrentChapter(Number(entry.currentChapter).toString());
      setTotalChapters(
        entry.totalChapters != null
          ? Number(entry.totalChapters).toString()
          : "",
      );
      setRating(entry.rating != null ? Number(entry.rating).toString() : "");
      setArtRating(entry.artRating != null ? String(entry.artRating) : "");
      setCenLvl(entry.cenLvl != null ? String(entry.cenLvl) : "");
      setCoverImageUrl(entry.coverImageUrl ?? "");
      setNotes(entry.notes);
      setGenres(entry.genres);
    } else {
      setTitle("");
      setSynopsis("");
      setAltTitle1("");
      setAltTitle2("");
      setStatus(MangaStatus.Incomplete);
      setCurrentChapter("0");
      setTotalChapters("");
      setRating("");
      setArtRating("");
      setCenLvl("");
      setCoverImageUrl("");
      setNotes("");
      setGenres([]);
    }
    setErrors({});
    setGenreInput("");
  }, [entry, open]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required";
    if (currentChapter && Number.isNaN(Number(currentChapter)))
      errs.currentChapter = "Must be a number";
    if (totalChapters && Number.isNaN(Number(totalChapters)))
      errs.totalChapters = "Must be a number";
    if (rating) {
      const r = Number(rating);
      if (Number.isNaN(r) || r < 1 || r > 10)
        errs.rating = "Rating must be 1–10";
    }
    if (artRating) {
      const r = Number(artRating);
      if (Number.isNaN(r) || r < 1 || r > 10)
        errs.artRating = "Art rating must be 1–10";
    }
    if (cenLvl !== "") {
      const r = Number(cenLvl);
      if (Number.isNaN(r) || r < 0 || r > 10)
        errs.cenLvl = "Cen LVL must be 0–10";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        synopsis: synopsis.trim(),
        altTitle1: altTitle1.trim(),
        altTitle2: altTitle2.trim(),
        status,
        currentChapter: Number(currentChapter) || 0,
        totalChapters: totalChapters ? Number(totalChapters) : undefined,
        rating: rating ? Number(rating) : undefined,
        artRating: artRating ? Number(artRating) : undefined,
        cenLvl: cenLvl !== "" ? Number(cenLvl) : undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
        notes: notes.trim(),
        genres,
      });
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenreKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = genreInput.trim();
      if (tag && !genres.includes(tag)) {
        setGenres((prev) => [...prev, tag]);
      }
      setGenreInput("");
    }
    if (e.key === "Backspace" && !genreInput && genres.length > 0) {
      setGenres((prev) => prev.slice(0, -1));
    }
  };

  const removeGenre = (g: string) => {
    setGenres((prev) => prev.filter((x) => x !== g));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_SIDE = 800;
        let { width, height } = img;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          if (width > height) {
            height = Math.round((height * MAX_SIDE) / width);
            width = MAX_SIDE;
          } else {
            width = Math.round((width * MAX_SIDE) / height);
            height = MAX_SIDE;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setCoverImageUrl(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setCoverImageUrl(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // Reset input so re-selecting same file still triggers onChange
    e.target.value = "";
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              aria-modal="true"
              aria-label={isEdit ? "Edit manga entry" : "Add manga entry"}
              className="relative w-full max-w-lg bg-black rounded-lg overflow-hidden"
              style={{
                border: `1.5px solid ${GOLD}`,
                boxShadow:
                  "0 0 40px oklch(0.82 0.17 85 / 0.2), 0 0 80px oklch(0.82 0.17 85 / 0.06)",
                maxHeight: "90dvh",
                overflowY: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4 sticky top-0 bg-black z-10"
                style={{ borderBottom: "1px solid oklch(0.82 0.17 85 / 0.3)" }}
              >
                <h2
                  className="text-lg font-semibold font-display tracking-wide"
                  style={{ color: GOLD }}
                >
                  {isEdit ? "Edit Entry" : "Add to Watchlist"}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded transition-colors"
                  style={{ color: GOLD_DIM }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = GOLD;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = GOLD_DIM;
                  }}
                  aria-label="Close"
                  data-ocid="manga.form.close_button"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Title <span style={{ color: "oklch(0.7 0.22 25)" }}>*</span>
                  </Label>
                  <Input
                    data-ocid="manga.form.title_input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Attack on Titan"
                    style={inputStyle}
                    autoFocus
                  />
                  {errors.title && (
                    <p
                      className="text-xs"
                      style={{ color: "oklch(0.7 0.22 25)" }}
                    >
                      {errors.title}
                    </p>
                  )}
                </div>

                {/* Alternate Titles */}
                <div className="space-y-2">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Alternate Titles{" "}
                    <span
                      style={{
                        color: "oklch(0.82 0.17 85 / 0.4)",
                        fontSize: "0.75rem",
                      }}
                    >
                      (optional)
                    </span>
                  </Label>
                  <Input
                    data-ocid="manga.form.alt_title1_input"
                    value={altTitle1}
                    onChange={(e) => setAltTitle1(e.target.value)}
                    placeholder="Alternate title 1"
                    style={inputStyle}
                  />
                  <Input
                    data-ocid="manga.form.alt_title2_input"
                    value={altTitle2}
                    onChange={(e) => setAltTitle2(e.target.value)}
                    placeholder="Alternate title 2"
                    style={inputStyle}
                  />
                </div>

                {/* Cover Image */}
                <div className="space-y-2">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Cover Image{" "}
                    <span
                      style={{
                        color: "oklch(0.82 0.17 85 / 0.4)",
                        fontSize: "0.75rem",
                      }}
                    >
                      (optional)
                    </span>
                  </Label>

                  <div className="flex items-center gap-3">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {/* Upload button */}
                    <button
                      type="button"
                      data-ocid="manga.form.cover_upload_button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all duration-150 shrink-0"
                      style={{
                        border: `1px solid ${GOLD}`,
                        color: GOLD,
                        background: "transparent",
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        el.style.background = "oklch(0.82 0.17 85 / 0.1)";
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget;
                        el.style.background = "transparent";
                      }}
                    >
                      <ImagePlus size={14} strokeWidth={1.5} />
                      Upload Cover
                    </button>

                    {/* Thumbnail preview */}
                    {coverImageUrl && (
                      <div className="relative shrink-0">
                        <img
                          src={coverImageUrl}
                          alt="Cover preview"
                          className="rounded object-cover"
                          style={{
                            height: "60px",
                            width: "45px",
                            border: `1px solid ${GOLD}`,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setCoverImageUrl("")}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{
                            background: "#000",
                            border: "1px solid oklch(0.7 0.22 25)",
                            color: "oklch(0.7 0.22 25)",
                          }}
                          aria-label="Remove cover image"
                        >
                          <X size={8} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* URL fallback */}
                  <Input
                    data-ocid="manga.form.cover_url_input"
                    value={
                      coverImageUrl.startsWith("data:") ? "" : coverImageUrl
                    }
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="Or enter cover URL (https://...)"
                    style={inputStyle}
                  />
                </div>

                {/* Synopsis */}
                <div className="space-y-1.5">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Synopsis{" "}
                    <span
                      style={{
                        color: "oklch(0.82 0.17 85 / 0.4)",
                        fontSize: "0.75rem",
                      }}
                    >
                      (optional)
                    </span>
                  </Label>
                  <Textarea
                    data-ocid="manga.form.synopsis_textarea"
                    value={synopsis}
                    onChange={(e) => setSynopsis(e.target.value)}
                    placeholder="Brief plot summary…"
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Status
                  </Label>
                  <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as MangaStatus)}
                  >
                    <SelectTrigger
                      data-ocid="manga.form.status_select"
                      className="w-full"
                      style={{ ...inputStyle, height: "2.5rem" }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      style={{
                        background: "#000",
                        border: `1px solid ${GOLD}`,
                        color: GOLD,
                      }}
                    >
                      {Object.values(MangaStatus).map((s) => (
                        <SelectItem key={s} value={s} style={{ color: GOLD }}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Chapter + Total */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                      Current Chapter
                    </Label>
                    <Input
                      data-ocid="manga.form.chapter_input"
                      type="number"
                      min={0}
                      step={0.1}
                      value={currentChapter}
                      onChange={(e) => setCurrentChapter(e.target.value)}
                      placeholder="0"
                      style={inputStyle}
                    />
                    {errors.currentChapter && (
                      <p
                        className="text-xs"
                        style={{ color: "oklch(0.7 0.22 25)" }}
                      >
                        {errors.currentChapter}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                      Total Chapters
                    </Label>
                    <Input
                      data-ocid="manga.form.total_chapters_input"
                      type="number"
                      min={0}
                      step={0.1}
                      value={totalChapters}
                      onChange={(e) => setTotalChapters(e.target.value)}
                      placeholder="? (optional)"
                      style={inputStyle}
                    />
                    {errors.totalChapters && (
                      <p
                        className="text-xs"
                        style={{ color: "oklch(0.7 0.22 25)" }}
                      >
                        {errors.totalChapters}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rating */}
                <div className="space-y-1.5">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Rating (1–10, optional)
                  </Label>
                  <Input
                    data-ocid="manga.form.rating_input"
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    placeholder="e.g. 9.5"
                    style={inputStyle}
                  />
                  {errors.rating && (
                    <p
                      className="text-xs"
                      style={{ color: "oklch(0.7 0.22 25)" }}
                    >
                      {errors.rating}
                    </p>
                  )}
                </div>

                {/* Art Rating + Cen LVL */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                      Art Rating (1–10, optional)
                    </Label>
                    <Input
                      data-ocid="manga.form.art_rating_input"
                      type="number"
                      min={1}
                      max={10}
                      step={0.1}
                      value={artRating}
                      onChange={(e) => setArtRating(e.target.value)}
                      placeholder="e.g. 7.5"
                      style={inputStyle}
                    />
                    {errors.artRating && (
                      <p
                        className="text-xs"
                        style={{ color: "oklch(0.7 0.22 25)" }}
                      >
                        {errors.artRating}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                      Cen LVL (0–10, optional)
                    </Label>
                    <Input
                      data-ocid="manga.form.cen_lvl_input"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={cenLvl}
                      onChange={(e) => setCenLvl(e.target.value)}
                      placeholder="e.g. 3.0"
                      style={inputStyle}
                    />
                    {errors.cenLvl && (
                      <p
                        className="text-xs"
                        style={{ color: "oklch(0.7 0.22 25)" }}
                      >
                        {errors.cenLvl}
                      </p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Notes
                  </Label>
                  <Textarea
                    data-ocid="manga.form.notes_textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Your thoughts…"
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                {/* Genres */}
                <div className="space-y-1.5">
                  <Label style={{ color: GOLD_DIM, fontSize: "0.8125rem" }}>
                    Genres (press Enter to add)
                  </Label>

                  {/* Suggested genres chips */}
                  {allGenres.filter((g) => !genres.includes(g)).length > 0 && (
                    <div className="space-y-1">
                      <p
                        style={{
                          color: "oklch(0.82 0.17 85 / 0.45)",
                          fontSize: "0.7rem",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Existing genres — click to add
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allGenres
                          .filter((g) => !genres.includes(g))
                          .map((g) => (
                            <button
                              key={g}
                              type="button"
                              data-ocid={`manga.form.genre_suggestion.${g.toLowerCase().replace(/\s+/g, "_")}`}
                              onClick={() => setGenres((prev) => [...prev, g])}
                              className="text-xs px-2 py-0.5 rounded transition-all duration-150"
                              style={{
                                border: "1px solid oklch(0.82 0.17 85 / 0.35)",
                                color: "oklch(0.62 0.12 85)",
                                background: "transparent",
                                cursor: "pointer",
                              }}
                              onMouseEnter={(e) => {
                                const el = e.currentTarget;
                                el.style.borderColor = GOLD;
                                el.style.color = GOLD;
                                el.style.background =
                                  "oklch(0.82 0.17 85 / 0.08)";
                              }}
                              onMouseLeave={(e) => {
                                const el = e.currentTarget;
                                el.style.borderColor =
                                  "oklch(0.82 0.17 85 / 0.35)";
                                el.style.color = "oklch(0.62 0.12 85)";
                                el.style.background = "transparent";
                              }}
                            >
                              + {g}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div
                    className="flex flex-wrap gap-1.5 p-2 rounded-md min-h-[2.5rem]"
                    style={{ border: `1px solid ${GOLD}`, background: "#000" }}
                  >
                    {genres.map((g) => (
                      <span
                        key={g}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          border: `1px solid ${GOLD}`,
                          color: GOLD,
                          background: "oklch(0.82 0.17 85 / 0.08)",
                        }}
                      >
                        {g}
                        <button
                          type="button"
                          onClick={() => removeGenre(g)}
                          className="ml-0.5 hover:opacity-70"
                          aria-label={`Remove ${g}`}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <input
                      value={genreInput}
                      onChange={(e) => setGenreInput(e.target.value)}
                      onKeyDown={handleGenreKeyDown}
                      placeholder={
                        genres.length === 0 ? "Action, Fantasy…" : ""
                      }
                      className="flex-1 min-w-24 bg-transparent outline-none text-sm"
                      style={{ color: GOLD }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div
                  className="flex justify-end gap-3 pt-2"
                  style={{ borderTop: "1px solid oklch(0.82 0.17 85 / 0.2)" }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    data-ocid="manga.form.cancel_button"
                    className="transition-colors"
                    style={{
                      color: GOLD_DIM,
                      border: "1px solid oklch(0.82 0.17 85 / 0.3)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = GOLD;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = GOLD_DIM;
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    data-ocid="manga.form.submit_button"
                    disabled={isSubmitting}
                    className="font-semibold transition-all duration-200"
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
                    {isSubmitting
                      ? "Saving…"
                      : isEdit
                        ? "Save Changes"
                        : "Add to Watchlist"}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
