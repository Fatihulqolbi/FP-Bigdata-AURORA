import type { MatchGroup } from "../types";
import { CheckCircle, Star, Truck } from "lucide-react";

interface Props {
  group: MatchGroup;
  rank: number;
  instantEligible: boolean;
  onCreateOrder: () => void;
}

export default function MatchSuggestionCard({ group, rank, instantEligible, onCreateOrder }: Props) {
  const isMultiSeller = group.candidates.length > 1;
  const fulfillmentPercent = Math.round((group.totalQuantity / (group.totalQuantity || 1)) * 100);

  return (
    <div
      className="glass-panel"
      style={{
        padding: "16px",
        border: instantEligible && rank === 1 ? "1px solid rgba(34,197,94,0.4)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "24px", height: "24px", borderRadius: "50%",
              background: rank === 1 ? "var(--accent-green)" : "var(--glass-border)",
              color: "var(--bg-dark)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: 700,
            }}
          >
            {rank}
          </span>
          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary)" }}>
            Skor: {(group.score * 100).toFixed(0)}%
          </span>
          {isMultiSeller && (
            <span style={{ fontSize: "11px", background: "rgba(245,158,11,0.2)", color: "#f59e0b", padding: "2px 6px", borderRadius: "8px" }}>
              Multi-seller
            </span>
          )}
        </div>
        {instantEligible && rank === 1 && (
          <CheckCircle size={18} color="#22c55e" />
        )}
      </div>

      {group.candidates.map((c: MatchGroup["candidates"][0], i: number) => (
        <div
          key={c.listingId}
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 0", borderBottom: i < group.candidates.length - 1 ? "1px solid var(--glass-border)" : "none",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>{c.title}</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <span>{c.sellerName}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "1px" }}>
                <Star size={10} fill="#f59e0b" color="#f59e0b" /> {c.sellerRating.toFixed(1)}
              </span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "13px", color: "var(--accent-green)", fontWeight: 700 }}>
              {c.availableQuantity.toLocaleString()} kg
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              Rp {c.pricePerKg.toLocaleString("id-ID")}/kg | {c.distanceKm.toFixed(1)} km
            </div>
          </div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid var(--glass-border)" }}>
        <div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Total: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{group.totalQuantity.toLocaleString()} kg</span>
            {" | "}
            <span style={{ color: "var(--accent-green)", fontWeight: 600 }}>Rp {group.totalCost.toLocaleString("id-ID")}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            ~{group.avgDistance.toFixed(1)} km | {fulfillmentPercent}% terpenuhi
          </div>
        </div>
        {instantEligible && rank === 1 && (
          <button
            onClick={onCreateOrder}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent-green)",
              color: "var(--bg-dark)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Truck size={16} /> Order Instan
          </button>
        )}
      </div>
    </div>
  );
}
