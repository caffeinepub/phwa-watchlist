import { Button } from "@/components/ui/button";
import { BookOpen, Fingerprint } from "lucide-react";
import { motion } from "motion/react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export function LoginPage() {
  const { login, isLoggingIn } = useInternetIdentity();

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Background decorative rings */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.05)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.08)" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border"
          style={{ borderColor: "oklch(0.82 0.17 85 / 0.12)" }}
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
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm mx-4"
      >
        {/* Card */}
        <div
          className="relative bg-black rounded-lg p-8 flex flex-col items-center gap-8"
          style={{
            border: "1.5px solid oklch(0.82 0.17 85)",
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

          {/* Icon mark */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center justify-center w-16 h-16 rounded-lg"
            style={{
              border: "1px solid oklch(0.82 0.17 85 / 0.5)",
              background: "oklch(0.82 0.17 85 / 0.06)",
            }}
          >
            <BookOpen
              size={28}
              style={{ color: "oklch(0.82 0.17 85)" }}
              strokeWidth={1.5}
            />
          </motion.div>

          {/* Prompt */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-center space-y-2"
          >
            <p
              className="text-xl font-semibold font-display tracking-wide"
              style={{ color: "oklch(0.82 0.17 85)" }}
            >
              Your Collection Awaits
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "oklch(0.62 0.12 85)" }}
            >
              Sign in to access your manga watchlist,
              <br />
              track progress, and sync across devices.
            </p>
          </motion.div>

          {/* Sign in button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="w-full"
          >
            <Button
              data-ocid="login.submit_button"
              onClick={login}
              disabled={isLoggingIn}
              className="w-full h-12 font-semibold tracking-wide transition-all duration-200"
              style={{
                background: "transparent",
                border: "1.5px solid oklch(0.82 0.17 85)",
                color: "oklch(0.82 0.17 85)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.background = "oklch(0.82 0.17 85)";
                el.style.color = "#000";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.background = "transparent";
                el.style.color = "oklch(0.82 0.17 85)";
              }}
            >
              <Fingerprint size={18} className="mr-2" strokeWidth={1.5} />
              {isLoggingIn ? "Connecting…" : "Sign in with Internet Identity"}
            </Button>
          </motion.div>

          {/* Bottom note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-xs text-center"
            style={{ color: "oklch(0.40 0.08 85)" }}
          >
            Secured by the Internet Computer
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
