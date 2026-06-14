import { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { orders as orderApi } from "../api/marketplaceApi";
import OrderItemList from "../components/OrderItemList";
import ConfirmModal from "../components/ConfirmModal";
import type { Order } from "../types";
import { ClipboardList, XCircle, AlertTriangle } from "lucide-react";
import SkeletonLoader from "../components/SkeletonLoader";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "#f59e0b",
  AWAITING_PAYMENT: "#8b5cf6",
  PAID: "#22c55e",
  COMPLETED: "#16a34a",
  CANCELLED: "#ef4444",
  DISPUTE: "#ef4444",
  RESOLVED: "#3b82f6",
};

export default function AdminOrders() {
  const { hasPermission } = useAuth();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ type: string; orderId: string } | null>(null);

  useState(() => {
    orderApi.listBuyer({ limit: "50" }).then((data: any) => {
      if (data?.orders) setAllOrders(data.orders);
      setLoading(false);
    }).catch(() => setLoading(false));
  });

  async function handleAction(orderId: string, action: string) {
    try {
      if (action === "resolve") {
        await orderApi.updateStatus(orderId, "RESOLVED");
      } else {
        await orderApi.updateStatus(orderId, action);
      }
      toast.success(`Order #${orderId.slice(-6)} → ${action}`);
      setConfirm(null);
      // Refresh
      const data = await orderApi.listBuyer({ limit: "50" });
      if (data?.orders) setAllOrders(data.orders);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <ClipboardList size={22} /> Semua Transaksi (Admin)
      </h2>

      {loading && (
        <div className="glass-panel" style={{ padding: "20px" }}>
          <SkeletonLoader height="80px" borderRadius="8px" style={{ marginBottom: "12px" }} />
          <SkeletonLoader height="80px" borderRadius="8px" />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {allOrders.map((order) => (
          <div key={order.id} className="glass-panel" style={{ padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  #{order.id.slice(-6)} | Pembeli: {order.buyer?.name || "?"}
                </span>
                <span style={{ fontSize: "13px", color: "var(--accent-green)", fontWeight: 700, marginLeft: "10px" }}>
                  Rp {order.totalAmount.toLocaleString("id-ID")}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
                  background: `rgba(${STATUS_COLORS[order.status] === "#f59e0b" ? "245,158,11" : STATUS_COLORS[order.status] === "#ef4444" ? "239,68,68" : "34,197,94"},0.15)`,
                  color: STATUS_COLORS[order.status] || "var(--text-secondary)",
                }}>
                  {order.status}
                </span>
                {order.status === ("DISPUTE" as any) && hasPermission("RESOLVE_DISPUTES") && (
                  <button
                    onClick={() => setConfirm({ type: "resolve", orderId: order.id })}
                    style={{ padding: "4px 10px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "white", fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <AlertTriangle size={12} /> Resolve
                  </button>
                )}
                {(order.status === "PENDING_APPROVAL" || order.status === "DRAFT") && hasPermission("MODERATE_ORDERS") && (
                  <button
                    onClick={() => setConfirm({ type: "cancel", orderId: order.id })}
                    style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <XCircle size={12} /> Cancel
                  </button>
                )}
              </div>
            </div>
            <OrderItemList items={order.items} compact />
            {order.paymentProof && (
              <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-secondary)" }}>
                Bukti bayar: <a href={order.paymentProof} target="_blank" style={{ color: "var(--accent-green)" }}>Lihat</a>
              </div>
            )}
          </div>
        ))}
      </div>

      {!loading && allOrders.length === 0 && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <p style={{ fontSize: "16px", margin: 0 }}>Belum ada transaksi</p>
        </div>
      )}

      <ConfirmModal
        open={confirm !== null}
        title={confirm?.type === "resolve" ? "Resolve Dispute" : "Cancel Order"}
        message={confirm?.type === "resolve" ? "Tandai dispute ini sebagai resolved?" : "Yakin batalkan order ini?"}
        variant={confirm?.type === "resolve" ? "info" : "danger"}
        onConfirm={() => confirm && handleAction(confirm.orderId, confirm.type === "resolve" ? "resolve" : "CANCELLED")}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
