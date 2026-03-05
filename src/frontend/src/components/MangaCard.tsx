import { BookOpen, Edit2, Star, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type { MangaEntry } from "../hooks/useMangaSync";
import { type MangaStatus, STATUS_CLASS, STATUS_LABELS } from "../types/manga";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";
const GOLD_FAINT = "oklch(0.40 0.08 85)";

interface MangaCardProps {
  entry: MangaEntry;
  index: number;
  onEdit: (entry: MangaEntry) => void;
  onDelete: (entry: MangaEntry) => void;
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating / 2); // convert 1-10 to 1-5
  return (
    <div className="flex gap-0.5" aria-label={`Rating: ${rating}/10`}>
      {Array.from({ length: 5 }, (_, i) => i).map((i) => (
        <Star
          key={`star-${i}`}
          size={11}
          style={{
            color: i < filled ? GOLD : GOLD_FAINT,
            fill: i < filled ? GOLD : "transparent",
          }}
          strokeWidth={1.5}
        />
      ))}
      <span className="ml-1 text-xs" style={{ color: GOLD_DIM }}>
        {rating}/10
      </span>
    </div>
  );
}

function ChapterProgress({
  current,
  total,
}: {
  current: number;
  total?: number;
}) {
  const pct = total ? Math.min((current / total) * 100, 100) : null;
  return (
    <div className="space-y-1">
      <span className="text-xs" style={{ color: GOLD_DIM }}>
        Ch.{" "}
        <span className="font-semibold" style={{ color: GOLD }}>
          {current}
        </span>
        {total ? (
          <>
            {" "}
            / <span style={{ color: GOLD_DIM }}>{total}</span>
          </>
        ) : null}
      </span>
      {pct !== null && (
        <div
          className="h-0.5 rounded-full overflow-hidden"
          style={{ background: "oklch(0.82 0.17 85 / 0.15)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: GOLD,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Cover Preview Popup ───────────────────────────────────────────────────────

interface PopupPosition {
  top: number;
  left: number;
}

interface CoverPreviewPopupProps {
  entry: MangaEntry;
  anchorRect: DOMRect;
}

const POPUP_WIDTH = 350;
const POPUP_HEIGHT = 700;

function computePosition(anchorRect: DOMRect): PopupPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;

  // Prefer right of the card
  let left = anchorRect.right + margin;
  if (left + POPUP_WIDTH > vw - margin) {
    // Flip to left
    left = anchorRect.left - POPUP_WIDTH - margin;
  }
  if (left < margin) left = margin;

  // Align top with card top, clamped to viewport
  let top = anchorRect.top;
  if (top + POPUP_HEIGHT > vh - margin) {
    top = vh - POPUP_HEIGHT - margin;
  }
  if (top < margin) top = margin;

  return { top, left };
}

function CoverPreviewPopup({ entry, anchorRect }: CoverPreviewPopupProps) {
  const pos = computePosition(anchorRect);

  return ReactDOM.createPortal(
    <motion.div
      data-ocid="manga.cover_preview.popover"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        zIndex: 9999,
        background: "#000",
        border: "1.5px solid oklch(0.82 0.17 85)",
        borderRadius: "0.5rem",
        boxShadow:
          "0 0 32px oklch(0.82 0.17 85 / 0.25), 0 8px 40px rgba(0,0,0,0.8)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Upper half — cover image */}
      <div
        style={{
          height: POPUP_HEIGHT / 2,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          borderBottom: "1px solid oklch(0.82 0.17 85 / 0.25)",
          overflow: "hidden",
          padding: "8px",
        }}
      >
        {entry.coverImageUrl ? (
          <img
            src={entry.coverImageUrl}
            alt={`${entry.title} cover`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
            }}
            draggable={false}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              width: "100%",
              height: "100%",
            }}
          >
            <BookOpen
              size={48}
              style={{ color: "oklch(0.82 0.17 85 / 0.25)" }}
              strokeWidth={1}
            />
            <span
              style={{
                color: "oklch(0.82 0.17 85 / 0.35)",
                fontSize: "0.75rem",
                textAlign: "center",
                padding: "0 1rem",
              }}
            >
              No cover image
            </span>
          </div>
        )}
      </div>

      {/* Lower half — synopsis */}
      <div
        style={{
          height: POPUP_HEIGHT / 2,
          flexShrink: 0,
          padding: "16px",
          overflowY: "auto",
          scrollbarWidth: "none",
        }}
        // biome-ignore lint/a11y/useSemanticElements: custom scrollbar suppression via CSS class
        className="synopsis-scroll-area"
      >
        <p
          style={{
            color: GOLD_DIM,
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          Synopsis
        </p>
        {entry.synopsis ? (
          <p
            style={{
              color: "oklch(0.78 0.06 85)",
              fontSize: "0.8125rem",
              lineHeight: 1.65,
            }}
          >
            {entry.synopsis}
          </p>
        ) : (
          <p
            style={{
              color: "oklch(0.40 0.06 85)",
              fontSize: "0.8125rem",
              fontStyle: "italic",
            }}
          >
            No synopsis available.
          </p>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

// ── MangaCard ─────────────────────────────────────────────────────────────────

export function MangaCard({ entry, index, onEdit, onDelete }: MangaCardProps) {
  const statusClass = STATUS_CLASS[entry.status as unknown as MangaStatus];
  const displayIndex = index + 1;

  const [popupVisible, setPopupVisible] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPopup = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (coverRef.current) {
      setAnchorRect(coverRef.current.getBoundingClientRect());
      setPopupVisible(true);
    }
  }, []);

  const scheduleHide = useCallback(() => {
    leaveTimerRef.current = setTimeout(() => {
      setPopupVisible(false);
      setAnchorRect(null);
    }, 500);
  }, []);

  // Hide on click outside
  useEffect(() => {
    if (!popupVisible) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (coverRef.current && !coverRef.current.contains(e.target as Node)) {
        if (leaveTimerRef.current) {
          clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
        setPopupVisible(false);
        setAnchorRect(null);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [popupVisible]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, []);

  return (
    <motion.article
      data-ocid={`manga.item.${displayIndex}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
      className="relative group rounded-lg overflow-hidden flex flex-col"
      style={{
        background: "#000",
        border: "1px solid oklch(0.82 0.17 85 / 0.6)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = GOLD;
        el.style.boxShadow = "0 0 16px oklch(0.82 0.17 85 / 0.15)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "oklch(0.82 0.17 85 / 0.6)";
        el.style.boxShadow = "none";
      }}
    >
      {/* Cover image area */}
      <div
        ref={coverRef}
        className="relative w-full"
        style={{
          aspectRatio: "3/4",
          background: "#0a0a0a",
          overflow: "hidden",
          cursor: "pointer",
        }}
        onMouseEnter={showPopup}
        onMouseLeave={scheduleHide}
      >
        {entry.coverImageUrl ? (
          <img
            src={entry.coverImageUrl}
            alt={`${entry.title} cover`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Fallback to placeholder on error
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = "none";
              const parent = target.parentElement;
              if (parent) {
                const fallback = parent.querySelector(
                  ".cover-fallback",
                ) as HTMLElement;
                if (fallback) fallback.style.display = "flex";
              }
            }}
          />
        ) : null}
        {/* Fallback placeholder */}
        <div
          className="cover-fallback absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{
            display: entry.coverImageUrl ? "none" : "flex",
            background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
          }}
        >
          <BookOpen
            size={32}
            style={{ color: "oklch(0.82 0.17 85 / 0.3)" }}
            strokeWidth={1}
          />
          <span
            className="text-xs text-center px-3 line-clamp-2 font-medium"
            style={{ color: "oklch(0.82 0.17 85 / 0.4)" }}
          >
            {entry.title}
          </span>
        </div>

        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          <span
            className={`text-xs font-semibold px-1.5 py-0.5 rounded-sm ${statusClass}`}
            style={{
              background: "rgba(0,0,0,0.85)",
              border: "1px solid currentColor",
              backdropFilter: "blur(4px)",
            }}
          >
            {STATUS_LABELS[entry.status as unknown as MangaStatus]}
          </span>
        </div>

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            data-ocid={`manga.edit_button.${displayIndex}`}
            onClick={() => onEdit(entry)}
            className="w-7 h-7 rounded flex items-center justify-center transition-all duration-150"
            style={{
              background: "rgba(0,0,0,0.85)",
              border: `1px solid ${GOLD}`,
              color: GOLD,
            }}
            aria-label={`Edit ${entry.title}`}
            title="Edit"
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = GOLD;
              el.style.color = "#000";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(0,0,0,0.85)";
              el.style.color = GOLD;
            }}
          >
            <Edit2 size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            data-ocid={`manga.delete_button.${displayIndex}`}
            onClick={() => onDelete(entry)}
            className="w-7 h-7 rounded flex items-center justify-center transition-all duration-150"
            style={{
              background: "rgba(0,0,0,0.85)",
              border: "1px solid oklch(0.7 0.22 25)",
              color: "oklch(0.7 0.22 25)",
            }}
            aria-label={`Delete ${entry.title}`}
            title="Delete"
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = "oklch(0.7 0.22 25)";
              el.style.color = "#000";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = "rgba(0,0,0,0.85)";
              el.style.color = "oklch(0.7 0.22 25)";
            }}
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div
        className="flex flex-col gap-2 p-3 flex-1"
        style={{ minHeight: "7rem" }}
      >
        {/* Title — 4 lines */}
        <h3
          className="font-semibold text-sm leading-snug line-clamp-4"
          style={{ color: GOLD }}
          title={entry.title}
        >
          {entry.title}
        </h3>

        {/* Chapter progress */}
        <ChapterProgress
          current={Number(entry.currentChapter)}
          total={
            entry.totalChapters != null
              ? Number(entry.totalChapters)
              : undefined
          }
        />

        {/* Rating */}
        {entry.rating != null && <StarRating rating={Number(entry.rating)} />}

        {/* Genre tags */}
        {entry.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-1">
            {entry.genres.slice(0, 3).map((g) => (
              <span
                key={g}
                className="text-xs px-1.5 py-0.5 rounded-sm"
                style={{
                  border: "1px solid oklch(0.82 0.17 85 / 0.4)",
                  color: GOLD_DIM,
                }}
              >
                {g}
              </span>
            ))}
            {entry.genres.length > 3 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-sm"
                style={{ color: GOLD_FAINT }}
              >
                +{entry.genres.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cover Preview Popup via portal */}
      <AnimatePresence>
        {popupVisible && anchorRect && (
          <CoverPreviewPopup entry={entry} anchorRect={anchorRect} />
        )}
      </AnimatePresence>
    </motion.article>
  );
}
