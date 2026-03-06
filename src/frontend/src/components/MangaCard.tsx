import {
  BookOpen,
  ChevronRight,
  Edit2,
  Heart,
  NotebookPen,
  Star,
  Trash2,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import type { MangaEntry } from "../hooks/useMangaSync";
import { MangaStatus, STATUS_CLASS, STATUS_LABELS } from "../types/manga";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";
const GOLD_FAINT = "oklch(0.40 0.08 85)";
const PINK = "oklch(0.75 0.22 0)";

const CARD_HEIGHT = 119;
const COVER_WIDTH_MAX = 145; // max cover width (auto based on aspect ratio, capped)
const TITLE_WIDTH = 240;
const SCROLL_SPEED = 30; // px/second
const SCROLL_GAP = 24; // gap between two text copies

const NOTES_RED = "oklch(0.7 0.22 25)";

const RAINBOW_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0099ff, #aa00ff, #ff0000)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  animation: "rainbow-shift 3s linear infinite",
  fontSize: "0.75rem",
};

interface MangaCardProps {
  entry: MangaEntry;
  index: number;
  onEdit: (entry: MangaEntry) => void;
  onDelete: (entry: MangaEntry) => void;
  onToggleFavourite: (entry: MangaEntry) => void;
  onQuickStatusChange: (entry: MangaEntry, status: MangaStatus) => void;
  onQuickChapterChange: (
    entry: MangaEntry,
    current: number,
    total: number | undefined,
  ) => void;
  onQuickRatingChange: (entry: MangaEntry, rating: number | undefined) => void;
  onQuickArtRatingChange: (
    entry: MangaEntry,
    artRating: number | undefined,
  ) => void;
  onQuickCenLvlChange: (entry: MangaEntry, cenLvl: number | undefined) => void;
  onQuickNotesChange: (entry: MangaEntry, notes: string) => void;
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating / 2);
  const hasHalf = rating % 2 >= 1;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div
      className="flex gap-0.5 items-center"
      aria-label={`Rating: ${rating}/10`}
    >
      {Array.from({ length: fullStars }, (_, i) => i).map((i) => (
        <Star
          // biome-ignore lint/suspicious/noArrayIndexKey: static display array, never reorders
          key={`full-${i}`}
          size={11}
          style={{ color: GOLD, fill: GOLD, flexShrink: 0 }}
          strokeWidth={1.5}
        />
      ))}
      {hasHalf && (
        <div
          style={{ position: "relative", width: 11, height: 11, flexShrink: 0 }}
        >
          {/* Empty star background */}
          <Star
            size={11}
            style={{
              color: GOLD_FAINT,
              fill: "transparent",
              position: "absolute",
              top: 0,
              left: 0,
            }}
            strokeWidth={1.5}
          />
          {/* Half-filled overlay: clip left half */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "50%",
              overflow: "hidden",
            }}
          >
            <Star
              size={11}
              style={{ color: GOLD, fill: GOLD }}
              strokeWidth={1.5}
            />
          </div>
        </div>
      )}
      {Array.from({ length: emptyStars }, (_, i) => i).map((i) => (
        <Star
          // biome-ignore lint/suspicious/noArrayIndexKey: static display array, never reorders
          key={`empty-${i}`}
          size={11}
          style={{ color: GOLD_FAINT, fill: "transparent", flexShrink: 0 }}
          strokeWidth={1.5}
        />
      ))}
      <span
        className="ml-1 text-xs"
        style={
          rating >= 8
            ? {
                background:
                  "linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0099ff, #aa00ff, #ff0000)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "rainbow-shift 3s linear infinite",
              }
            : { color: GOLD_DIM }
        }
      >
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
          style={{ background: "oklch(0.82 0.17 85 / 0.15)", width: "100%" }}
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
  popupRef: RefObject<HTMLDivElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const POPUP_WIDTH = 350;
const POPUP_HEIGHT = 700;

