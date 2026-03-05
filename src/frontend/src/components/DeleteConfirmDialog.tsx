import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";
const RED = "oklch(0.7 0.22 25)";

interface DeleteConfirmDialogProps {
  open: boolean;
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({
  open,
  title,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50"
            style={{ background: "rgba(0,0,0,0.9)" }}
            onClick={onCancel}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm deletion"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="relative w-full max-w-sm bg-black rounded-lg p-6 space-y-5"
              style={{
                border: `1.5px solid ${GOLD}`,
                boxShadow: "0 0 30px oklch(0.82 0.17 85 / 0.15)",
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{
                    border: `1px solid ${RED}`,
                    background: "oklch(0.7 0.22 25 / 0.1)",
                  }}
                >
                  <AlertTriangle
                    size={22}
                    style={{ color: RED }}
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3
                    className="text-base font-semibold font-display"
                    style={{ color: GOLD }}
                  >
                    Remove from Watchlist?
                  </h3>
                  <p
                    className="mt-1 text-sm leading-relaxed"
                    style={{ color: GOLD_DIM }}
                  >
                    <span className="font-medium" style={{ color: GOLD }}>
                      &ldquo;{title}&rdquo;
                    </span>{" "}
                    will be permanently deleted.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  data-ocid="manga.delete.cancel_button"
                  className="flex-1 transition-colors"
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
                  type="button"
                  onClick={onConfirm}
                  data-ocid="manga.delete.confirm_button"
                  className="flex-1 font-semibold transition-all duration-200"
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${RED}`,
                    color: RED,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.background = RED;
                    el.style.color = "#000";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.background = "transparent";
                    el.style.color = RED;
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
