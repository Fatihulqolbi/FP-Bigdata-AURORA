import { useState, useEffect } from "react";
import { RefreshCw, Edit2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { facility } from "../api/fleetApi";
import type { FacilityData } from "../api/fleetApi";

export default function FacilityManagement() {
  const [facilities, setFacilities] = useState<FacilityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState<number | null>(null);

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const data = await facility.listFacilities();
      setFacilities(data.facilities);
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat fasilitas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFacilities();
    const interval = setInterval(loadFacilities, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateCapacity = async (id: string, newCapacity: number | null) => {
    try {
      await facility.updateCapacity(id, newCapacity);
      setFacilities((prev) =>
        prev.map((f) => (f.id === id ? { ...f, dailyCapacityKg: newCapacity } : f))
      );
      setEditingId(null);
      toast.success("Kapasitas harian diperbarui");
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui kapasitas");
    }
  };

  const handleResetIntake = async (id: string) => {
    try {
      await facility.resetIntake(id);
      setFacilities((prev) =>
        prev.map((f) => (f.id === id ? { ...f, dailyIntakeKg: 0, intakePct: 0 } : f))
      );
      toast.success("Intake harian direset");
    } catch (err: any) {
      toast.error(err.message || "Gagal mereset intake");
    }
  };

  const getAlertColor = (status: string) => {
    if (status === "CRITICAL") return "#ef4444";
    if (status === "WARNING") return "#f59e0b";
    return "#10b981";
  };

  const getAlertLabel = (status: string) => {
    if (status === "CRITICAL") return "🔴 CRITICAL";
    if (status === "WARNING") return "⚠️ WARNING";
    return "✅ NORMAL";
  };

  return (
    <div style={{ padding: "20px", animation: "fadeIn 0.4s ease" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>TPS3R & Facility Management</h2>
        <button
          onClick={loadFacilities}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "16px" }}>
        {facilities.map((f) => (
          <div
            key={f.id}
            className="glass-panel"
            style={{
              padding: "16px",
              borderLeft: `4px solid ${getAlertColor(f.alertStatus)}`,
              position: "relative",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: 600, color: "#fff" }}>
                  {f.name}
                </h3>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--text-secondary)" }}>
                  {f.code} • {f.type}
                </p>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  background: `${getAlertColor(f.alertStatus)}20`,
                  color: getAlertColor(f.alertStatus),
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                {getAlertLabel(f.alertStatus)}
              </span>
            </div>

            {/* Daily Capacity */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                Daily Capacity
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {editingId === f.id ? (
                  <>
                    <input
                      type="number"
                      value={editCapacity ?? ""}
                      onChange={(e) => setEditCapacity(e.target.value ? parseFloat(e.target.value) : null)}
                      style={{
                        flex: 1,
                        padding: "6px",
                        borderRadius: "4px",
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.05)",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      placeholder="kg (null = unlimited)"
                    />
                    <button
                      onClick={() => handleUpdateCapacity(f.id, editCapacity)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        background: "#10b981",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 600,
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "11px",
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, fontSize: "12px" }}>
                      {f.dailyCapacityKg ? `${Math.round(f.dailyCapacityKg / 1000)} ton/day` : "Unlimited"}
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(f.id);
                        setEditCapacity(f.dailyCapacityKg);
                      }}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                      }}
                    >
                      <Edit2 size={12} />
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Daily Intake Progress */}
            {f.dailyCapacityKg != null && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Daily Intake</span>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>
                    {f.intakePct?.toFixed(0)}% ({Math.round(f.dailyIntakeKg / 1000)} / {Math.round(f.dailyCapacityKg / 1000)} t)
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, f.intakePct ?? 0)}%`,
                      background: f.alertStatus === "CRITICAL" ? "#ef4444" : f.alertStatus === "WARNING" ? "#f59e0b" : "#10b981",
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Current Load */}
            <div style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Current Load</span>
                <span style={{ fontSize: "12px", fontWeight: 600 }}>
                  {f.loadPct?.toFixed(0)}% ({Math.round(f.currentLoadKg / 1000)} / {Math.round(f.capacityKg / 1000)} t)
                </span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, f.loadPct ?? 0)}%`,
                    background: "#3b82f6",
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            {f.dailyCapacityKg != null && (
              <button
                onClick={() => handleResetIntake(f.id)}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "12px",
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                }}
              >
                <RotateCcw size={12} />
                Reset Daily Intake
              </button>
            )}
          </div>
        ))}
      </div>

      {facilities.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
          <p>Tidak ada fasilitas ditemukan</p>
        </div>
      )}
    </div>
  );
}
