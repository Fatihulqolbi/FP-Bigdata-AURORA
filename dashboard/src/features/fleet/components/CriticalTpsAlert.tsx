import { AlertCircle } from "lucide-react";
import type { CriticalTps } from "../api/fleetApi";

interface CriticalTpsAlertProps {
  criticalTps: CriticalTps[];
  onDismiss?: (id: string) => void;
}

export default function CriticalTpsAlert({ criticalTps }: CriticalTpsAlertProps) {
  if (criticalTps.length === 0) {
    return null;
  }

  const critical = criticalTps.filter((t) => t.alertLevel === "CRITICAL");
  const warning = criticalTps.filter((t) => t.alertLevel === "WARNING");

  return (
    <div className="glass-panel" style={{ padding: "16px", marginBottom: "12px", borderLeft: "4px solid #ef4444" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <AlertCircle size={20} color="#ef4444" />
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#ef4444" }}>
          {critical.length > 0 ? "🔴 CRITICAL TPS ALERTS" : "⚠️ WARNING TPS"}
        </h3>
      </div>

      {critical.length > 0 && (
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#ef4444", marginBottom: "8px" }}>
            CRITICAL ({critical.length}):
          </div>
          {critical.slice(0, 5).map((t) => (
            <div
              key={t.id}
              style={{
                padding: "8px",
                marginBottom: "6px",
                background: "rgba(239,68,68,0.1)",
                borderLeft: "3px solid #ef4444",
                borderRadius: "4px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>
                {t.code} - {t.name}
              </div>
              <div style={{ fontSize: "11px", color: "#ccc", marginTop: "2px" }}>
                {t.kecamatan} | {t.fillPct.toFixed(0)}% penuh ({Math.round(t.currentVolume)} / {t.capacityKg} kg)
              </div>
            </div>
          ))}
          {critical.length > 5 && (
            <div style={{ fontSize: "11px", color: "#999", marginTop: "6px" }}>
              + {critical.length - 5} more critical TPS
            </div>
          )}
        </div>
      )}

      {warning.length > 0 && (
        <div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "#f59e0b", marginBottom: "8px" }}>
            WARNING ({warning.length}):
          </div>
          {warning.slice(0, 3).map((t) => (
            <div
              key={t.id}
              style={{
                padding: "6px 8px",
                marginBottom: "4px",
                background: "rgba(245,158,11,0.1)",
                borderLeft: "2px solid #f59e0b",
                borderRadius: "4px",
                fontSize: "11px",
                color: "#ccc",
              }}
            >
              {t.code} - {t.fillPct.toFixed(0)}%
            </div>
          ))}
          {warning.length > 3 && (
            <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
              + {warning.length - 3} more warnings
            </div>
          )}
        </div>
      )}
    </div>
  );
}