function computePosition(anchorRect: DOMRect): PopupPosition {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 8;

  // Position popup 100px to the right of the title display area
  // Title area starts at anchorRect.right; title width = TITLE_WIDTH (240px); offset = 100px
  let left = anchorRect.right + TITLE_WIDTH + 100;
  if (left + POPUP_WIDTH > vw - margin) {
    // Flip to left of the cover if it doesn't fit
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

function CoverPreviewPopup({
  entry,
  anchorRect,
  popupRef,
  onMouseEnter,
  onMouseLeave,
}: CoverPreviewPopupProps) {
  const pos = computePosition(anchorRect);

  return ReactDOM.createPortal(
    <motion.div
      ref={popupRef}
      data-ocid="manga.cover_preview.popover"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
        pointerEvents: "auto",
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

// ── Scrolling Title ───────────────────────────────────────────────────────────

function ScrollingTitle({ title }: { title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const lastTimestampRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const textHeightRef = useRef(0);
  const [isScrolling, setIsScrolling] = useState(false);

  // Measure after mount / title changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: title prop change triggers re-measure
  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    // Reset
    offsetRef.current = 0;
    lastTimestampRef.current = null;

    const textH = textEl.scrollHeight;
    textHeightRef.current = textH;

    if (textH > CARD_HEIGHT) {
      setIsScrolling(true);
    } else {
      setIsScrolling(false);
    }
  }, [title]);

  // Start/stop RAF loop when isScrolling changes
  useEffect(() => {
    if (!isScrolling) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    const loop = (timestamp: number) => {
      if (!pausedRef.current) {
        if (lastTimestampRef.current === null) {
          lastTimestampRef.current = timestamp;
        }
        const delta = (timestamp - lastTimestampRef.current) / 1000;
        lastTimestampRef.current = timestamp;

        const totalCycle = textHeightRef.current + SCROLL_GAP;
        offsetRef.current -= SCROLL_SPEED * delta;

        // Seamless reset: when first copy has scrolled fully out of top,
        // snap back so second copy (entering from bottom) becomes first
        if (offsetRef.current <= -totalCycle) {
          offsetRef.current += totalCycle;
        }
      } else {
        // While paused, just keep the last timestamp null so we don't jump on resume
        lastTimestampRef.current = null;
      }

      // Apply transforms directly to DOM to avoid re-renders
      const container = containerRef.current;
      if (container) {
        const copies =
          container.querySelectorAll<HTMLDivElement>("[data-scroll-copy]");
        const textH = textHeightRef.current;
        const totalCycle = textH + SCROLL_GAP;
        copies[0]?.style.setProperty(
          "transform",
          `translateY(${offsetRef.current}px)`,
        );
        copies[1]?.style.setProperty(
          "transform",
          `translateY(${offsetRef.current + totalCycle}px)`,
        );
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isScrolling]);

  const handleMouseEnter = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    pausedRef.current = false;
  }, []);

  if (!isScrolling) {
    // Static: single copy, no animation
    return (
      <div
        ref={containerRef}
        style={{
          width: TITLE_WIDTH,
          height: CARD_HEIGHT,
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-start",
          paddingTop: "12px",
          paddingBottom: "12px",
          paddingLeft: "10px",
          paddingRight: "10px",
          boxSizing: "border-box",
        }}
      >
        <div
          ref={textRef}
          style={{
            color: GOLD,
            fontSize: "0.875rem",
            fontWeight: 600,
            lineHeight: 1.45,
            wordBreak: "break-word",
          }}
        >
          {title}
        </div>
      </div>
    );
  }

  // Scrolling: two copies
  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: TITLE_WIDTH,
        height: CARD_HEIGHT,
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        cursor: "default",
      }}
    >
      {/* Measure ref — hidden, determines text height */}
      <div
        ref={textRef}
        data-scroll-copy="0"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          color: GOLD,
          fontSize: "0.875rem",
          fontWeight: 600,
          lineHeight: 1.45,
          wordBreak: "break-word",
          padding: "12px 10px",
          boxSizing: "border-box",
          willChange: "transform",
        }}
      >
        {title}
      </div>
      {/* Second copy */}
      <div
        data-scroll-copy="1"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          color: GOLD,
          fontSize: "0.875rem",
          fontWeight: 600,
          lineHeight: 1.45,
          wordBreak: "break-word",
          padding: "12px 10px",
          boxSizing: "border-box",
          willChange: "transform",
          // Initial position: stacked below first copy by textHeight + gap
          // Will be set dynamically by RAF but we need a CSS initial
          transform: `translateY(${CARD_HEIGHT + SCROLL_GAP}px)`,
        }}
      >
        {title}
      </div>
    </div>
  );
}

// ── Inline Popup (Chapter / Rating edit) ──────────────────────────────────────

interface InlinePopupProps {
  anchorRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}

function InlinePopup({ anchorRect, onClose, children }: InlinePopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!popupRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Compute position
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popupWidth = 200;
  const popupHeight = 120;
  const margin = 8;

  let left = anchorRect.left;
  if (left + popupWidth > vw - margin) {
    left = vw - popupWidth - margin;
  }
  if (left < margin) left = margin;

  let top = anchorRect.bottom + 4;
  if (top + popupHeight > vh - margin) {
    top = anchorRect.top - popupHeight - 4;
  }
  if (top < margin) top = margin;

  return ReactDOM.createPortal(
    <motion.div
      ref={popupRef}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      style={{
        position: "fixed",
        top,
        left,
        width: popupWidth,
        zIndex: 10000,
        background: "#000",
        border: `1px solid ${GOLD}`,
        borderRadius: "0.375rem",
        padding: "10px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
      }}
    >
      {children}
    </motion.div>,
    document.body,
  );
}

// ── Status Dropdown ───────────────────────────────────────────────────────────

interface StatusDropdownProps {
  anchorRect: DOMRect;
  currentStatus: MangaStatus;
  onSelect: (status: MangaStatus) => void;
  onClose: () => void;
}

