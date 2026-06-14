import React, { useState } from "react";
import { listings, auth } from "../api/marketplaceApi";
import type { MaterialCategory } from "../types";
import { Package, Plus, Trash2 } from "lucide-react";

export default function InventoryManage() {
  const [myListings, setMyListings] = useState<any[]>([]);
  const [materials, setMaterials] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    type: "MATERIAL" as const,
    categoryId: "",
    title: "",
    description: "",
    quantity: 100,
    pricePerKg: 2000,
    moq: 10,
    fulfillmentOptions: "BOTH" as const,
    lat: -7.25,
    lng: 112.76,
    grade: "",
  });

  React.useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [mats, listData] = await Promise.all([
        import("../api/marketplaceApi").then(m => m.materials.list()),
        import("../api/marketplaceApi").then(m => m.listings.list()),
      ]);
      setMaterials(mats as MaterialCategory[]);
      if (listData?.listings) {
        const me = await auth.getMe();
        setMyListings((listData.listings as any[]).filter((l: any) => l.sellerId === me.id));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setError("");
    setSuccess("");
    try {
      await listings.create(form);
      setSuccess("Listing berhasil dibuat!");
      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: string) {
    try {
      await listings.delete(id);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0 }}>Inventori Saya</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>Kelola listing material & produk</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: "10px 18px", borderRadius: "8px", border: "none",
            background: "var(--accent-green)", color: "var(--bg-dark)",
            fontWeight: 700, fontSize: "14px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          <Plus size={16} /> {showForm ? "Tutup" : "Buat Listing"}
        </button>
      </div>

      {success && (
        <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.15)", borderRadius: "8px", color: "var(--accent-green)", marginBottom: "16px", fontSize: "13px" }}>
          {success}
        </div>
      )}

      {showForm && (
        <div className="glass-panel" style={{ padding: "20px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", color: "var(--text-primary)", marginBottom: "16px" }}>Buat Listing Baru</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Tipe</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }}>
                <option value="MATERIAL">Material</option>
                <option value="PRODUCT">Produk</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Kategori</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }}>
                <option value="">Pilih kategori</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} (Rp {m.minPrice.toLocaleString("id-ID")} - Rp {m.maxPrice.toLocaleString("id-ID")})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Judul</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Kuantitas (kg)</label>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Harga/kg (Rp)</label>
              <input type="number" value={form.pricePerKg} onChange={(e) => setForm({ ...form, pricePerKg: Number(e.target.value) })} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>MOQ (kg)</label>
              <input type="number" value={form.moq} onChange={(e) => setForm({ ...form, moq: Number(e.target.value) })} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }} />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Logistik</label>
              <select value={form.fulfillmentOptions} onChange={(e) => setForm({ ...form, fulfillmentOptions: e.target.value as any })} style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }}>
                <option value="BOTH">Pickup & Delivery</option>
                <option value="PICKUP">Pickup</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Grade</label>
              <input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="Opsional" style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)", color: "var(--text-primary)", fontSize: "13px" }} />
            </div>
          </div>
          <div style={{ marginTop: "14px" }}>
            <button onClick={handleCreate} style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: "var(--accent-green)", color: "var(--bg-dark)", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
              Simpan Listing
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Memuat...</div>}
      {error && <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {myListings.map((listing: any) => (
          <div key={listing.id} className="glass-panel" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{listing.title}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {listing.quantity} kg | Rp {listing.pricePerKg.toLocaleString("id-ID")}/kg
                </div>
              </div>
              <button
                onClick={() => handleDelete(listing.id)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444" }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && myListings.length === 0 && !showForm && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <Package size={48} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: "16px", margin: "12px 0 8px" }}>Belum ada listing</p>
          <p style={{ fontSize: "13px", margin: 0 }}>Klik "Buat Listing" untuk mulai menjual.</p>
        </div>
      )}
    </div>
  );
}
