import React from "react";
import type { OrderItem } from "../types";
import { Package } from "lucide-react";

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  PENDING_APPROVAL: { background: "rgba(245,158,11,0.2)", color: "#f59e0b" },
  APPROVED: { background: "rgba(59,130,246,0.2)", color: "#3b82f6" },
  AWAITING_PAYMENT: { background: "rgba(139,92,246,0.2)", color: "#8b5cf6" },
  PAID: { background: "rgba(34,197,94,0.2)", color: "#22c55e" },
  DELIVERED: { background: "rgba(34,197,94,0.2)", color: "#22c55e" },
  COMPLETED: { background: "rgba(34,197,94,0.3)", color: "#16a34a" },
  CANCELLED: { background: "rgba(239,68,68,0.2)", color: "#ef4444" },
};

interface Props {
  items: OrderItem[];
  compact?: boolean;
}

export default function OrderItemList({ items, compact }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {items.map((item) => {
        const statusStyle = STATUS_STYLES[item.status] || {};
        return (
          <div
            key={item.id}
            className="glass-panel"
            style={{
              padding: compact ? "8px 12px" : "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Package size={16} color="var(--text-secondary)" />
              <div>
                <div style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 }}>
                  {item.listing?.title || "Item"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {item.quantity.toLocaleString()} kg × Rp {item.pricePerKg.toLocaleString("id-ID")}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", color: "var(--accent-green)", fontWeight: 700 }}>
                Rp {item.subtotal.toLocaleString("id-ID")}
              </div>
              <span
                style={{
                  fontSize: "10px", padding: "1px 6px", borderRadius: "6px", ...statusStyle,
                }}
              >
                {(item.status || "pending").replace(/_/g, " ")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
