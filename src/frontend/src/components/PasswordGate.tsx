import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const CORRECT_PASSWORD = "kamehamea";
const MAX_ATTEMPTS = 3;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in ms

const GOLD = "oklch(0.82 0.17 85)";
const GOLD_DIM = "oklch(0.62 0.12 85)";
const GOLD_FAINT = "oklch(0.40 0.08 85)";
const ERROR_RED = "oklch(0.7 0.22 25)";

interface PasswordGateProps {
  principalText: string;
  onSuccess: () => void;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PasswordGate({ principalText, onSuccess }: PasswordGateProps) {
  const trustedKey = `trusted_${principalText}`;
  const lockoutKey = `lockout_${principalText}`;

  const [passwordInput, setPasswordInput] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [errorMsg, setErrorMsg] = useState("");
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");
  const [checked, setChecked] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // On mount: check trusted status and lockout
  useEffect(() => {
    const trusted = localStorage.getItem(trustedKey);
    if (trusted === "true") {
      onSuccess();
      return;
    }

    const lockoutExpiry = localStorage.getItem(lockoutKey);
    if (lockoutExpiry) {
      const expiry = Number(lockoutExpiry);
      const now = Date.now();
      if (expiry > now) {
        setLockedUntil(expiry);
      } else {
        localStorage.removeItem(lockoutKey);
      }
    }

    setChecked(true);
  }, [trustedKey, lockoutKey, onSuccess]);

  // Countdown timer when locked
  useEffect(() => {
    if (!lockedUntil) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttemptsLeft(MAX_ATTEMPTS);
        setErrorMsg("");
        localStorage.removeItem(lockoutKey);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        setCountdown(formatCountdown(remaining));
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [lockedUntil, lockoutKey]);

  // Focus input when unlocked
  useEffect(() => {
    if (checked && !lockedUntil) {
      inputRef.current?.focus();
    }
  }, [checked, lockedUntil]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockedUntil) return;

    if (passwordInput === CORRECT_PASSWORD) {
      localStorage.setItem(trustedKey, "true");
      onSuccess();
      return;
    }

    const newAttemptsLeft = attemptsLeft - 1;
    setPasswordInput("");

    if (newAttemptsLeft <= 0) {
      const expiry = Date.now() + LOCKOUT_DURATION;
      localStorage.setItem(lockoutKey, String(expiry));
      setLockedUntil(expiry);
      setAttemptsLeft(MAX_ATTEMPTS);
      setErrorMsg("");
    } else {
      setAttemptsLeft(newAttemptsLeft);
      setErrorMsg(
        newAttemptsLeft === 1
          ? "Incorrect password. 1 attempt remaining."
          : `Incorrect password. ${newAttemptsLeft} attempts remaining.`,
      );
    }
  };

  if (!checked) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: GOLD_FAINT,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center"
      style={{ zIndex: 9999 }}
    >
      <motion.div
        data-ocid="password_gate.dialog"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#000",
          border: `1.5px solid ${GOLD}`,
          borderRadius: "0.75rem",
          padding: "2rem",
          boxShadow:
            "0 0 40px oklch(0.82 0.17 85 / 0.2), 0 0 80px oklch(0.82 0.17 85 / 0.06)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Subtitle */}
        <p
          style={{
            color: GOLD_DIM,
            fontSize: "0.875rem",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
        >
          Enter access password
        </p>

        {lockedUntil ? (
          /* Lockout state */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "1px solid oklch(0.82 0.17 85 / 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: ERROR_RED,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {countdown}
              </span>
            </div>
            <p
              style={{
                color: ERROR_RED,
                fontSize: "0.8rem",
                textAlign: "center",
              }}
            >
              Too many incorrect attempts.
            </p>
            <p
              style={{
                color: GOLD_FAINT,
                fontSize: "0.75rem",
                textAlign: "center",
              }}
            >
              Try again when the timer reaches 0:00
            </p>
          </div>
        ) : (
          /* Password form */
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <input
                ref={inputRef}
                data-ocid="password_gate.input"
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                placeholder="Password"
                style={{
                  width: "100%",
                  background: "#000",
                  border: `1px solid ${errorMsg ? ERROR_RED : GOLD}`,
                  color: GOLD,
                  borderRadius: "0.375rem",
                  padding: "0.625rem 0.875rem",
                  fontSize: "0.9375rem",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  if (!errorMsg) {
                    (e.currentTarget as HTMLElement).style.borderColor = GOLD;
                  }
                }}
                autoComplete="current-password"
              />
              {errorMsg && (
                <p
                  data-ocid="password_gate.error_state"
                  style={{
                    color: ERROR_RED,
                    fontSize: "0.75rem",
                    margin: 0,
                  }}
                >
                  {errorMsg}
                </p>
              )}
              {!errorMsg && attemptsLeft < MAX_ATTEMPTS && (
                <p
                  style={{ color: GOLD_FAINT, fontSize: "0.75rem", margin: 0 }}
                >
                  {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""}{" "}
                  remaining
                </p>
              )}
            </div>

            <button
              type="submit"
              data-ocid="password_gate.submit_button"
              disabled={!passwordInput.trim()}
              style={{
                width: "100%",
                background: "transparent",
                border: `1.5px solid ${GOLD}`,
                color: GOLD,
                borderRadius: "0.375rem",
                padding: "0.625rem",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: passwordInput.trim() ? "pointer" : "not-allowed",
                opacity: passwordInput.trim() ? 1 : 0.5,
                transition: "background 0.15s, color 0.15s, opacity 0.15s",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (passwordInput.trim()) {
                  const el = e.currentTarget;
                  el.style.background = GOLD;
                  el.style.color = "#000";
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = "transparent";
                el.style.color = GOLD;
              }}
            >
              Unlock
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
