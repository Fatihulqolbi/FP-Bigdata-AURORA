import { useEffect, useRef, useState, useCallback } from "react";
import type { FleetUpdate, TruckData, TpsData, FacilityData } from "../api/fleetApi";

const SSE_URL = "http://localhost:4000/api/fleet/live";

interface FleetStreamState {
  trucks: TruckData[];
  tps: TpsData[];
  facilities: FacilityData[];
  criticalTps: { id: string; code: string; name: string; fill: string }[];
  lastUpdate: string | null;
  connected: boolean;
}

export function useFleetStream() {
  const [state, setState] = useState<FleetStreamState>({
    trucks: [],
    tps: [],
    facilities: [],
    criticalTps: [],
    lastUpdate: null,
    connected: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(SSE_URL);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    es.onmessage = (event) => {
      try {
        const data: FleetUpdate = JSON.parse(event.data);

        if (data.type === "init") {
          setState((prev) => ({
            ...prev,
            trucks: data.trucks || [],
            tps: data.tps || [],
            facilities: data.facilities || [],
            connected: true,
          }));
        } else if (data.type === "tick") {
          setState((prev) => {
            const truckMap = new Map(prev.trucks.map((t) => [t.id, t]));
            if (data.trucks) {
              for (const t of data.trucks) {
                truckMap.set(t.id, t);
              }
            }
            return {
              ...prev,
              trucks: Array.from(truckMap.values()),
              criticalTps: data.criticalTps || prev.criticalTps,
              lastUpdate: data.timestamp,
            };
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState((prev) => ({ ...prev, connected: false }));
      es.close();
      // Auto-reconnect after 3s
      setTimeout(() => {
        if (eventSourceRef.current === es) {
          const newEs = new EventSource(SSE_URL);
          eventSourceRef.current = newEs;
          newEs.onopen = es.onopen;
          newEs.onmessage = es.onmessage;
          newEs.onerror = es.onerror;
        }
      }, 3000);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return state;
}
