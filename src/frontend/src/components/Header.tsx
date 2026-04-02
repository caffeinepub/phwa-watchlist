import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, LogOut, RefreshCw, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";

interface HeaderProps {
  onLogout: () => void;
  isSyncing: boolean;
  pendingCount: number;
  currentPage: number;
  totalPages: number;
  onGoToPage: (page: number) => void;
  lastSynced?: number | null;
  cycleBalance?: number | null;
}

function CycleBadge({ tc }: { tc: number }) {
  // Color tiers: green-ish gold when healthy, amber when low, red when critical
  let color: string;
  let borderColor: string;
  let bgColor: string;

  if (tc > 1) {
    // Healthy — gold-green
    color = "oklch(0.78 0.15 130)";
    borderColor = "oklch(0.78 0.15 130 / 0.5)";
    bgColor = "oklch(0.78 0.15 130 / 0.08)";
  } else if (tc >= 0.5) {
    // Low — amber
    color = "oklch(0.78 0.18 65)";
    borderColor = "oklch(0.78 0.18 65 / 0.5)";
    bgColor = "oklch(0.78 0.18 65 / 0.08)";
  } else {
    // Critical — red
    color = "oklch(0.65 0.22 25)";
    borderColor = "oklch(0.65 0.22 25 / 0.5)";
    bgColor = "oklch(0.65 0.22 25 / 0.08)";
  }

  return (
    <div
      data-ocid="header.cycle_balance"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium hidden sm:flex"
      style={{
        border: `1px solid ${borderColor}`,
        color,
        background: bgColor,
        cursor: "default",
      }}
      title="Canister cycles remaining (may be slightly out of date)"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M3 5.5 L4.5 7 L7 3.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {tc.toFixed(2)} TC
    </div>
  );
}

function formatSynced(ts: number | null | undefined): string {
  if (!ts) return "";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Synced just now";
  if (mins < 60) return `Synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Synced ${hrs}h ago`;
  return `Synced ${Math.floor(hrs / 24)}d ago`;
}

function OnlineBadge({ isOnline }: { isOnline: boolean }) {
  if (isOnline) {
    return (
      <div
        data-ocid="header.online_state"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        style={{
          border: "1px solid oklch(0.75 0.2 145 / 0.5)",
          color: "oklch(0.75 0.2 145)",
          background: "oklch(0.75 0.2 145 / 0.08)",
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: "oklch(0.75 0.2 145)" }}
        />
        Online
      </div>
    );
  }

  return (
    <div
      data-ocid="header.offline_state"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{
        border: "1px solid oklch(0.75 0.18 55 / 0.5)",
        color: "oklch(0.75 0.18 55)",
        background: "oklch(0.75 0.18 55 / 0.08)",
      }}
    >
      <WifiOff size={11} strokeWidth={2} />
      Offline
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid oklch(0.82 0.17 85 / 0.5)",
  color: GOLD_DIM,
  borderRadius: "0.375rem",
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  transition: "border-color 0.15s, color 0.15s, background 0.15s",
};