function StatusDropdown({
  anchorRect,
  currentStatus,
  onSelect,
  onClose,
}: StatusDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popupWidth = 160;
  const popupHeight = Object.values(STATUS_LABELS).length * 34 + 8;
  const margin = 8;

  let left = anchorRect.left;
  if (left + popupWidth > vw - margin) left = vw - popupWidth - margin;
  if (left < margin) left = margin;

  let top = anchorRect.bottom + 4;
  if (top + popupHeight > vh - margin) top = anchorRect.top - popupHeight - 4;
  if (top < margin) top = margin;

  return ReactDOM.createPortal(
    <motion.div
      ref={dropdownRef}
      data-ocid="manga.status.dropdown_menu"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      style={{
        position: "fixed",
        top,
        left,
        width: popupWidth,
        zIndex: 10000,
        background: "#000",
        border: `1px solid ${GOLD}`,
        borderRadius: "0.375rem",
        padding: "4px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.8)",
      }}
    >
      {(Object.entries(STATUS_LABELS) as [MangaStatus, string][]).map(
        ([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => {
              onSelect(val);
              onClose();
            }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "6px 10px",
              fontSize: "0.75rem",
              fontWeight: val === currentStatus ? 700 : 400,
              color: val === currentStatus ? GOLD : GOLD_DIM,
              background:
                val === currentStatus
                  ? "oklch(0.82 0.17 85 / 0.08)"
                  : "transparent",
              border: "none",
              borderRadius: "0.25rem",
              cursor: "pointer",
              transition: "background 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "oklch(0.82 0.17 85 / 0.12)";
              (e.currentTarget as HTMLElement).style.color = GOLD;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                val === currentStatus
                  ? "oklch(0.82 0.17 85 / 0.08)"
                  : "transparent";
              (e.currentTarget as HTMLElement).style.color =
                val === currentStatus ? GOLD : GOLD_DIM;
            }}
          >
            {label}
          </button>
        ),
      )}
    </motion.div>,
    document.body,
  );
}

// ── Notes Hover Preview ───────────────────────────────────────────────────────

interface NotesPreviewPopupProps {
  notes: string;
}

