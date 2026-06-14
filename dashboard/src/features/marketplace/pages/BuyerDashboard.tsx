import React, { useState } from "react";
import { useBuyerOrders } from "../hooks/useOrders";
import { orders as orderApi } from "../api/marketplaceApi";
import OrderItemList from "../components/OrderItemList";
import type { Order } from "../types";
import { ShoppingBag, Package, Clock, CheckCircle, Truck, Search, Store } from "lucide-react";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING_APPROVAL: <Clock size={14} />,
  APPROVED: <CheckCircle size={14} />,
  AWAITING_PAYMENT: <Package size={14} />,
  PAID: <CheckCircle size={14} />,
  DELIVERED: <Truck size={14} />,
  COMPLETED: <CheckCircle size={14} />,
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "#f59e0b",
  APPROVED: "#3b82f6",
  AWAITING_PAYMENT: "#8b5cf6",
  PAID: "#22c55e",
  IN_TRANSIT: "#f59e0b",
  DELIVERED: "#3b82f6",
  COMPLETED: "#16a34a",
  CANCELLED: "#ef4444",
};

interface Props {
  onViewOrder: (id: string) => void;
  onNavigate?: (page: string) => void;
}

export default function BuyerDashboard({ onViewOrder, onNavigate }: Props) {
  const { data, isLoading, refetch } = useBuyerOrders();
  const [statusMsg, setStatusMsg] = useState("");

  const orders: Order[] = data?.orders || [];

  async function handleStatusUpdate(orderId: string, status: string) {
    try {
      await orderApi.updateStatus(orderId, status);
      setStatusMsg(`Order #${orderId.slice(-6)} → ${status}`);
      refetch();
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: "0 0 20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <ShoppingBag size={22} /> Dashboard Pembeli
      </h2>

      {statusMsg && (
        <div style={{ padding: "10px 14px", background: "rgba(59,130,246,0.15)", borderRadius: "8px", color: "#3b82f6", marginBottom: "16px", fontSize: "13px" }}>
          {statusMsg}
        </div>
      )}

      {isLoading && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Memuat order...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {orders.map((order: Order) => (
          <div
            key={order.id}
            className="glass-panel"
            style={{ padding: "16px", cursor: "pointer" }}
            onClick={() => onViewOrder(order.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Order #{order.id.slice(-6)}</span>
                <span style={{ fontSize: "12px", color: "var(--accent-green)", fontWeight: 700, marginLeft: "12px" }}>
                  Rp {order.totalAmount.toLocaleString("id-ID")}
                </span>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginLeft: "8px" }}>
                  {order.totalQuantity.toLocaleString()} kg
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: STATUS_COLORS[order.status] || "var(--text-secondary)", fontSize: "12px" }}>
                {STATUS_ICONS[order.status]} {(order.status || "").replace(/_/g, " ")}
              </div>
            </div>

            <OrderItemList items={order.items} compact />

            <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
              {order.status === "AWAITING_PAYMENT" && (
                <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, "PAID"); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "var(--accent-green)", color: "var(--bg-dark)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                  Konfirmasi Pembayaran
                </button>
              )}
              {order.status === "READY_FOR_PICKUP" && (
                <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, "DELIVERED"); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "#3b82f6", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                  Diterima
                </button>
              )}
              {order.status === "DELIVERED" && (
                <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, "COMPLETED"); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", background: "var(--accent-green)", color: "var(--bg-dark)", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                  Selesai
                </button>
              )}
              {(order.status === "PENDING_APPROVAL" || order.status === "DRAFT") && (
                <button onClick={(e) => { e.stopPropagation(); handleStatusUpdate(order.id, "CANCELLED"); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                  Batalkan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isLoading && orders.length === 0 && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <ShoppingBag size={48} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: "16px", margin: "12px 0 8px" }}>Belum ada order</p>
          <p style={{ fontSize: "13px", margin: "0 0 20px 0" }}>Cari material di etalase dan buat order.</p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => onNavigate?.("demand")}
              style={{
                padding: "10px 20px", borderRadius: "8px", border: "none",
                background: "var(--accent-green)", color: "var(--bg-dark)",
                fontWeight: 600, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <Search size={14} /> Cari Material
            </button>
            <button
              onClick={() => onNavigate?.("browse")}
              style={{
                padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--glass-border)",
                background: "transparent", color: "var(--text-primary)",
                fontWeight: 600, fontSize: "13px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              <Store size={14} /> Jelajahi Etalase
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
