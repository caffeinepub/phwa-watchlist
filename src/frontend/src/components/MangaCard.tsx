import {
  BookOpen,
  ChevronRight,
  Edit2,
  Heart,
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

const CARD_HEIGHT = 140;
const COVER_WIDTH_MAX = 170; // max cover width (auto based on aspect ratio, capped)
const TITLE_WIDTH = 240;
const SCROLL_SPEED = 30; // px/second
const SCROLL_GAP = 24; // gap between two text copies

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
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating / 2);
  return (
    <div
      className="flex gap-0.5 items-center"
      aria-label={`Rating: ${rating}/10`}
    >
      {Array.from({ length: 5 }, (_, i) => i).map((i) => (
        <Star
          key={`star-${i}`}
          size={11}
          style={{
            color: i < filled ? GOLD : GOLD_FAINT,
            fill: i < filled ? GOLD : "transparent",
            flexShrink: 0,
          }}
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

  const handleChapterSave = useCallback(() => {
    const current = Number(chapterCurrentInput) || 0;
    const total = chapterTotalInput ? Number(chapterTotalInput) : undefined;
    onQuickChapterChange(entry, current, total);
    setChapterPopupOpen(false);
  }, [chapterCurrentInput, chapterTotalInput, entry, onQuickChapterChange]);

  const handleRatingSave = useCallback(() => {
    const r = ratingInput ? Number(ratingInput) : undefined;
    if (r !== undefined && (r < 1 || r > 10)) return;
    onQuickRatingChange(entry, r);
    setRatingPopupOpen(false);
  }, [ratingInput, entry, onQuickRatingChange]);

  return (
    <motion.article
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
          borderRight: "1px solid oklch(0.82 0.17 85 / 0.2)",
        }}
        onMouseEnter={showPopup}
        onMouseLeave={scheduleHide}
      >
        {entry.coverImageUrl ? (
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
          borderLeft: "1px solid oklch(0.82 0.17 85 / 0.12)",
        }}
      >
        {/* Top row: status + heart + action buttons */}
        <div className="flex items-center justify-between gap-2">
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

            {/* Heart / Favourite toggle — always visible */}
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
                entry.isFavourite
                  ? "Remove from favourites"
                  : "Add to favourites"
              }
              title={
                entry.isFavourite
                  ? "Remove from favourites"
                  : "Add to favourites"
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

          {/* Action buttons — visible on hover */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
          borderLeft: "1px solid oklch(0.82 0.17 85 / 0.12)",
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
                value={ratingInput}
                onChange={(e) => setRatingInput(e.target.value)}
                placeholder="e.g. 9"
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
    </motion.article>
  );
}
