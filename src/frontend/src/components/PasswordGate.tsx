import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";
const GOLD_FAINT = "oklch(0.40 0.08 85)";
const CORRECT_PASSWORD = "kamehamea";
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in ms
const FAIL_KEY = "phwa_fail_count";
const LOCKOUT_KEY = "phwa_lockout_until";

interface PasswordGateProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actor: any;
  onSuccess: () => void;
}

function getLockoutRemaining(): number {
  const lockoutUntil = localStorage.getItem(LOCKOUT_KEY);
  if (!lockoutUntil) return 0;
  const remaining = Number.parseInt(lockoutUntil, 10) - Date.now();
  return remaining > 0 ? remaining : 0;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PasswordGate({ actor, onSuccess }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startLockoutTimer = useCallback((remainingMs: number) => {
    setIsLocked(true);
    setCountdown(remainingMs);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const remaining = getLockoutRemaining();
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsLocked(false);
        setCountdown(0);
        setError("");
        localStorage.removeItem(LOCKOUT_KEY);
        localStorage.removeItem(FAIL_KEY);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }, []);

  // Check lockout state on mount
  useEffect(() => {
    const remaining = getLockoutRemaining();
    if (remaining > 0) {
      startLockoutTimer(remaining);
    }
    // Focus input on mount if not locked
    if (remaining <= 0) {
      inputRef.current?.focus();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startLockoutTimer]);

  // Update countdown display continuously
  useEffect(() => {
    if (!isLocked) return;
    const tick = setInterval(() => {
      const remaining = getLockoutRemaining();
      setCountdown(remaining);
    }, 250);
    return () => clearInterval(tick);
  }, [isLocked]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isLocked || isSubmitting) return;

      if (password === CORRECT_PASSWORD) {
        setIsSubmitting(true);
        setError("");
        try {
          // Mark trusted in backend (fire-and-forget — best effort)
          if (actor) {
            await (actor as { markTrusted: () => Promise<void> }).markTrusted();
          }
        } catch {
          // non-fatal — proceed anyway
        }
        // Clear any previous fail counters
        localStorage.removeItem(FAIL_KEY);
        localStorage.removeItem(LOCKOUT_KEY);
        setIsSubmitting(false);
        onSuccess();
      } else {
        // Wrong password
        const prevFails = Number.parseInt(
          localStorage.getItem(FAIL_KEY) ?? "0",
          10,
        );
        const newFails = prevFails + 1;

        if (newFails >= MAX_ATTEMPTS) {
          // Lock out
          const lockUntil = Date.now() + LOCKOUT_DURATION;
          localStorage.setItem(LOCKOUT_KEY, String(lockUntil));
          localStorage.setItem(FAIL_KEY, "0");
          setError("");
          setPassword("");
          startLockoutTimer(LOCKOUT_DURATION);
        } else {
          localStorage.setItem(FAIL_KEY, String(newFails));
          const attemptsLeft = MAX_ATTEMPTS - newFails;
          setError(
            attemptsLeft === 1
              ? "Incorrect password. 1 attempt remaining."
              : `Incorrect password. ${attemptsLeft} attempts remaining.`,
          );
          setPassword("");
          inputRef.current?.focus();
        }
      }
    },
    [password, isLocked, isSubmitting, actor, onSuccess, startLockoutTimer],
  );

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Decorative background rings */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.04)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.07)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full border"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.11)" }}
        />
        {/* Corner ornaments */}
        <div
          className="absolute top-6 left-6 w-16 h-16 border-l-2 border-t-2"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.3)" }}
        />
        <div
          className="absolute top-6 right-6 w-16 h-16 border-r-2 border-t-2"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.3)" }}
        />
        <div
          className="absolute bottom-6 left-6 w-16 h-16 border-l-2 border-b-2"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.3)" }}
        />
        <div
          className="absolute bottom-6 right-6 w-16 h-16 border-r-2 border-b-2"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.3)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-sm mx-4"
      >
        <div
          className="relative bg-black rounded-lg p-8 flex flex-col items-center gap-7"
          style={{
            border: `1.5px solid ${GOLD}`,
            boxShadow:
              "0 0 40px oklch(0.82 0.17 85 / 0.15), 0 0 80px oklch(0.82 0.17 85 / 0.06)",
          }}
        >
          {/* Top ornament line */}
          <div
            className="absolute -top-px left-1/4 right-1/4 h-px"
            style={{ background: "oklch(0.91 0.18 85)" }}
            aria-hidden="true"
          />

          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="flex items-center justify-center w-16 h-16 rounded-lg"
            style={{
              border: "1px solid oklch(0.82 0.17 85 / 0.5)",
              background: "oklch(0.82 0.17 85 / 0.06)",
            }}
          >
            {isLocked ? (
              <ShieldAlert
                size={28}
                style={{ color: "oklch(0.65 0.20 30)" }}
                strokeWidth={1.5}
              />
            ) : (
              <Lock size={28} style={{ color: GOLD }} strokeWidth={1.5} />
            )}
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="text-center space-y-2"
          >
            <p
              className="text-xl font-semibold font-display tracking-wide"
              style={{ color: GOLD }}
            >
              {isLocked ? "Access Locked" : "Enter Access Password"}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: GOLD_DIM }}>
              {isLocked
                ? "Too many failed attempts."
                : "This collection is password protected."}
            </p>
          </motion.div>

          {/* Form */}
          <motion.form
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            onSubmit={handleSubmit}
            className="w-full space-y-4"
          >
            {/* Password input row */}
            <div className="relative">
              <Input
                ref={inputRef}
                data-ocid="password_gate.input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Password"
                disabled={isLocked || isSubmitting}
                autoComplete="current-password"
                className="w-full h-11 pr-10 bg-transparent font-mono text-sm"
                style={{
                  border: `1px solid ${error ? "oklch(0.65 0.20 30)" : "oklch(0.82 0.17 85 / 0.45)"}`,
                  color: GOLD,
                  caretColor: GOLD,
                  outline: "none",
                }}
                aria-describedby={error ? "password-error" : undefined}
              />
              <button
                type="button"
                data-ocid="password_gate.toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isLocked}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity"
                style={{ color: GOLD_FAINT, opacity: isLocked ? 0.4 : 1 }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <motion.p
                id="password-error"
                data-ocid="password_gate.error_state"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-center"
                style={{ color: "oklch(0.65 0.20 30)" }}
                role="alert"
                aria-live="polite"
              >
                {error}
              </motion.p>
            )}

            {/* Lockout countdown */}
            {isLocked && countdown > 0 && (
              <motion.div
                data-ocid="password_gate.error_state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-1 py-1"
              >
                <output
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: "oklch(0.65 0.20 30)" }}
                  aria-live="polite"
                  aria-label={`Locked out. Try again in ${formatCountdown(countdown)}`}
                >
                  Too many attempts. Try again in{" "}
                  <span className="font-mono">
                    {formatCountdown(countdown)}
                  </span>
                </output>
                {/* Progress bar */}
                <div
                  className="w-full h-0.5 rounded-full overflow-hidden mt-1"
                  style={{ background: "oklch(0.15 0 0)" }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: "oklch(0.65 0.20 30)",
                      width: `${Math.round((countdown / LOCKOUT_DURATION) * 100)}%`,
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Submit button */}
            <Button
              data-ocid="password_gate.submit_button"
              type="submit"
              disabled={isLocked || isSubmitting || !password}
              className="w-full h-11 font-semibold tracking-wide transition-all duration-200"
              style={{
                background: "transparent",
                border: `1.5px solid ${isLocked ? "oklch(0.82 0.17 85 / 0.25)" : GOLD}`,
                color: isLocked ? "oklch(0.82 0.17 85 / 0.35)" : GOLD,
              }}
              onMouseEnter={(e) => {
                if (isLocked || isSubmitting) return;
                const el = e.currentTarget;
                el.style.background = GOLD;
                el.style.color = "#000";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = "transparent";
                el.style.color = isLocked ? "oklch(0.82 0.17 85 / 0.35)" : GOLD;
                el.style.borderColor = isLocked
                  ? "oklch(0.82 0.17 85 / 0.25)"
                  : GOLD;
              }}
            >
              {isSubmitting ? "Verifying…" : "Unlock"}
            </Button>
          </motion.form>

          {/* Bottom note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-xs text-center"
            style={{ color: GOLD_FAINT }}
          >
            Secured by Internet Identity
          </motion.p>

          {/* Bottom ornament line */}
          <div
            className="absolute -bottom-px left-1/4 right-1/4 h-px"
            style={{ background: "oklch(0.91 0.18 85)" }}
            aria-hidden="true"
          />
        </div>
      </motion.div>
    </div>
  );
}
