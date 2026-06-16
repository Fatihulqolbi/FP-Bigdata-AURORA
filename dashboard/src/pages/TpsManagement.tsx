import { useState, useEffect, useRef, useCallback } from "react";
import { tps as tpsApi, analytics as analyticsApi } from "../features/marketplace/api/marketplaceApi";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Activity, MapPin, Plus, Trash2, Camera, X, Edit, Map as MapIcon, List, CheckCircle, AlertTriangle } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface TpsRecord {
  id: string;
  code: string;
  name: string;
  kecamatan: string;
  kelurahan?: string;
  lat: number;
  lng: number;
  capacityKg: number;
  fillThreshold: number;
  currentVolume: number;
  status: string;
  type: string;
  needsReview: boolean;
  confidence: number;
  rawAddress?: string;
  images: string[];
}

type ViewMode = "list" | "map";
type FilterStatus = "all" | "AKTIF" | "WASPADA" | "PENUH" | "NONAKTIF";
type FilterType = "all" | "TPS_BIASA" | "COMPACTOR";
type FilterReview = "all" | "review" | "verified";

function kgToTon(kg: number): string {
  return (kg / 1000).toFixed(2);
}

export default function TpsManagement() {
  const { user, hasPermission } = useAuth();
  const [records, setRecords] = useState<TpsRecord[]>([]);
  const [filtered, setFiltered] = useState<TpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<TpsRecord | null>(null);
  const [editing, setEditing] = useState<TpsRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<TpsRecord | null>(null);

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [reviewFilter, setReviewFilter] = useState<FilterReview>("all");

  const [wasteTypes, setWasteTypes] = useState<{ waste_type: string; percentage: number; approx_kg: number }[]>([]);
  const [byKecamatan, setByKecamatan] = useState<{ kecamatan: string; count: number; current_kg: number; capacity_kg: number }[]>([]);

  const [form, setForm] = useState({
    code: "",
    name: "",
    kecamatan: "",
    kelurahan: "",
    lat: -7.2504,
    lng: 112.7688,
    capacityKg: 3500,
    fillThreshold: 0.9,
    currentVolume: 0,
    status: "AKTIF",
    type: "TPS_BIASA",
    images: [] as string[],
  });

  const [verifyForm, setVerifyForm] = useState({
    status: "AKTIF",
    lat: -7.2504,
    lng: 112.7688,
    capacityKg: 3500,
  });

  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tpsApi.list({ limit: "300" });
      setRecords(res.tps || []);
    } catch {
      toast.error("Gagal memuat data TPS.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    async function load() {
      try {
        const [summary, waste] = await Promise.all([
          analyticsApi.tpsSummary(),
          analyticsApi.wasteTypes(),
        ]);
        if (waste?.data) setWasteTypes(waste.data);
        if (summary?.by_kecamatan) setByKecamatan(summary.by_kecamatan);
      } catch {
        // analytics engine unavailable, use fallback data from records
      }
    }
    load();
  }, [records]);

  useEffect(() => {
    let data = [...records];
    if (statusFilter !== "all") data = data.filter((r) => r.status === statusFilter);
    if (typeFilter !== "all") data = data.filter((r) => r.type === typeFilter);
    if (reviewFilter === "review") data = data.filter((r) => r.needsReview);
    if (reviewFilter === "verified") data = data.filter((r) => !r.needsReview);
    setFiltered(data);
  }, [records, statusFilter, typeFilter, reviewFilter]);

  useEffect(() => {
    if (viewMode !== "map" || !mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://tiles.openfreemap.org/styles/bright",
      center: [112.7688, -7.2504],
      zoom: 11,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const map = mapRef.current;

    filtered.forEach((r) => {
      const el = document.createElement("div");
      const size = r.type === "COMPACTOR" ? 22 : 16;
      let color = "#10b981"; // green
      if (r.needsReview) color = "#6b7280"; // gray
      else if (r.status === "PENUH") color = "#ef4444"; // red
      else if (r.status === "WASPADA") color = "#f59e0b"; // yellow
      else if (r.status === "NONAKTIF") color = "#3b82f6"; // blue

      el.style.cssText = `width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2px solid white;box-shadow:0 0 8px ${color};cursor:pointer;`;
      const marker = new maplibregl.Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map);
      el.title = `${r.name} (${r.status})`;
      el.onclick = () => setSelected(r);
      markersRef.current.push(marker);
    });

    const bounds = new maplibregl.LngLatBounds();
    filtered.forEach((r) => { if (r.lat && r.lng) bounds.extend([r.lng, r.lat]); });
    if (filtered.length > 0) map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
  }, [filtered, viewMode]);

  function openCreate() {
    setForm({ code: "", name: "", kecamatan: "", kelurahan: "", lat: -7.2504, lng: 112.7688, capacityKg: 3500, fillThreshold: 0.9, currentVolume: 0, status: "AKTIF", type: "TPS_BIASA", images: [] });
    setCreating(true);
    setEditing(null);
  }

  function openEdit(r: TpsRecord) {
    setForm({
      code: r.code, name: r.name, kecamatan: r.kecamatan, kelurahan: r.kelurahan || "",
      lat: r.lat, lng: r.lng, capacityKg: r.capacityKg, fillThreshold: r.fillThreshold,
      currentVolume: r.currentVolume, status: r.status, type: r.type, images: [...r.images]
    });
    setEditing(r);
    setCreating(false);
  }

  function openVerify(r: TpsRecord) {
    setVerifyForm({ status: r.status === "NONAKTIF" ? "NONAKTIF" : "AKTIF", lat: r.lat, lng: r.lng, capacityKg: r.capacityKg });
    setVerifying(r);
  }

  async function handleSave() {
    if (!form.code || !form.name || !form.kecamatan) {
      toast.error("Kode, nama, dan kecamatan wajib diisi.");
      return;
    }
    try {
      if (editing) {
        await tpsApi.update(editing.id, form);
        toast.success("TPS diperbarui.");
      } else {
        await tpsApi.create(form);
        toast.success("TPS baru ditambahkan.");
      }
      setCreating(false);
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan.");
    }
  }

  async function handleVerify() {
    if (!verifying) return;
    try {
      await tpsApi.verify(verifying.id, verifyForm);
      toast.success("TPS terverifikasi.");
      setVerifying(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal verifikasi.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await tpsApi.delete(id);
      toast.success("TPS dihapus.");
      setDeleting(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus.");
    }
  }

  async function handleVolumeUpdate(id: string, vol: number) {
    try {
      await tpsApi.updateVolume(id, vol);
      toast.success("Volume diperbarui.");
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm({ ...form, images: [...form.images, reader.result as string] });
    };
    reader.readAsDataURL(file);
  }

  function removeImage(idx: number) {
    setForm({ ...form, images: form.images.filter((_, i) => i !== idx) });
  }

  const canManage = hasPermission("MANAGE_TPS");
  const isAdmin = user?.role === "ADMIN";

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <MapPin size={22} /> Manajemen TPS Surabaya
        </h2>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as FilterReview)} style={selectStyle}>
            <option value="all">Semua Data</option>
            <option value="review">Butuh Review</option>
            <option value="verified">Terverifikasi</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FilterStatus)} style={selectStyle}>
            <option value="all">Semua Status</option>
            <option value="AKTIF">Aktif</option>
            <option value="WASPADA">Waspada</option>
            <option value="PENUH">Penuh</option>
            <option value="NONAKTIF">Nonaktif</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as FilterType)} style={selectStyle}>
            <option value="all">Semua Tipe</option>
            <option value="TPS_BIASA">TPS Biasa</option>
            <option value="COMPACTOR">Compactor</option>
          </select>
          <button onClick={() => setViewMode(v => v === "list" ? "map" : "list")} style={btnSecondary}>
            {viewMode === "list" ? <><MapIcon size={14} /> Peta</> : <><List size={14} /> Daftar</>}
          </button>
          {canManage && (
            <button onClick={openCreate} style={btnPrimary}>
              <Plus size={14} /> Tambah TPS
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Total TPS</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>{records.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Butuh Review</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#f59e0b" }}>{records.filter(r => r.needsReview).length}</div>
        </div>
        <div className="glass-panel" style={{ padding: "12px", textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Penuh / Waspada</div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: "#ef4444" }}>{records.filter(r => r.status === "PENUH" || r.status === "WASPADA").length}</div>
        </div>
      </div>

      {/* Monitoring Overview */}
      <div className="glass-panel" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ fontSize: "16px", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} color="#10b981" /> Monitoring Real-time
          </h3>
          <span style={{ padding: "4px 10px", borderRadius: "12px", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 2s infinite" }}></span>
            Simulasi aktif (60s)
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>TPS Aktif / Terverifikasi</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {records.filter(r => !r.needsReview && r.status !== "NONAKTIF").length}
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 400 }}> / {records.length}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Total Kapasitas TPS</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {(records.reduce((sum, r) => sum + r.capacityKg, 0) / 1000).toFixed(1)} <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>ton</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Volume Terisi Saat Ini</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {(records.reduce((sum, r) => sum + r.currentVolume, 0) / 1000).toFixed(1)} <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>ton</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Rata-rata Isi</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>
              {records.length > 0 ? (records.reduce((sum, r) => sum + (r.capacityKg > 0 ? r.currentVolume / r.capacityKg : 0), 0) / records.length * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>Komposisi Jenis Sampah (estimasi)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {wasteTypes.length > 0 ? wasteTypes.map((w) => (
                <div key={w.waste_type} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                  <span style={{ width: "80px", color: "var(--text-secondary)" }}>{w.waste_type}</span>
                  <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                    <div style={{ width: `${w.percentage}%`, height: "100%", borderRadius: "3px",
                      background: w.waste_type === "ORGANIK" ? "#10b981" : w.waste_type === "PLASTIK_PET" ? "#3b82f6" : w.waste_type === "KERTAS" ? "#f59e0b" : w.waste_type === "LOGAM" ? "#8b5cf6" : "#ef4444" }} />
                  </div>
                  <span style={{ width: "35px", textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>{w.percentage}%</span>
                </div>
              )) : <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Menunggu data analitik...</div>}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>Volume per Kecamatan (top)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {byKecamatan.length > 0 ? byKecamatan.slice(0, 5).map((k) => (
                <div key={k.kecamatan} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                  <span style={{ width: "100px", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.kecamatan}</span>
                  <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px" }}>
                    <div style={{ width: `${byKecamatan.length > 0 ? Math.min(100, (k.current_kg / Math.max(...byKecamatan.map(x => x.current_kg))) * 100) : 0}%`, height: "100%", borderRadius: "3px", background: "#3b82f6" }} />
                  </div>
                  <span style={{ width: "60px", textAlign: "right", color: "var(--text-primary)", fontWeight: 600 }}>{(k.current_kg / 1000).toFixed(1)} ton</span>
                </div>
              )) : <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Menunggu data analitik...</div>}
            </div>
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>
          Data estimasi dari simulasi real-time. Komposisi exact tersedia setelah pipeline Kafka + Spark + HDFS aktif.
        </p>
      </div>

      {/* Modal Form */}
      {(creating || editing) && (
        <div style={modalOverlay}>
          <div className="glass-panel" style={{ padding: "24px", maxWidth: "560px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: "0 0 16px 0" }}>
              {editing ? "Edit TPS" : "Tambah TPS Baru"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="Kode (contoh: TPS-BEN-001)" style={inp} />
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nama TPS" style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input value={form.kecamatan} onChange={e => setForm({ ...form, kecamatan: e.target.value })} placeholder="Kecamatan" style={inp} />
                <input value={form.kelurahan} onChange={e => setForm({ ...form, kelurahan: e.target.value })} placeholder="Kelurahan (opsional)" style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input type="number" value={form.lat} step="any" onChange={e => setForm({ ...form, lat: parseFloat(e.target.value) || 0 })} placeholder="Latitude" style={inp} />
                <input type="number" value={form.lng} step="any" onChange={e => setForm({ ...form, lng: parseFloat(e.target.value) || 0 })} placeholder="Longitude" style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <input type="number" value={form.capacityKg} onChange={e => setForm({ ...form, capacityKg: parseFloat(e.target.value) || 0 })} placeholder="Kapasitas (kg)" style={inp} />
                <input type="number" value={form.currentVolume} onChange={e => setForm({ ...form, currentVolume: parseFloat(e.target.value) || 0 })} placeholder="Volume saat ini (kg)" style={inp} />
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp}>
                  <option value="AKTIF">Aktif</option>
                  <option value="WASPADA">Waspada</option>
                  <option value="PENUH">Penuh</option>
                  <option value="NONAKTIF">Nonaktif</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={inp}>
                  <option value="TPS_BIASA">TPS Biasa</option>
                  <option value="COMPACTOR">Compactor</option>
                </select>
                <input type="number" value={form.fillThreshold} step="0.05" min="0" max="1" onChange={e => setForm({ ...form, fillThreshold: parseFloat(e.target.value) || 0.9 })} placeholder="Threshold penuh" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Gambar TPS</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                  {form.images.map((img, i) => (
                    <div key={i} style={{ position: "relative", width: "70px", height: "50px" }}>
                      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }} />
                      <button onClick={() => removeImage(i)} style={imgRemoveBtn}><X size={10} /></button>
                    </div>
                  ))}
                  <label style={{ width: "70px", height: "50px", border: "2px dashed var(--glass-border)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                    <Camera size={18} />
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button onClick={handleSave} style={{ flex: 1, ...btnPrimary }}>{editing ? "Simpan Perubahan" : "Tambah TPS"}</button>
                <button onClick={() => { setCreating(false); setEditing(null); }} style={btnSecondary}>Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verify Modal */}
      {verifying && (
        <div style={modalOverlay}>
          <div className="glass-panel" style={{ padding: "24px", maxWidth: "460px", width: "100%" }}>
            <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: "0 0 8px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle size={20} color="#10b981" /> Verifikasi TPS
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px" }}>
              {verifying.name} — {verifying.kecamatan}{verifying.kelurahan ? `, ${verifying.kelurahan}` : ""}
            </p>
            {verifying.needsReview && (
              <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontSize: "12px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={14} /> Data ini membutuhkan verifikasi lokasi.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input type="number" step="any" value={verifyForm.lat} onChange={e => setVerifyForm({ ...verifyForm, lat: parseFloat(e.target.value) || 0 })} placeholder="Latitude" style={inp} />
                <input type="number" step="any" value={verifyForm.lng} onChange={e => setVerifyForm({ ...verifyForm, lng: parseFloat(e.target.value) || 0 })} placeholder="Longitude" style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <input type="number" value={verifyForm.capacityKg} onChange={e => setVerifyForm({ ...verifyForm, capacityKg: parseFloat(e.target.value) || 0 })} placeholder="Kapasitas (kg)" style={inp} />
                <select value={verifyForm.status} onChange={e => setVerifyForm({ ...verifyForm, status: e.target.value })} style={inp}>
                  <option value="AKTIF">Aktif</option>
                  <option value="NONAKTIF">Nonaktif</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button onClick={handleVerify} style={{ flex: 1, ...btnPrimary }}>Verifikasi</button>
                <button onClick={() => setVerifying(null)} style={btnSecondary}>Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div style={modalOverlay}>
          <div className="glass-panel" style={{ padding: "24px", textAlign: "center", maxWidth: "360px" }}>
            <Trash2 size={36} color="#ef4444" style={{ marginBottom: "12px" }} />
            <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 8px" }}>Hapus TPS ini?</p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px" }}>Tindakan ini tidak dapat dibatalkan.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => handleDelete(deleting)} style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", fontWeight: 700, cursor: "pointer" }}>Hapus</button>
              <button onClick={() => setDeleting(null)} style={btnSecondary}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* TPS Detail Slide-in */}
      {selected && (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                {selected.name}
                {selected.needsReview && <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "10px", background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>BUTUH REVIEW</span>}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0" }}>{selected.kecamatan}{selected.kelurahan ? `, ${selected.kelurahan}` : ""} | Kode: {selected.code} | {selected.type === "COMPACTOR" ? "Compactor" : "TPS Biasa"}</p>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
            <div className="glass-panel" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Kapasitas</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{kgToTon(selected.capacityKg)} ton</div>
            </div>
            <div className="glass-panel" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Volume Saat Ini</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: selected.currentVolume >= selected.capacityKg * 0.8 ? "#ef4444" : selected.currentVolume >= selected.capacityKg * 0.5 ? "#f59e0b" : "var(--accent-green)" }}>
                {kgToTon(selected.currentVolume)} ton
              </div>
              <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", marginTop: "6px" }}>
                <div style={{ width: `${Math.min(100, (selected.currentVolume / selected.capacityKg) * 100)}%`, height: "100%", borderRadius: "2px",
                  background: selected.currentVolume >= selected.capacityKg * 0.8 ? "#ef4444" : selected.currentVolume >= selected.capacityKg * 0.5 ? "#f59e0b" : "#10b981" }} />
              </div>
            </div>
            <div className="glass-panel" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Status</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: selected.status === "AKTIF" ? "#10b981" : selected.status === "PENUH" || selected.status === "WASPADA" ? "#ef4444" : "var(--text-secondary)" }}>
                {selected.status}
              </div>
            </div>
          </div>
          {selected.rawAddress && (
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}><strong>Alamat asli:</strong> {selected.rawAddress}</p>
          )}
          {selected.images.length > 0 && (
            <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
              {selected.images.map((img, i) => (
                <img key={i} src={img} alt={`${selected.name} ${i + 1}`} style={{ width: "120px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--glass-border)" }} />
              ))}
            </div>
          )}
          {canManage && (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
              {isAdmin && selected.needsReview && (
                <button onClick={() => { setSelected(null); openVerify(selected); }}
                  style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#10b981", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                  <CheckCircle size={13} /> Verifikasi
                </button>
              )}
              <button onClick={() => { setSelected(null); openEdit(selected); }}
                style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <Edit size={13} /> Edit
              </button>
              <button onClick={() => setDeleting(selected.id)}
                style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <Trash2 size={13} /> Hapus
              </button>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        loading ? <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Memuat data TPS...</div> :
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: "12px" }}>
                <th style={th}>Kode</th>
                <th style={{ ...th, textAlign: "left" }}>Nama</th>
                <th style={th}>Kecamatan</th>
                <th style={th}>Tipe</th>
                <th style={th}>Kapasitas</th>
                <th style={th}>Volume</th>
                <th style={th}>Status</th>
                {canManage && <th style={th}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => setSelected(r)}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "background 0.2s", opacity: r.needsReview ? 0.8 : 1 }}>
                  <td style={td}>{r.code}</td>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600, color: "var(--text-primary)" }}>
                    {r.name}
                    {r.needsReview && <span style={{ marginLeft: "6px", padding: "1px 6px", borderRadius: "8px", fontSize: "9px", background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>REVIEW</span>}
                  </td>
                  <td style={td}>{r.kecamatan}</td>
                  <td style={td}>{r.type === "COMPACTOR" ? "Compactor" : "TPS Biasa"}</td>
                  <td style={td}>{kgToTon(r.capacityKg)} ton</td>
                  <td style={td}>
                    <span style={{ color: r.currentVolume >= r.capacityKg * 0.8 ? "#ef4444" : r.currentVolume >= r.capacityKg * 0.5 ? "#f59e0b" : "var(--text-primary)", fontWeight: 700 }}>
                      {kgToTon(r.currentVolume)}
                    </span> / {kgToTon(r.capacityKg)} ton
                    <div style={{ width: "60px", height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "1.5px", marginTop: "3px" }}>
                      <div style={{ width: `${Math.min(100, (r.currentVolume / r.capacityKg) * 100)}%`, height: "100%", borderRadius: "1.5px",
                        background: r.currentVolume >= r.capacityKg * 0.8 ? "#ef4444" : r.currentVolume >= r.capacityKg * 0.5 ? "#f59e0b" : "#10b981" }} />
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px",
                      background: r.status === "AKTIF" ? "rgba(16,185,129,0.15)" : r.status === "PENUH" || r.status === "WASPADA" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                      color: r.status === "AKTIF" ? "#10b981" : r.status === "PENUH" || r.status === "WASPADA" ? "#ef4444" : "var(--text-secondary)" }}>
                      {r.status}
                    </span>
                  </td>
                  {canManage && (
                    <td style={td}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <input type="number" defaultValue={r.currentVolume} min={0}
                          style={{ width: "50px", padding: "4px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "11px", textAlign: "center" }}
                          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) handleVolumeUpdate(r.id, v); }}
                          onKeyDown={e => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v) && v >= 0) handleVolumeUpdate(r.id, v); } }}
                        />
                        {isAdmin && r.needsReview && (
                          <button onClick={e => { e.stopPropagation(); openVerify(r); }} style={{ padding: "4px 8px", borderRadius: "4px", border: "none", background: "rgba(16,185,129,0.15)", color: "#10b981", cursor: "pointer", fontSize: "11px" }}>
                            <CheckCircle size={12} />
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); openEdit(r); }} style={{ padding: "4px 8px", borderRadius: "4px", border: "none", background: "rgba(59,130,246,0.15)", color: "#3b82f6", cursor: "pointer", fontSize: "11px" }}>
                          <Edit size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              <MapPin size={40} style={{ opacity: 0.3, marginBottom: "8px" }} />
              <p style={{ fontSize: "14px", margin: 0 }}>Tidak ada data TPS yang cocok dengan filter.</p>
            </div>
          )}
        </div>
      )}

      {/* Map View */}
      {viewMode === "map" && (
        <div ref={mapContainerRef} style={{ height: "520px", borderRadius: "12px", border: "1px solid var(--glass-border)", overflow: "hidden" }} />
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 8px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary)" };
const inp: React.CSSProperties = {
  width: "100%", padding: "9px", borderRadius: "6px",
  background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
  color: "var(--text-primary)", fontSize: "13px", outline: "none",
};
const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "none",
  background: "var(--accent-green)", color: "var(--bg-dark)",
  fontWeight: 700, fontSize: "13px", cursor: "pointer",
  display: "flex", alignItems: "center", gap: "6px",
};
const btnSecondary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--glass-border)",
  background: "transparent", color: "var(--text-secondary)", fontWeight: 600,
  fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
};
const selectStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--glass-border)",
  background: "rgba(255,255,255,0.05)", color: "var(--text-primary)", fontSize: "13px",
  cursor: "pointer",
};
const modalOverlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1000,
  background: "rgba(0,0,0,0.7)", display: "flex",
  alignItems: "center", justifyContent: "center", padding: "20px",
};
const imgRemoveBtn: React.CSSProperties = {
  position: "absolute", top: "-4px", right: "-4px", width: "18px", height: "18px",
  borderRadius: "50%", border: "none", background: "#ef4444", color: "white",
  cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center",
};
