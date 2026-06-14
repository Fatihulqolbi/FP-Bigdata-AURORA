import React, { useState } from "react";
import { demands, materials } from "../api/marketplaceApi";
import { useAuth } from "../../../contexts/AuthContext";
import type { MaterialCategory } from "../types";
import { Search } from "lucide-react";

interface Props {
  onDemandCreated?: (demandId: string) => void;
  demoMode?: boolean;
}

export default function DemandForm({ onDemandCreated, demoMode = false }: Props) {
  const { user } = useAuth();
  const [mats, setMats] = useState<MaterialCategory[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    categoryId: "",
    quantityNeeded: 400,
    maxPrice: 5000,
    preferredDistance: 50,
    lat: -7.335,
    lng: 112.755,
  });

  React.useEffect(() => {
    materials.list().then(setMats).catch(() => {});
  }, []);

  async function handleSubmit() {
    setError("");
    setSuccess("");
    if (demoMode) {
      setSuccess("[Demo] Demand simulasi berhasil dibuat! (tidak tersimpan)");
      const fakeId = "demo-" + Date.now();
      if (onDemandCreated) onDemandCreated(fakeId);
      return;
    }
    try {
      const result = await demands.create(form);
      setSuccess("Demand berhasil dibuat! Lihat saran match.");
      if (onDemandCreated && result?.id) onDemandCreated(result.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const isAdmin = user?.role === "ADMIN";
  if (isAdmin && !demoMode) {
    return (
      <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
        <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: "0 0 8px" }}>Cari Material</h2>
        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
          <Search size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
          <p style={{ fontSize: "15px", margin: "0 0 8px" }}>Halaman ini hanya untuk pembeli (Industri / Warga).</p>
          <p style={{ fontSize: "13px", margin: 0 }}>Aktifkan <strong>Mode Demo Buyer</strong> dari header untuk mencoba.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: "0 0 8px" }}>Cari Material</h2>
      <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 20px" }}>
        Buat permintaan kebutuhan material — sistem akan otomatis mencocokkan.
      </p>

      <div className="glass-panel" style={{ padding: "24px", maxWidth: "600px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Kategori Material</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              style={{
                width: "100%", padding: "10px", borderRadius: "8px",
                background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
                color: "var(--text-primary)", fontSize: "14px",
              }}
            >
              <option value="">Pilih kategori</option>
              {mats.filter(m => !m.isProduct).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Jumlah Dibutuhkan (kg)</label>
              <input type="number" value={form.quantityNeeded} onChange={(e) => setForm({ ...form, quantityNeeded: Number(e.target.value) })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "14px" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Harga Maks (Rp/kg)</label>
              <input type="number" value={form.maxPrice} onChange={(e) => setForm({ ...form, maxPrice: Number(e.target.value) })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "14px" }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Radius Pencarian (km)</label>
            <input type="number" value={form.preferredDistance} onChange={(e) => setForm({ ...form, preferredDistance: Number(e.target.value) })}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "14px" }} />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!form.categoryId}
            style={{
              padding: "12px", borderRadius: "8px", border: "none",
              background: form.categoryId ? "var(--accent-green)" : "var(--glass-border)",
              color: form.categoryId ? "var(--bg-dark)" : "var(--text-secondary)",
              fontWeight: 700, fontSize: "15px", cursor: form.categoryId ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            <Search size={18} /> Cari Match
          </button>

          {error && <div style={{ color: "#ef4444", fontSize: "13px" }}>{error}</div>}
          {success && <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.15)", borderRadius: "8px", color: "var(--accent-green)", fontSize: "13px" }}>{success}</div>}
        </div>
      </div>
    </div>
  );
}
