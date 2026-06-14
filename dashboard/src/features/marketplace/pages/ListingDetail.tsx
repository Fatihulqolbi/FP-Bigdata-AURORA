import React from "react";
import { useListing } from "../hooks/useListings";
import { orders } from "../api/marketplaceApi";
import { useAuth } from "../../../contexts/AuthContext";
import type { Listing } from "../types";
import PriceRangeBadge from "../components/PriceRangeBadge";
import { ArrowLeft, MapPin, User, Star, ShoppingCart } from "lucide-react";

interface Props {
  listingId: string;
  onBack: () => void;
  demoMode?: boolean;
}

export default function ListingDetail({ listingId, onBack, demoMode = false }: Props) {
  const { data: listing, isLoading } = useListing(listingId);
  const { user } = useAuth();
  const [quantity, setQuantity] = React.useState<number>(1);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  if (isLoading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>Memuat...</div>;
  if (!listing) return <div style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>Listing tidak ditemukan.</div>;

  const l = listing as Listing;
  const isAdmin = user?.role === "ADMIN";

  const handleBuy = async () => {
    setError("");
    setSuccess("");
    if (demoMode) {
      setSuccess("[Demo] Order simulasi berhasil! (tidak tersimpan)");
      return;
    }
    try {
      await orders.create({
        items: [
          {
            listingId: l.id,
            sellerId: l.sellerId,
            quantity,
            pricePerKg: l.pricePerKg,
          },
        ],
        logisticsOption: l.fulfillmentOptions === "DELIVERY" ? "DELIVERY" : "PICKUP",
      });
      setSuccess("Order berhasil dibuat! Cek dashboard pembeli.");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <button
        onClick={onBack}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "transparent", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: "14px", marginBottom: "16px",
        }}
      >
        <ArrowLeft size={18} /> Kembali ke etalase
      </button>

      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0 }}>{l.title}</h2>
              <span
                style={{
                  padding: "3px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                  background: l.type === "MATERIAL" ? "rgba(59,130,246,0.15)" : "rgba(168,85,247,0.15)",
                  color: l.type === "MATERIAL" ? "#3b82f6" : "#a855f7",
                }}
              >
                {l.type === "MATERIAL" ? "Material" : "Produk"}
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>{l.category.name}</p>
          </div>
          <PriceRangeBadge minPrice={l.category.minPrice} maxPrice={l.category.maxPrice} currentPrice={l.pricePerKg} />
        </div>

        {l.description && (
          <p style={{ fontSize: "14px", color: "var(--text-primary)", lineHeight: 1.6, marginBottom: "20px" }}>
            {l.description}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Stok</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{l.quantity.toLocaleString()} kg</div>
          </div>
          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Harga</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--accent-green)" }}>Rp {l.pricePerKg.toLocaleString("id-ID")}/kg</div>
          </div>
          <div className="glass-panel" style={{ padding: "14px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Min. Order</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{l.moq} kg</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "var(--text-secondary)" }}>
            <MapPin size={14} />
            {l.fulfillmentOptions === "BOTH" ? "Pickup & Delivery" : l.fulfillmentOptions === "PICKUP" ? "Pickup" : "Delivery"}
          </div>
          {l.grade && (
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Grade: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{l.grade}</span>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: "14px", marginBottom: "20px", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <User size={18} color="var(--text-secondary)" />
            <div>
              <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>{l.seller.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                <Star size={12} fill="#f59e0b" color="#f59e0b" /> {l.seller.sellerRating.toFixed(1)} rating
                {l.seller.contact && <span> | {l.seller.contact}</span>}
              </div>
            </div>
          </div>
        </div>

        {(isAdmin && !demoMode) ? (
          <div style={{ textAlign: "center", padding: "12px", color: "var(--text-secondary)", fontSize: "13px", borderTop: "1px solid var(--glass-border)", marginTop: "12px", paddingTop: "14px" }}>
            Aktifkan <strong>Mode Demo Buyer</strong> dari header untuk mencoba order.
          </div>
        ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Jumlah (kg):</span>
            <input
              type="number"
              min={l.moq}
              max={l.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.min(l.quantity, Math.max(l.moq, parseInt(e.target.value) || 0)))}
              style={{
                width: "80px", padding: "8px", borderRadius: "6px",
                background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
                color: "var(--text-primary)", fontSize: "14px", textAlign: "center",
              }}
            />
          </div>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            ≈ Rp {(quantity * l.pricePerKg).toLocaleString("id-ID")}
          </span>
          <button
            onClick={handleBuy}
            style={{
              padding: "10px 20px", borderRadius: "8px", border: "none",
              background: "var(--accent-green)", color: "var(--bg-dark)",
              fontWeight: 700, fontSize: "14px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <ShoppingCart size={16} /> {demoMode ? "Simulasi Order" : "Buat Order"}
          </button>
        </div>
        )}

        {error && <div style={{ marginTop: "12px", color: "#ef4444", fontSize: "13px" }}>{error}</div>}
        {success && <div style={{ marginTop: "12px", color: "var(--accent-green)", fontSize: "13px" }}>{success}</div>}
      </div>
    </div>
  );
}
