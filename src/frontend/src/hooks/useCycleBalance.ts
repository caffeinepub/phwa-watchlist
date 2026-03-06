import { useEffect, useState } from "react";
import { loadConfig } from "../config";
import { useOnlineStatus } from "./useOnlineStatus";

interface CycleBalanceState {
  cycleBalance: number | null;
  cycleError: boolean;
}

/**
 * Fetches the canister cycle balance from the IC public API.
 * Returns the balance in TC (trillions of cycles). Slightly stale is fine — no polling.
 * Only fetches when authenticated and online.
 */
export function useCycleBalance(isAuthenticated: boolean): CycleBalanceState {
  const isOnline = useOnlineStatus();
  const [state, setState] = useState<CycleBalanceState>({
    cycleBalance: null,
    cycleError: false,
  });

  useEffect(() => {
    if (!isAuthenticated || !isOnline) return;

    let cancelled = false;

    const fetchBalance = async () => {
      try {
        const config = await loadConfig();
        const canisterId = config.backend_canister_id;
        if (!canisterId) {
          if (!cancelled) setState({ cycleBalance: null, cycleError: true });
          return;
        }

        const url = `https://ic-api.internetcomputer.org/api/v3/canisters/${canisterId}`;
        const response = await fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          if (!cancelled) setState({ cycleBalance: null, cycleError: true });
          return;
        }

        const data = await response.json();
        // The API returns cycles as a large integer; convert to TC (trillions)
        const rawCycles =
          typeof data.cycles === "number"
            ? data.cycles
            : typeof data.cycles === "string"
              ? Number(data.cycles)
              : null;

        if (rawCycles === null || Number.isNaN(rawCycles)) {
          if (!cancelled) setState({ cycleBalance: null, cycleError: true });
          return;
        }

        const tc = rawCycles / 1e12;
        if (!cancelled) setState({ cycleBalance: tc, cycleError: false });
      } catch {
        if (!cancelled) setState({ cycleBalance: null, cycleError: true });
      }
    };

    void fetchBalance();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isOnline]);

  return state;
}
