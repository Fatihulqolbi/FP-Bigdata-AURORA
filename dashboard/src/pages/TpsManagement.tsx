import { useState, useEffect, useRef, useCallback } from "react";
import { tps as tpsApi } from "../features/marketplace/api/marketplaceApi";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Camera, X, Edit, Map as MapIcon, List } from "lucide-react";
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
  capacity: number;
  currentVolume: number;
  status: string;
  images: string[];
}

type ViewMode = "list" | "map";

export default function TpsManagement() {
  const { hasPermission } = useAuth();
  const [records, setRecords] = useState<TpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<TpsRecord | null>(null);
  const [editing, setEditing] = useState<TpsRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    kecamatan: "",
    kelurahan: "",
    lat: -7.2504,
    lng: 112.7688,
    capacity: 50,
    currentVolume: 0,
    status: "AKTIF",
    images: [] as string[],
  });

  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tpsApi.list({ limit: "200" });
      setRecords(res.tps || []);
    } catch {
      toast.error("Gagal memuat data TPS.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Initialize map
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

  // Update markers when records change in map mode
  useEffect(() => {
    if (viewMode !== "map" || !mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const map = mapRef.current;
    records.forEach((r) => {
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;background:#10b981;border-radius:50%;border:2px solid white;box-shadow:0 0 6px #10b981;cursor:pointer;";
      const marker = new maplibregl.Marker({ element: el }).setLngLat([r.lng, r.lat]).addTo(map);
      el.title = r.name;
      el.onclick = () => setSelected(r);
      if (r.currentVolume >= r.capacity * 0.8) {
        el.style.background = "#ef4444";
        el.style.boxShadow = "0 0 10px #ef4444";
      } else if (r.currentVolume >= r.capacity * 0.5) {
        el.style.background = "#f59e0b";
        el.style.boxShadow = "0 0 8px #f59e0b";
      }
      markersRef.current.push(marker);
    });
    const bounds = new maplibregl.LngLatBounds();
    records.forEach(r => bounds.extend([r.lng, r.lat]));
    if (records.length > 0) map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
  }, [records, viewMode]);

  function openCreate() {
    setForm({ code: "", name: "", kecamatan: "", kelurahan: "", lat: -7.2504, lng: 112.7688, capacity: 50, currentVolume: 0, status: "AKTIF", images: [] });
    setCreating(true);
    setEditing(null);
  }

  function openEdit(r: TpsRecord) {
    setForm({ code: r.code, name: r.name, kecamatan: r.kecamatan, kelurahan: r.kelurahan || "", lat: r.lat, lng: r.lng, capacity: r.capacity, currentVolume: r.currentVolume, status: r.status, images: [...r.images] });
    setEditing(r);
    setCreating(false);
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

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
          <MapPin size={22} /> Manajemen TPS Surabaya
        </h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setViewMode(v => v === "list" ? "map" : "list")}
            style={{
              padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--glass-border)",
              background: "transparent", color: "var(--text-primary)", cursor: "pointer",
              fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
            }}>
            {viewMode === "list" ? <><MapIcon size={14} /> Peta</> : <><List size={14} /> Daftar</>}
          </button>
          {canManage && (
            <button onClick={openCreate}
              style={{
                padding: "8px 16px", borderRadius: "8px", border: "none",
                background: "var(--accent-green)", color: "var(--bg-dark)",
                fontWeight: 700, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
              <Plus size={14} /> Tambah TPS
            </button>
          )}
        </div>
      </div>

      {/* Modal Form */}
      {(creating || editing) && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: "20px",
        }}>
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
                <input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: parseFloat(e.target.value) || 0 })} placeholder="Kapasitas (ton)" style={inp} />
                <input type="number" value={form.currentVolume} onChange={e => setForm({ ...form, currentVolume: parseFloat(e.target.value) || 0 })} placeholder="Volume saat ini" style={inp} />
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={inp}>
                  <option value="AKTIF">Aktif</option>
                  <option value="PENUH">Penuh</option>
                  <option value="NONAKTIF">Nonaktif</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Gambar TPS</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                  {form.images.map((img, i) => (
                    <div key={i} style={{ position: "relative", width: "70px", height: "50px" }}>
                      <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }} />
                      <button onClick={() => removeImage(i)}
                        style={{ position: "absolute", top: "-4px", right: "-4px", width: "18px", height: "18px", borderRadius: "50%", border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  <label style={{ width: "70px", height: "50px", border: "2px dashed var(--glass-border)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                    <Camera size={18} />
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <button onClick={handleSave}
                  style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "var(--accent-green)", color: "var(--bg-dark)", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
                  {editing ? "Simpan Perubahan" : "Tambah TPS"}
                </button>
                <button onClick={() => { setCreating(false); setEditing(null); }}
                  style={{ padding: "10px 16px", borderRadius: "8px", border: "1px solid var(--glass-border)", background: "transparent", color: "var(--text-secondary)", fontWeight: 600, fontSize: "14px", cursor: "pointer" }}>
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-panel" style={{ padding: "24px", textAlign: "center", maxWidth: "360px" }}>
            <Trash2 size={36} color="#ef4444" style={{ marginBottom: "12px" }} />
            <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 8px" }}>Hapus TPS ini?</p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px" }}>Tindakan ini tidak dapat dibatalkan.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button onClick={() => handleDelete(deleting)}
                style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "#ef4444", color: "white", fontWeight: 700, cursor: "pointer" }}>Hapus</button>
              <button onClick={() => setDeleting(null)}
                style={{ padding: "10px 24px", borderRadius: "8px", border: "1px solid var(--glass-border)", background: "transparent", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer" }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* TPS Detail Slide-in */}
      {selected && (
        <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h3 style={{ fontSize: "18px", color: "var(--text-primary)", margin: 0 }}>{selected.name}</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0" }}>{selected.kecamatan}{selected.kelurahan ? `, ${selected.kelurahan}` : ""} | Kode: {selected.code}</p>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
              <X size={20} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
            <div className="glass-panel" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Kapasitas</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{selected.capacity} ton</div>
            </div>
            <div className="glass-panel" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Volume Saat Ini</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: selected.currentVolume >= selected.capacity * 0.8 ? "#ef4444" : selected.currentVolume >= selected.capacity * 0.5 ? "#f59e0b" : "var(--accent-green)" }}>
                {selected.currentVolume} ton
              </div>
              <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", marginTop: "6px" }}>
                <div style={{ width: `${Math.min(100, (selected.currentVolume / selected.capacity) * 100)}%`, height: "100%", borderRadius: "2px",
                  background: selected.currentVolume >= selected.capacity * 0.8 ? "#ef4444" : selected.currentVolume >= selected.capacity * 0.5 ? "#f59e0b" : "#10b981" }} />
              </div>
            </div>
            <div className="glass-panel" style={{ padding: "12px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Status</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: selected.status === "AKTIF" ? "#10b981" : selected.status === "PENUH" ? "#ef4444" : "var(--text-secondary)" }}>
                {selected.status}
              </div>
            </div>
          </div>
          {selected.images.length > 0 && (
            <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
              {selected.images.map((img, i) => (
                <img key={i} src={img} alt={`${selected.name} ${i + 1}`}
                  style={{ width: "120px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--glass-border)" }} />
              ))}
            </div>
          )}
          {canManage && (
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
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
                <th style={th}>Kapasitas</th>
                <th style={th}>Volume</th>
                <th style={th}>Status</th>
                {canManage && <th style={th}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id} onClick={() => setSelected(r)}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "background 0.2s" }}>
                  <td style={td}>{r.code}</td>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</td>
                  <td style={td}>{r.kecamatan}</td>
                  <td style={td}>{r.capacity} ton</td>
                  <td style={td}>
                    <span style={{ color: r.currentVolume >= r.capacity * 0.8 ? "#ef4444" : r.currentVolume >= r.capacity * 0.5 ? "#f59e0b" : "var(--text-primary)", fontWeight: 700 }}>
                      {r.currentVolume}
                    </span> / {r.capacity} ton
                    <div style={{ width: "60px", height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "1.5px", marginTop: "3px" }}>
                      <div style={{ width: `${Math.min(100, (r.currentVolume / r.capacity) * 100)}%`, height: "100%", borderRadius: "1.5px",
                        background: r.currentVolume >= r.capacity * 0.8 ? "#ef4444" : r.currentVolume >= r.capacity * 0.5 ? "#f59e0b" : "#10b981" }} />
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "11px",
                      background: r.status === "AKTIF" ? "rgba(16,185,129,0.15)" : r.status === "PENUH" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)",
                      color: r.status === "AKTIF" ? "#10b981" : r.status === "PENUH" ? "#ef4444" : "var(--text-secondary)" }}>
                      {r.status}
                    </span>
                  </td>
                  {canManage && (
                    <td style={td}>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <input type="number" defaultValue={r.currentVolume} min={0} max={r.capacity}
                          style={{ width: "50px", padding: "4px", borderRadius: "4px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "11px", textAlign: "center" }}
                          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0 && v <= r.capacity) handleVolumeUpdate(r.id, v); }}
                          onKeyDown={e => { if (e.key === "Enter") { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v) && v >= 0 && v <= r.capacity) handleVolumeUpdate(r.id, v); } }}
                        />
                        <button onClick={e => { e.stopPropagation(); openEdit(r); }}
                          style={{ padding: "4px 8px", borderRadius: "4px", border: "none", background: "rgba(59,130,246,0.15)", color: "#3b82f6", cursor: "pointer", fontSize: "11px" }}>
                          <Edit size={12} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {records.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
              <MapPin size={40} style={{ opacity: 0.3, marginBottom: "8px" }} />
              <p style={{ fontSize: "14px", margin: 0 }}>Belum ada data TPS.</p>
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
