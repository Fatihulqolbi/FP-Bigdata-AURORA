import { useState } from "react";
import { useSellerOrders } from "../hooks/useOrders";
import { orders as orderApi } from "../api/marketplaceApi";
import type { SellerOrderItem } from "../types";
import ConfirmModal from "../components/ConfirmModal";
import { Package, CheckCircle, XCircle, Truck, Megaphone, Share2 } from "lucide-react";
import SkeletonLoader from "../components/SkeletonLoader";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  PENDING_APPROVAL: { background: "rgba(245,158,11,0.2)", color: "#f59e0b" },
  APPROVED: { background: "rgba(59,130,246,0.2)", color: "#3b82f6" },
  AWAITING_PAYMENT: { background: "rgba(139,92,246,0.2)", color: "#8b5cf6" },
  PAID: { background: "rgba(34,197,94,0.2)", color: "#22c55e" },
  DELIVERED: { background: "rgba(34,197,94,0.2)", color: "#22c55e" },
  COMPLETED: { background: "rgba(34,197,94,0.3)", color: "#16a34a" },
  CANCELLED: { background: "rgba(239,68,68,0.2)", color: "#ef4444" },
};

export default function SellerDashboard({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const { data, isLoading, refetch } = useSellerOrders();
  const [confirm, setConfirm] = useState<{ type: string; itemId: string; orderId?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const items: SellerOrderItem[] = data?.orderItems || [];

  async function handleApprove(itemId: string) {
    setLoading(true);
    try {
      await orderApi.approveItem(itemId);
      toast.success("Order item disetujui!");
      setConfirm(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject(itemId: string) {
    setLoading(true);
    try {
      await orderApi.rejectItem(itemId);
      toast.success("Order item ditolak.");
      setConfirm(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleShip(orderId: string) {
    setLoading(true);
    try {
      await orderApi.updateStatus(orderId, "DELIVERED");
      toast.success("Barang dikirim!");
      setConfirm(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <Package size={22} /> Penjualan Masuk
      </h2>

      {isLoading && (
        <div className="glass-panel" style={{ padding: "20px" }}>
          <SkeletonLoader height="60px" borderRadius="8px" style={{ marginBottom: "12px" }} />
          <SkeletonLoader height="60px" borderRadius="8px" />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {items.map((item) => {
          const st = STATUS_STYLES[item.status] || {};
          return (
            <div key={item.id} className="glass-panel" style={{ padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>
                  {item.listing?.title || "Item"}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  {item.quantity.toLocaleString()} kg × Rp {item.pricePerKg.toLocaleString("id-ID")} = Rp {item.subtotal.toLocaleString("id-ID")}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Pembeli: {item.order?.buyer?.name || "Unknown"} | Order #{item.order?.id?.slice(-6)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "6px", ...st }}>
                  {(item.status || "").replace(/_/g, " ")}
                </span>
                {item.status === "PENDING_APPROVAL" && (
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => setConfirm({ type: "approve", itemId: item.id })}
                      style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "var(--accent-green)", color: "var(--bg-dark)", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <CheckCircle size={13} /> Setuju
                    </button>
                    <button
                      onClick={() => setConfirm({ type: "reject", itemId: item.id })}
                      style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <XCircle size={13} /> Tolak
                    </button>
                  </div>
                )}
                {item.status === "PAID" && (
                  <button
                    onClick={() => setConfirm({ type: "ship", itemId: item.id, orderId: item.order?.id })}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <Truck size={13} /> Kirim
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && items.length === 0 && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <Package size={48} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: "16px", margin: "12px 0 8px" }}>Belum ada penjualan masuk</p>
          <p style={{ fontSize: "13px", margin: "0 0 20px 0" }}>Order dari pembeli akan muncul di sini.</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => onNavigate?.("inventory")}
              style={{
                padding: "10px 20px", borderRadius: "8px", border: "none",
                background: "var(--accent-green)", color: "var(--bg-dark)",
                fontWeight: 600, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <Megaphone size={14} /> Promosikan Etalase
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin + "/?tab=marketplace");
                toast.success("Link etalase disalin!");
              }}
              style={{
                padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--glass-border)",
                background: "transparent", color: "var(--text-primary)",
                fontWeight: 600, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <Share2 size={14} /> Bagikan Link
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirm !== null}
        title={confirm?.type === "approve" ? "Setujui Order" : confirm?.type === "reject" ? "Tolak Order" : "Kirim Barang"}
        message={
          confirm?.type === "approve"
            ? "Anda yakin ingin menyetujui order item ini?"
            : confirm?.type === "reject"
            ? "Anda yakin ingin menolak order item ini?"
            : "Konfirmasi bahwa barang siap dikirim?"
        }
        variant={confirm?.type === "reject" ? "danger" : confirm?.type === "approve" ? "success" : "info"}
        loading={loading}
        onConfirm={() => {
          if (confirm?.type === "approve") handleApprove(confirm.itemId);
          else if (confirm?.type === "reject") handleReject(confirm.itemId);
          else if (confirm?.type === "ship" && confirm.orderId) handleShip(confirm.orderId);
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