function NotesPreviewPopup({ notes }: NotesPreviewPopupProps) {
  return ReactDOM.createPortal(
    <motion.div
      data-ocid="manga.notes_preview.popover"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        maxHeight: 300,
        zIndex: 10001,
        background: "#000",
        border: `1.5px solid ${GOLD}`,
        borderRadius: "0.5rem",
        boxShadow:
          "0 0 32px oklch(0.82 0.17 85 / 0.2), 0 8px 40px rgba(0,0,0,0.9)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px 8px",
          borderBottom: "1px solid oklch(0.82 0.17 85 / 0.2)",
          flexShrink: 0,
        }}
      >
        <p
          style={{
            color: GOLD_DIM,
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Notes
        </p>
      </div>
      {/* Notes content — scrollable, invisible scrollbar */}
      <div
        style={{
          padding: "12px 14px",
          overflowY: "auto",
          scrollbarWidth: "none",
          flex: 1,
        }}
      >
        {notes ? (
          <p
            style={{
              color: "oklch(0.78 0.06 85)",
              fontSize: "0.8125rem",
              lineHeight: 1.65,
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {notes}
          </p>
        ) : (
          <p
            style={{
              color: "oklch(0.40 0.06 85)",
              fontSize: "0.8125rem",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            No notes yet.
          </p>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

// ── Notes Edit Popup ─────────────────────────────────────────────────────────

interface NotesEditPopupProps {
  entry: MangaEntry;
  onSave: (notes: string) => void;
  onClose: () => void;
}

function NotesEditPopup({ entry, onSave, onClose }: NotesEditPopupProps) {
  const [notesValue, setNotesValue] = useState(entry.notes ?? "");
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (!popupRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return ReactDOM.createPortal(
    <motion.div
      ref={popupRef}
      data-ocid="manga.notes_edit.dialog"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        zIndex: 10002,
        background: "#000",
        border: `1.5px solid ${GOLD}`,
        borderRadius: "0.5rem",
        boxShadow:
          "0 0 32px oklch(0.82 0.17 85 / 0.2), 0 8px 40px rgba(0,0,0,0.9)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid oklch(0.82 0.17 85 / 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            color: GOLD,
            fontSize: "0.8rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            margin: 0,
          }}
        >
          Edit Notes
        </p>
        <button
          type="button"
          onClick={onClose}
          data-ocid="manga.notes_edit.close_button"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: GOLD_FAINT,
            padding: "2px",
            fontSize: "1rem",
            lineHeight: 1,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = GOLD;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = GOLD_FAINT;
          }}
          aria-label="Close notes editor"
        >
          ✕
        </button>
      </div>

      {/* Textarea */}
      <div style={{ padding: "12px 14px" }}>
        <textarea
          data-ocid="manga.notes_edit.textarea"
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          placeholder="Add your notes here..."
          rows={6}
          style={{
            width: "100%",
            background: "#0a0a0a",
            border: "1px solid oklch(0.82 0.17 85 / 0.35)",
            color: "oklch(0.85 0.06 85)",
            borderRadius: "0.375rem",
            padding: "10px 12px",
            fontSize: "0.8125rem",
            lineHeight: 1.65,
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
            transition: "border-color 0.15s",
            scrollbarWidth: "none",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = GOLD_DIM;
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "oklch(0.82 0.17 85 / 0.35)";
          }}
          // biome-ignore lint/a11y/noAutofocus: auto-focus is intentional for this edit popup
          autoFocus
        />
      </div>

      {/* Action buttons */}
      <div
        style={{
          padding: "0 14px 14px",
          display: "flex",
          gap: "8px",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          data-ocid="manga.notes_edit.cancel_button"
          style={{
            background: "transparent",
            border: "1px solid oklch(0.82 0.17 85 / 0.35)",
            color: GOLD_DIM,
            borderRadius: "0.375rem",
            padding: "6px 16px",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = GOLD_DIM;
            el.style.color = GOLD;
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.borderColor = "oklch(0.82 0.17 85 / 0.35)";
            el.style.color = GOLD_DIM;
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onSave(notesValue);
            onClose();
          }}
          data-ocid="manga.notes_edit.save_button"
          style={{
            background: "transparent",
            border: `1px solid ${GOLD}`,
            color: GOLD,
            borderRadius: "0.375rem",
            padding: "6px 16px",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
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
          Save
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}

// ── MangaCard ─────────────────────────────────────────────────────────────────

export function MangaCard({
  entry,
  index,
  onEdit,
  onDelete,
  onToggleFavourite,
  onQuickStatusChange,
  onQuickChapterChange,
  onQuickRatingChange,
  onQuickArtRatingChange,
  onQuickCenLvlChange,
  onQuickNotesChange,
}: MangaCardProps) {
  const statusClass = STATUS_CLASS[entry.status as unknown as MangaStatus];
  const displayIndex = index + 1;

  // Alternate title cycling
  const [displayTitleIndex, setDisplayTitleIndex] = useState(0);
  const altTitles = [entry.altTitle1, entry.altTitle2].filter(Boolean);
  const titleOptions = [entry.title, ...altTitles];
  const displayTitle = titleOptions[displayTitleIndex % titleOptions.length];

  // Cover popup
  const [popupVisible, setPopupVisible] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Status dropdown
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [statusAnchorRect, setStatusAnchorRect] = useState<DOMRect | null>(
    null,
  );
  const statusBadgeRef = useRef<HTMLButtonElement>(null);

  // Chapter edit popup
  const [chapterPopupOpen, setChapterPopupOpen] = useState(false);
  const [chapterAnchorRect, setChapterAnchorRect] = useState<DOMRect | null>(
    null,
  );
  const [chapterCurrentInput, setChapterCurrentInput] = useState("");
  const [chapterTotalInput, setChapterTotalInput] = useState("");
  const chapterTriggerRef = useRef<HTMLButtonElement>(null);

  // Rating edit popup
  const [ratingPopupOpen, setRatingPopupOpen] = useState(false);
  const [ratingAnchorRect, setRatingAnchorRect] = useState<DOMRect | null>(
    null,
  );
  const [ratingInput, setRatingInput] = useState("");
  const ratingTriggerRef = useRef<HTMLButtonElement>(null);

  // Art Rating edit popup
  const [artRatingPopupOpen, setArtRatingPopupOpen] = useState(false);
  const [artRatingAnchorRect, setArtRatingAnchorRect] =
    useState<DOMRect | null>(null);
  const [artRatingInput, setArtRatingInput] = useState("");
  const artRatingTriggerRef = useRef<HTMLButtonElement>(null);

  // Cen LVL edit popup
  const [cenLvlPopupOpen, setCenLvlPopupOpen] = useState(false);
  const [cenLvlAnchorRect, setCenLvlAnchorRect] = useState<DOMRect | null>(
    null,
  );
  const [cenLvlInput, setCenLvlInput] = useState("");
  const cenLvlTriggerRef = useRef<HTMLButtonElement>(null);

  // Lazy-load cover image via IntersectionObserver
  const [coverVisible, setCoverVisible] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // If no cover image, no need to observe
    if (!entry.coverImageUrl) {
      setCoverVisible(false);
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const obs of entries) {
          if (obs.isIntersecting) {
            setCoverVisible(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [entry.coverImageUrl]);

  // Notes state
  const [notesHoverVisible, setNotesHoverVisible] = useState(false);
  const [notesEditOpen, setNotesEditOpen] = useState(false);
  const notesHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNotes = !!entry.notes?.trim();

  const handleNotesMouseEnter = useCallback(() => {
    if (notesHoverTimerRef.current) {
      clearTimeout(notesHoverTimerRef.current);
      notesHoverTimerRef.current = null;
    }
    setNotesHoverVisible(true);
  }, []);

  const handleNotesMouseLeave = useCallback(() => {
    notesHoverTimerRef.current = setTimeout(() => {
      setNotesHoverVisible(false);
    }, 200);
  }, []);

  const handleNotesClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesHoverVisible(false);
    setNotesEditOpen(true);
  }, []);

  // Cleanup notes timer on unmount
  useEffect(() => {
    return () => {
      if (notesHoverTimerRef.current) clearTimeout(notesHoverTimerRef.current);
    };
  }, []);

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

  // Hide cover popup on click outside
  useEffect(() => {
    if (!popupVisible) return;

    const handleMouseDown = (e: MouseEvent) => {
      const insideCover = coverRef.current?.contains(e.target as Node) ?? false;
      const insidePopup = popupRef.current?.contains(e.target as Node) ?? false;
      if (!insideCover && !insidePopup) {
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

  const handleStatusBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = statusBadgeRef.current?.getBoundingClientRect();
    if (rect) {
      setStatusAnchorRect(rect);
      setStatusDropdownOpen((prev) => !prev);
    }
  }, []);

  const handleChapterClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = chapterTriggerRef.current?.getBoundingClientRect();
      if (rect) {
        setChapterAnchorRect(rect);
        setChapterCurrentInput(Number(entry.currentChapter).toString());
        setChapterTotalInput(
          entry.totalChapters != null
            ? Number(entry.totalChapters).toString()
            : "",
        );
        setChapterPopupOpen(true);
      }
    },
    [entry.currentChapter, entry.totalChapters],
  );

  const handleRatingClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = ratingTriggerRef.current?.getBoundingClientRect();
      if (rect) {
        setRatingAnchorRect(rect);
        setRatingInput(
          entry.rating != null ? Number(entry.rating).toString() : "",
        );
        setRatingPopupOpen(true);
      }
    },
    [entry.rating],
  );

  const handleArtRatingClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = artRatingTriggerRef.current?.getBoundingClientRect();
      if (rect) {
        setArtRatingAnchorRect(rect);
        setArtRatingInput(
          entry.artRating != null ? String(entry.artRating) : "",
        );
        setArtRatingPopupOpen(true);
      }
    },
    [entry.artRating],
  );

  const handleCenLvlClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = cenLvlTriggerRef.current?.getBoundingClientRect();
      if (rect) {
        setCenLvlAnchorRect(rect);
        setCenLvlInput(entry.cenLvl != null ? String(entry.cenLvl) : "");
        setCenLvlPopupOpen(true);
      }
    },
    [entry.cenLvl],
  );

  const handleChapterSave = useCallback(() => {
    const current = Number(chapterCurrentInput) || 0;
    const total = chapterTotalInput ? Number(chapterTotalInput) : undefined;
    onQuickChapterChange(entry, current, total);
    setChapterPopupOpen(false);
  }, [chapterCurrentInput, chapterTotalInput, entry, onQuickChapterChange]);

  const handleRatingSave = useCallback(() => {
    const raw = ratingInput ? Number(ratingInput) : undefined;
    if (raw !== undefined) {
      if (raw < 1 || raw > 10) return;
      const snapped = Math.round(raw * 2) / 2;
      onQuickRatingChange(entry, snapped);
    } else {
      onQuickRatingChange(entry, undefined);
    }
    setRatingPopupOpen(false);
  }, [ratingInput, entry, onQuickRatingChange]);

  const handleArtRatingSave = useCallback(() => {
    const r = artRatingInput ? Number(artRatingInput) : undefined;
    if (r !== undefined && (r < 1 || r > 10)) return;
    onQuickArtRatingChange(entry, r);
    setArtRatingPopupOpen(false);
  }, [artRatingInput, entry, onQuickArtRatingChange]);

  const handleCenLvlSave = useCallback(() => {
    const r = cenLvlInput ? Number(cenLvlInput) : undefined;
    if (r !== undefined && (r < 1 || r > 10)) return;
    onQuickCenLvlChange(entry, r);
    setCenLvlPopupOpen(false);
  }, [cenLvlInput, entry, onQuickCenLvlChange]);

  return (
    <motion.article
      ref={cardRef}
      data-ocid={`manga.item.${displayIndex}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
      className="relative group flex flex-row overflow-hidden"
      style={{
        width: 1100,
        height: CARD_HEIGHT,
        background: "#000",
        border: "1px solid oklch(0.82 0.17 85 / 0.6)",
        borderRadius: "0.5rem",
        transition: "border-color 0.2s, box-shadow 0.2s",
        flexShrink: 0,
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
      {/* ── Cover image area ─────────────────────────────────────────────── */}
      <div
        ref={coverRef}
        style={{
          height: CARD_HEIGHT,
          width: "auto",
          maxWidth: COVER_WIDTH_MAX,
          minWidth: 60,
          flexShrink: 0,
          background: "#0a0a0a",
          overflow: "hidden",
          cursor: "pointer",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRight: "1px solid transparent",
        }}
        onMouseEnter={showPopup}
        onMouseLeave={scheduleHide}
      >
        {entry.coverImageUrl && coverVisible ? (
          <img
            src={entry.coverImageUrl}
            alt={`${entry.title} cover`}
            style={{
              height: "100%",
              width: "auto",
              maxWidth: COVER_WIDTH_MAX,
              objectFit: "cover",
              display: "block",
            }}
            loading="lazy"
            onError={(e) => {
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
        {/* Gold-tinted placeholder while cover is not yet visible */}
        {entry.coverImageUrl && !coverVisible ? (
          <div
            style={{
              height: "100%",
              width: 90,
              background:
                "linear-gradient(135deg, oklch(0.08 0.03 85) 0%, oklch(0.12 0.05 85) 50%, oklch(0.08 0.03 85) 100%)",
              flexShrink: 0,
            }}
          />
        ) : null}
        {/* Fallback */}
        <div
          className="cover-fallback"
          style={{
            display: entry.coverImageUrl ? "none" : "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            width: 80,
            height: "100%",
            background: "linear-gradient(135deg, #0a0a0a 0%, #111 100%)",
          }}
        >
          <BookOpen
            size={24}
            style={{ color: "oklch(0.82 0.17 85 / 0.3)" }}
            strokeWidth={1}
          />
        </div>
      </div>

      {/* ── Scrolling title area ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          flexShrink: 0,
        }}
      >
        <ScrollingTitle title={displayTitle} />
        {altTitles.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setDisplayTitleIndex((i) => (i + 1) % titleOptions.length)
            }
            data-ocid={`manga.alt_title_cycle.${displayIndex}`}
            title="Cycle alternate titles"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              display: "flex",
              alignItems: "flex-start",
              paddingTop: "14px",
              color: "oklch(0.55 0.12 60)",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ── Info area ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          height: CARD_HEIGHT,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "0.35rem",
          padding: "8px 14px",
          borderLeft: "1px solid transparent",
        }}
      >
        {/* Action buttons — absolutely positioned top-right, visible on hover */}
        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ position: "absolute", top: 8, right: 8 }}
        >
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

        {/* Status badge + heart — centered in the column */}
        <div className="flex items-center gap-2">
          {/* Clickable status badge */}
          <button
            ref={statusBadgeRef}
            type="button"
            data-ocid={`manga.status_badge.${displayIndex}`}
            onClick={handleStatusBadgeClick}
            className={`text-xs font-semibold px-1.5 py-0.5 rounded-sm ${statusClass}`}
            style={{
              background: "rgba(0,0,0,0.85)",
              border: "1px solid currentColor",
              whiteSpace: "nowrap",
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "0.75";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = "1";
            }}
            aria-label={`Status: ${STATUS_LABELS[entry.status as unknown as MangaStatus]}. Click to change.`}
            title="Click to change status"
          >
            {(entry.status as unknown as MangaStatus) ===
            MangaStatus.Completed ? (
              <span
                style={{
                  background:
                    "linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0099ff, #aa00ff, #ff0000)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "rainbow-shift 3s linear infinite",
                }}
              >
                {STATUS_LABELS[entry.status as unknown as MangaStatus]}
              </span>
            ) : (
              STATUS_LABELS[entry.status as unknown as MangaStatus]
            )}
          </button>

          {/* Heart / Favourite toggle */}
          <button
            type="button"
            data-ocid={`manga.favourite_toggle.${displayIndex}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavourite(entry);
            }}
            className="w-6 h-6 flex items-center justify-center rounded transition-transform duration-150"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            aria-label={
              entry.isFavourite ? "Remove from favourites" : "Add to favourites"
            }
            title={
              entry.isFavourite ? "Remove from favourites" : "Add to favourites"
            }
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            <Heart
              size={14}
              strokeWidth={entry.isFavourite ? 0 : 1.5}
              style={{
                color: entry.isFavourite ? PINK : GOLD_DIM,
                fill: entry.isFavourite ? PINK : "transparent",
                transition: "color 0.2s, fill 0.2s",
              }}
            />
          </button>
        </div>

        {/* Chapter progress — clickable */}
        <button
          ref={chapterTriggerRef}
          type="button"
          data-ocid={`manga.chapter_edit.${displayIndex}`}
          onClick={handleChapterClick}
          style={{
            background: "transparent",
            border: "none",
            padding: "2px 4px",
            borderRadius: "0.25rem",
            cursor: "pointer",
            textAlign: "left",
            maxWidth: 220,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background =
              "oklch(0.82 0.17 85 / 0.07)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
          title="Click to edit chapters"
          aria-label="Edit chapter progress"
        >
          <ChapterProgress
            current={Number(entry.currentChapter)}
            total={
              entry.totalChapters != null
                ? Number(entry.totalChapters)
                : undefined
            }
          />
        </button>

        {/* Rating — clickable */}
        {entry.rating != null ? (
          <button
            ref={ratingTriggerRef}
            type="button"
            data-ocid={`manga.rating_edit.${displayIndex}`}
            onClick={handleRatingClick}
            style={{
              background: "transparent",
              border: "none",
              padding: "2px 4px",
              borderRadius: "0.25rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "oklch(0.82 0.17 85 / 0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
            title="Click to edit rating"
            aria-label="Edit rating"
          >
            <StarRating rating={Number(entry.rating)} />
          </button>
        ) : (
          <button
            ref={ratingTriggerRef}
            type="button"
            data-ocid={`manga.rating_edit.${displayIndex}`}
            onClick={handleRatingClick}
            style={{
              background: "transparent",
              border: "none",
              padding: "2px 4px",
              borderRadius: "0.25rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
              fontSize: "0.75rem",
              color: GOLD_FAINT,
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "oklch(0.82 0.17 85 / 0.07)";
              el.style.color = GOLD_DIM;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "transparent";
              el.style.color = GOLD_FAINT;
            }}
            title="Click to add rating"
            aria-label="Add rating"
          >
            + Add rating
          </button>
        )}

        {/* Art Rating + Cen LVL row */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Art Rating */}
          <button
            ref={artRatingTriggerRef}
            type="button"
            data-ocid={`manga.art_rating_edit.${displayIndex}`}
            onClick={handleArtRatingClick}
            style={{
              background: "transparent",
              border: "none",
              padding: "2px 4px",
              borderRadius: "0.25rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              width: "fit-content",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "oklch(0.82 0.17 85 / 0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
            title="Click to edit Art rating"
            aria-label="Edit Art rating"
          >
            <span style={{ fontSize: "0.7rem", color: GOLD_FAINT }}>Art</span>
            {entry.artRating != null ? (
              <span
                style={
                  entry.artRating >= 8
                    ? RAINBOW_STYLE
                    : { color: GOLD_DIM, fontSize: "0.75rem" }
                }
              >
                {entry.artRating}
              </span>
            ) : (
              <span style={{ color: GOLD_FAINT, fontSize: "0.7rem" }}>—</span>
            )}
          </button>

          {/* Cen LVL */}
          <button
            ref={cenLvlTriggerRef}
            type="button"
            data-ocid={`manga.cen_lvl_edit.${displayIndex}`}
            onClick={handleCenLvlClick}
            style={{
              background: "transparent",
              border: "none",
              padding: "2px 4px",
              borderRadius: "0.25rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              width: "fit-content",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background =
                "oklch(0.82 0.17 85 / 0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
            title="Click to edit Cen LVL"
            aria-label="Edit Cen LVL"
          >
            <span style={{ fontSize: "0.7rem", color: GOLD_FAINT }}>
              Cen LVL
            </span>
            {entry.cenLvl != null ? (
              <span
                style={
                  entry.cenLvl <= 1
                    ? RAINBOW_STYLE
                    : { color: GOLD_DIM, fontSize: "0.75rem" }
                }
              >
                {entry.cenLvl}
              </span>
            ) : (
              <span style={{ color: GOLD_FAINT, fontSize: "0.7rem" }}>—</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Genre column ─────────────────────────────────────────────────── */}
      <div
        style={{
          width: 180,
          flexShrink: 0,
          height: CARD_HEIGHT,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: "0.3rem",
          padding: "8px 14px",
          borderLeft: "1px solid transparent",
        }}
      >
        {entry.genres.length > 0 ? (
          <>
            {entry.genres.slice(0, 4).map((g) => (
              <span
                key={g}
                className="text-xs px-1.5 py-0.5 rounded-sm"
                style={{
                  border: "1px solid oklch(0.82 0.17 85 / 0.4)",
                  color: GOLD_DIM,
                  whiteSpace: "nowrap",
                  display: "inline-block",
                }}
              >
                {g}
              </span>
            ))}
            {entry.genres.length > 4 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded-sm"
                style={{ color: GOLD_FAINT }}
              >
                +{entry.genres.length - 4}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs" style={{ color: GOLD_FAINT }}>
            —
          </span>
        )}
      </div>

      {/* ── Notes icon column ────────────────────────────────────────────── */}
      <div
        style={{
          width: 48,
          flexShrink: 0,
          height: CARD_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderLeft: "1px solid transparent",
        }}
      >
        <button
          type="button"
          data-ocid={`manga.notes_toggle.${displayIndex}`}
          onClick={handleNotesClick}
          onMouseEnter={handleNotesMouseEnter}
          onMouseLeave={handleNotesMouseLeave}
          title={hasNotes ? "View / edit notes" : "Add notes"}
          aria-label={hasNotes ? "View or edit notes" : "Add notes"}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "6px",
            borderRadius: "0.375rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s",
          }}
          onFocus={handleNotesMouseEnter}
          onBlur={handleNotesMouseLeave}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <NotebookPen
            size={16}
            strokeWidth={1.5}
            style={{
              color: hasNotes ? NOTES_RED : GOLD_FAINT,
              transition: "color 0.2s",
              flexShrink: 0,
            }}
          />
        </button>
      </div>

      {/* Cover Preview Popup via portal */}
      <AnimatePresence>
        {popupVisible && anchorRect && (
          <CoverPreviewPopup
            entry={entry}
            anchorRect={anchorRect}
            popupRef={popupRef}
            onMouseEnter={showPopup}
            onMouseLeave={scheduleHide}
          />
        )}
      </AnimatePresence>

      {/* Status Dropdown */}
      <AnimatePresence>
        {statusDropdownOpen && statusAnchorRect && (
          <StatusDropdown
            anchorRect={statusAnchorRect}
            currentStatus={entry.status as unknown as MangaStatus}
            onSelect={(status) => onQuickStatusChange(entry, status)}
            onClose={() => setStatusDropdownOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Chapter Edit Popup */}
      <AnimatePresence>
        {chapterPopupOpen && chapterAnchorRect && (
          <InlinePopup
            anchorRect={chapterAnchorRect}
            onClose={() => setChapterPopupOpen(false)}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <p
                style={{
                  color: GOLD_DIM,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Edit Chapters
              </p>
              <div
                style={{ display: "flex", gap: "6px", alignItems: "center" }}
              >
                <input
                  type="number"
                  min={0}
                  value={chapterCurrentInput}
                  onChange={(e) => setChapterCurrentInput(e.target.value)}
                  placeholder="Current"
                  style={{
                    flex: 1,
                    background: "#000",
                    border: `1px solid ${GOLD_DIM}`,
                    color: GOLD,
                    borderRadius: "0.25rem",
                    padding: "4px 6px",
                    fontSize: "0.8rem",
                    outline: "none",
                    width: "80px",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleChapterSave();
                  }}
                />
                <span style={{ color: GOLD_FAINT, fontSize: "0.75rem" }}>
                  /
                </span>
                <input
                  type="number"
                  min={0}
                  value={chapterTotalInput}
                  onChange={(e) => setChapterTotalInput(e.target.value)}
                  placeholder="Total"
                  style={{
                    flex: 1,
                    background: "#000",
                    border: `1px solid ${GOLD_DIM}`,
                    color: GOLD,
                    borderRadius: "0.25rem",
                    padding: "4px 6px",
                    fontSize: "0.8rem",
                    outline: "none",
                    width: "80px",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleChapterSave();
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleChapterSave}
                data-ocid={`manga.chapter_edit.save_button.${displayIndex}`}
                style={{
                  background: "transparent",
                  border: `1px solid ${GOLD}`,
                  color: GOLD,
                  borderRadius: "0.25rem",
                  padding: "4px 8px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.1s, color 0.1s",
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
                Save
              </button>
            </div>
          </InlinePopup>
        )}
      </AnimatePresence>

      {/* Rating Edit Popup */}
      <AnimatePresence>
        {ratingPopupOpen && ratingAnchorRect && (
          <InlinePopup
            anchorRect={ratingAnchorRect}
            onClose={() => setRatingPopupOpen(false)}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <p
                style={{
                  color: GOLD_DIM,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Edit Rating (1–10)
              </p>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={ratingInput}
                onChange={(e) => setRatingInput(e.target.value)}
                placeholder="e.g. 9.5"
                style={{
                  background: "#000",
                  border: `1px solid ${GOLD_DIM}`,
                  color: GOLD,
                  borderRadius: "0.25rem",
                  padding: "4px 8px",
                  fontSize: "0.8rem",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRatingSave();
                }}
              />
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={handleRatingSave}
                  data-ocid={`manga.rating_edit.save_button.${displayIndex}`}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: `1px solid ${GOLD}`,
                    color: GOLD,
                    borderRadius: "0.25rem",
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.1s, color 0.1s",
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
                  Save
                </button>
                {entry.rating != null && (
                  <button
                    type="button"
                    onClick={() => {
                      onQuickRatingChange(entry, undefined);
                      setRatingPopupOpen(false);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid oklch(0.7 0.22 25)",
                      color: "oklch(0.7 0.22 25)",
                      borderRadius: "0.25rem",
                      padding: "4px 8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      transition: "background 0.1s, color 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "oklch(0.7 0.22 25)";
                      el.style.color = "#000";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "transparent";
                      el.style.color = "oklch(0.7 0.22 25)";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </InlinePopup>
        )}
      </AnimatePresence>

      {/* Art Rating Edit Popup */}
      <AnimatePresence>
        {artRatingPopupOpen && artRatingAnchorRect && (
          <InlinePopup
            anchorRect={artRatingAnchorRect}
            onClose={() => setArtRatingPopupOpen(false)}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <p
                style={{
                  color: GOLD_DIM,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Art Rating (1–10)
              </p>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={artRatingInput}
                onChange={(e) => setArtRatingInput(e.target.value)}
                placeholder="e.g. 7.5"
                style={{
                  background: "#000",
                  border: `1px solid ${GOLD_DIM}`,
                  color: GOLD,
                  borderRadius: "0.25rem",
                  padding: "4px 8px",
                  fontSize: "0.8rem",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleArtRatingSave();
                }}
              />
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={handleArtRatingSave}
                  data-ocid={`manga.art_rating_edit.save_button.${displayIndex}`}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: `1px solid ${GOLD}`,
                    color: GOLD,
                    borderRadius: "0.25rem",
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.1s, color 0.1s",
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
                  Save
                </button>
                {entry.artRating != null && (
                  <button
                    type="button"
                    onClick={() => {
                      onQuickArtRatingChange(entry, undefined);
                      setArtRatingPopupOpen(false);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid oklch(0.7 0.22 25)",
                      color: "oklch(0.7 0.22 25)",
                      borderRadius: "0.25rem",
                      padding: "4px 8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      transition: "background 0.1s, color 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "oklch(0.7 0.22 25)";
                      el.style.color = "#000";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "transparent";
                      el.style.color = "oklch(0.7 0.22 25)";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </InlinePopup>
        )}
      </AnimatePresence>

      {/* Cen LVL Edit Popup */}
      <AnimatePresence>
        {cenLvlPopupOpen && cenLvlAnchorRect && (
          <InlinePopup
            anchorRect={cenLvlAnchorRect}
            onClose={() => setCenLvlPopupOpen(false)}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <p
                style={{
                  color: GOLD_DIM,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                Cen LVL (1–10)
              </p>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={cenLvlInput}
                onChange={(e) => setCenLvlInput(e.target.value)}
                placeholder="e.g. 3.0"
                style={{
                  background: "#000",
                  border: `1px solid ${GOLD_DIM}`,
                  color: GOLD,
                  borderRadius: "0.25rem",
                  padding: "4px 8px",
                  fontSize: "0.8rem",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCenLvlSave();
                }}
              />
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={handleCenLvlSave}
                  data-ocid={`manga.cen_lvl_edit.save_button.${displayIndex}`}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: `1px solid ${GOLD}`,
                    color: GOLD,
                    borderRadius: "0.25rem",
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.1s, color 0.1s",
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
                  Save
                </button>
                {entry.cenLvl != null && (
                  <button
                    type="button"
                    onClick={() => {
                      onQuickCenLvlChange(entry, undefined);
                      setCenLvlPopupOpen(false);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid oklch(0.7 0.22 25)",
                      color: "oklch(0.7 0.22 25)",
                      borderRadius: "0.25rem",
                      padding: "4px 8px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      transition: "background 0.1s, color 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "oklch(0.7 0.22 25)";
                      el.style.color = "#000";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "transparent";
                      el.style.color = "oklch(0.7 0.22 25)";
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </InlinePopup>
        )}
      </AnimatePresence>

      {/* Notes Hover Preview */}
      <AnimatePresence>
        {notesHoverVisible && !notesEditOpen && (
          <NotesPreviewPopup notes={entry.notes ?? ""} />
        )}
      </AnimatePresence>

      {/* Notes Edit Popup */}
      <AnimatePresence>
        {notesEditOpen && (
          <NotesEditPopup
            entry={entry}
            onSave={(notes) => onQuickNotesChange(entry, notes)}
            onClose={() => setNotesEditOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.article>
  );
}
