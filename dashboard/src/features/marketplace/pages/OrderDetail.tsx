import React from "react";
import { useOrder } from "../hooks/useOrders";
import { orders as orderApi } from "../api/marketplaceApi";
import OrderItemList from "../components/OrderItemList";
import type { Order } from "../types";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

interface Props {
  orderId: string;
  onBack: () => void;
}

const STATUS_FLOW = [
  "DRAFT", "PENDING_APPROVAL", "APPROVED", "AWAITING_PAYMENT",
  "PAID", "READY_FOR_PICKUP", "READY_FOR_DELIVERY",
  "IN_TRANSIT", "DELIVERED", "COMPLETED",
];

export default function OrderDetail({ orderId, onBack }: Props) {
  const { data: order, isLoading } = useOrder(orderId);
  const [msg, setMsg] = React.useState("");

  if (isLoading) return <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>Memuat order...</div>;
  if (!order) return <div style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>Order tidak ditemukan.</div>;

  const o = order as Order;
  const currentIdx = STATUS_FLOW.indexOf(o.status);

  async function handleAction(status: string) {
    try {
      await orderApi.updateStatus(o.id, status);
      setMsg(`Status diupdate ke ${status}`);
      window.location.reload();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "14px", marginBottom: "16px" }}>
        <ArrowLeft size={18} /> Kembali
      </button>

      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <h2 style={{ fontSize: "20px", color: "var(--text-primary)", margin: 0 }}>Order #{o.id.slice(-6)}</h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              {new Date(o.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--accent-green)" }}>Rp {o.totalAmount.toLocaleString("id-ID")}</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{o.totalQuantity.toLocaleString()} kg</div>
          </div>
        </div>

        {/* Status progress */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "20px", overflowX: "auto", padding: "8px 0" }}>
          {STATUS_FLOW.map((s, i) => (
            <div key={s} style={{ textAlign: "center", minWidth: "70px" }}>
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%",
                background: i <= currentIdx ? "var(--accent-green)" : "var(--glass-border)",
                margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center",
                color: i <= currentIdx ? "var(--bg-dark)" : "var(--text-secondary)", fontSize: "10px",
              }}>
                {i <= currentIdx ? <CheckCircle size={12} /> : i + 1}
              </div>
              <div style={{ fontSize: "9px", color: i <= currentIdx ? "var(--accent-green)" : "var(--text-secondary)" }}>
                {s.replace(/_/g, " ")}
              </div>
            </div>
          ))}
        </div>

        <h4 style={{ fontSize: "14px", color: "var(--text-primary)", margin: "0 0 " }}>Item</h4>
        <OrderItemList items={o.items} />

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
          {o.status === "AWAITING_PAYMENT" && (
            <button onClick={() => handleAction("PAID")} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "var(--accent-green)", color: "var(--bg-dark)", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              Konfirmasi Pembayaran
            </button>
          )}
          {(o.status === "PAID" || o.status === "READY_FOR_PICKUP") && (
            <button onClick={() => handleAction("DELIVERED")} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              Diterima
            </button>
          )}
          {o.status === "DELIVERED" && (
            <button onClick={() => handleAction("COMPLETED")} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "var(--accent-green)", color: "var(--bg-dark)", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              Selesai
            </button>
          )}
          {["DRAFT", "PENDING_APPROVAL"].includes(o.status) && (
            <button onClick={() => handleAction("CANCELLED")} style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
              <XCircle size={14} /> Batalkan Order
            </button>
          )}
        </div>

        {msg && <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>{msg}</div>}
      </div>
    </div>
  );
}
