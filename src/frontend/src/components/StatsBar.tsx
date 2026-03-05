import { motion } from "motion/react";
import type { MangaEntry } from "../hooks/useMangaSync";
import { MangaStatus } from "../types/manga";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";

interface StatPillProps {
  label: string;
  value: number;
  accent?: string;
  index: number;
}

function StatPill({ label, value, accent, index }: StatPillProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
      className="flex items-center gap-2 px-3 py-2 rounded-md"
      style={{
        background: "#000",
        border: "1px solid oklch(0.82 0.17 85 / 0.4)",
        minWidth: "fit-content",
      }}
    >
      <span
        className="text-lg font-bold font-display tabular-nums"
        style={{ color: accent ?? GOLD }}
      >
        {value}
      </span>
      <span className="text-xs whitespace-nowrap" style={{ color: GOLD_DIM }}>
        {label}
      </span>
    </motion.div>
  );
}

interface StatsBarProps {
  entries: MangaEntry[];
}

export function StatsBar({ entries }: StatsBarProps) {
  const counts = {
    total: entries.length,
    reading: entries.filter((e) => e.status === MangaStatus.Reading).length,
    completed: entries.filter((e) => e.status === MangaStatus.Completed).length,
    onHold: entries.filter((e) => e.status === MangaStatus.OnHold).length,
    dropped: entries.filter((e) => e.status === MangaStatus.Dropped).length,
    planToRead: entries.filter((e) => e.status === MangaStatus.PlanToRead)
      .length,
  };

  const stats = [
    { label: "Total", value: counts.total, accent: GOLD },
    { label: "Reading", value: counts.reading, accent: "oklch(0.75 0.2 145)" },
    { label: "Completed", value: counts.completed, accent: GOLD },
    { label: "On Hold", value: counts.onHold, accent: "oklch(0.75 0.18 55)" },
    { label: "Dropped", value: counts.dropped, accent: "oklch(0.7 0.22 25)" },
    {
      label: "Plan to Read",
      value: counts.planToRead,
      accent: "oklch(0.7 0.15 270)",
    },
  ];

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="flex gap-2 min-w-max px-4 md:px-6">
        {stats.map((s, i) => (
          <StatPill key={s.label} {...s} index={i} />
        ))}
      </div>
    </div>
  );
}