export function Header({
  onLogout,
  isSyncing,
  pendingCount,
  currentPage,
  totalPages,
  onGoToPage,
  lastSynced,
  cycleBalance,
}: HeaderProps) {
  const isOnline = useOnlineStatus();
  const [pageInputValue, setPageInputValue] = useState(String(currentPage));
  // Force re-render every minute so the "Synced Xm ago" label stays current
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Sync input when currentPage prop changes (e.g. from bottom pagination)
  const syncedPage = String(currentPage);
  if (
    pageInputValue !== syncedPage &&
    document.activeElement?.getAttribute("data-ocid") !== "header.page_input"
  ) {
    setPageInputValue(syncedPage);
  }

  return (
    <header
      className="sticky top-0 z-30 w-full"
      style={{
        background: "#000",
        borderBottom: `1px solid ${GOLD}`,
      }}
    >
      <div className="w-full flex justify-center px-4 md:px-6">
        <div className="relative flex items-center h-14 w-full max-w-[1160px]">
          {/* Left: Logo + sync */}
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="relative"
            >
              {/* Geometric logo mark */}
              <div
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{
                  border: `1.5px solid ${GOLD}`,
                  background: "oklch(0.82 0.17 85 / 0.06)",
                }}
              >
                {/* Stylized book / scroll mark */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="2"
                    y="1"
                    width="8"
                    height="13"
                    rx="1"
                    stroke="oklch(0.82 0.17 85)"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="4"
                    y1="5"
                    x2="8"
                    y2="5"
                    stroke="oklch(0.82 0.17 85)"
                    strokeWidth="1"
                  />
                  <line
                    x1="4"
                    y1="7.5"
                    x2="8"
                    y2="7.5"
                    stroke="oklch(0.82 0.17 85)"
                    strokeWidth="1"
                  />
                  <line
                    x1="4"
                    y1="10"
                    x2="6.5"
                    y2="10"
                    stroke="oklch(0.82 0.17 85)"
                    strokeWidth="1"
                  />
                  <line
                    x1="11"
                    y1="3"
                    x2="14"
                    y2="3"
                    stroke="oklch(0.82 0.17 85)"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="11"
                    y1="13"
                    x2="14"
                    y2="13"
                    stroke="oklch(0.82 0.17 85)"
                    strokeWidth="1.2"
                  />
                  <line
                    x1="13"
                    y1="3"
                    x2="13"
                    y2="13"
                    stroke="oklch(0.62 0.12 85)"
                    strokeWidth="0.8"
                  />
                </svg>
              </div>
            </motion.div>

            {/* Sync indicator */}
            {isSyncing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: GOLD_DIM }}
              >
                <RefreshCw size={11} className="animate-spin" strokeWidth={2} />
                <span className="hidden sm:inline">Syncing…</span>
              </motion.div>
            )}
            {!isSyncing && pendingCount > 0 && (
              <div
                className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                style={{
                  border: "1px solid oklch(0.75 0.18 55 / 0.5)",
                  color: "oklch(0.75 0.18 55)",
                }}
              >
                <span>{pendingCount} pending</span>
              </div>
            )}
            {/* Last synced timestamp */}
            {!isSyncing && pendingCount === 0 && formatSynced(lastSynced) && (
              <span
                className="text-xs hidden sm:inline"
                style={{ color: "oklch(0.50 0.08 85)" }}
                title="Last confirmed sync with backend"
              >
                {formatSynced(lastSynced)}
              </span>
            )}

            {/* Cycle balance badge — only shown when a value is available */}
            {cycleBalance !== null && cycleBalance !== undefined && (
              <CycleBadge tc={cycleBalance} />
            )}
          </div>

          {/* Center: scroll + page navigation — always visible */}
          <div
            className="absolute left-1/2 flex items-center gap-2"
            style={{ transform: "translateX(-50%)" }}
          >
            {/* Arrow Up */}
            <button
              type="button"
              data-ocid="header.scroll_top_button"
              aria-label="Scroll to top"
              title="Go to top"
              style={navBtnStyle}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = GOLD;
                el.style.color = GOLD;
                el.style.background = "oklch(0.82 0.17 85 / 0.08)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "oklch(0.82 0.17 85 / 0.5)";
                el.style.color = GOLD_DIM;
                el.style.background = "transparent";
              }}
            >
              <ArrowUp size={14} strokeWidth={2} />
            </button>

            {/* Page number input */}
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInputValue}
              data-ocid="header.page_input"
              aria-label="Go to page"
              title={`Page ${currentPage} of ${totalPages}`}
              onChange={(e) => setPageInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const parsed = Number.parseInt(pageInputValue, 10);
                  if (!Number.isNaN(parsed)) onGoToPage(parsed);
                }
              }}
              onBlur={() => {
                const parsed = Number.parseInt(pageInputValue, 10);
                if (!Number.isNaN(parsed)) {
                  onGoToPage(parsed);
                } else {
                  setPageInputValue(String(currentPage));
                }
              }}
              className="text-center text-xs"
              style={{
                width: 52,
                height: 32,
                background: "#000",
                border: "1px solid oklch(0.82 0.17 85 / 0.5)",
                color: GOLD,
                borderRadius: "0.375rem",
                padding: "3px 6px",
                outline: "none",
                flexShrink: 0,
              }}
            />

            {/* Arrow Down */}
            <button
              type="button"
              data-ocid="header.scroll_bottom_button"
              aria-label="Scroll to bottom"
              title="Go to bottom"
              style={navBtnStyle}
              onClick={() =>
                window.scrollTo({
                  top: document.body.scrollHeight,
                  behavior: "smooth",
                })
              }
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = GOLD;
                el.style.color = GOLD;
                el.style.background = "oklch(0.82 0.17 85 / 0.08)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.borderColor = "oklch(0.82 0.17 85 / 0.5)";
                el.style.color = GOLD_DIM;
                el.style.background = "transparent";
              }}
            >
              <ArrowDown size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Right: online badge + sign out */}
          <div className="flex items-center gap-3 ml-auto">
            <OnlineBadge isOnline={isOnline} />

            <Button
              data-ocid="header.logout_button"
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="h-8 gap-1.5 text-xs font-medium transition-colors"
              style={{
                color: GOLD_DIM,
                border: "1px solid oklch(0.82 0.17 85 / 0.2)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.color = GOLD;
                el.style.borderColor = GOLD;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.color = GOLD_DIM;
                el.style.borderColor = "oklch(0.82 0.17 85 / 0.2)";
              }}
              aria-label="Sign out"
            >
              <LogOut size={13} strokeWidth={1.8} />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
