import React from "react";
import type { Listing } from "../types";
import { Package, MapPin, ShoppingCart, Star } from "lucide-react";

interface Props {
  listing: Listing;
  onView: () => void;
}

const TYPE_LABELS: Record<string, string> = { MATERIAL: "Material", PRODUCT: "Produk" };
const TYPE_COLORS: Record<string, React.CSSProperties> = {
  MATERIAL: { background: "rgba(59,130,246,0.15)", color: "#3b82f6" },
  PRODUCT: { background: "rgba(168,85,247,0.15)", color: "#a855f7" },
};

export default function ListingCard({ listing, onView }: Props) {
  const typeStyle = TYPE_COLORS[listing.type] || TYPE_COLORS.MATERIAL;
  const fulfillmentLabel =
    listing.fulfillmentOptions === "BOTH"
      ? "Pickup / Delivery"
      : listing.fulfillmentOptions === "PICKUP"
      ? "Pickup"
      : "Delivery";

  return (
    <div
      className="glass-panel"
      style={{ padding: "16px", cursor: "pointer", transition: "transform 0.2s" }}
      onClick={onView}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, ...typeStyle }}>
          {TYPE_LABELS[listing.type] || listing.type}
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          {listing.category.name}
        </span>
      </div>

      <h4 style={{ fontSize: "15px", color: "var(--text-primary)", margin: "0 0 6px", fontWeight: 600 }}>
        {listing.title}
      </h4>

      {listing.description && (
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.4 }}>
          {listing.description.length > 80 ? listing.description.slice(0, 80) + "..." : listing.description}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-secondary)" }}>
          <Package size={14} /> {listing.quantity.toLocaleString()} kg
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-secondary)" }}>
          <MapPin size={14} /> {fulfillmentLabel}
        </div>
        <div style={{ color: "var(--accent-green)", fontWeight: 700 }}>
          Rp {listing.pricePerKg.toLocaleString("id-ID")}/kg
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-secondary)" }}>
          MOQ: {listing.moq} kg
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--glass-border)", paddingTop: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-green)" }} />
          <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{listing.seller.name}</span>
          <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "2px" }}>
            <Star size={12} fill="#f59e0b" color="#f59e0b" /> {listing.seller.sellerRating.toFixed(1)}
          </span>
        </div>
        <ShoppingCart size={16} color="var(--accent-green)" />
      </div>
    </div>
  );
}
