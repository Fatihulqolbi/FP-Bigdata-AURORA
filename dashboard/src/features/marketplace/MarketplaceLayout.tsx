import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import MarketplaceBrowse from "./pages/MarketplaceBrowse";
import ListingDetail from "./pages/ListingDetail";
import InventoryManage from "./pages/InventoryManage";
import DemandForm from "./pages/DemandForm";
import MatchSuggestion from "./pages/MatchSuggestion";
import BuyerDashboard from "./pages/BuyerDashboard";
import OrderDetail from "./pages/OrderDetail";
import SellerDashboard from "./pages/SellerDashboard";
import AdminOrders from "./pages/AdminOrders";
import AdminVerification from "./pages/AdminVerification";
import { Store, Package, ShoppingBag, Shield, Search, ClipboardList } from "lucide-react";
import SkeletonLoader from "./components/SkeletonLoader";

type Page =
  | { name: "browse" }
  | { name: "listing"; id: string }
  | { name: "inventory" }
  | { name: "demand" }
  | { name: "match"; demandId: string }
  | { name: "buyerDashboard" }
  | { name: "sellerDashboard" }
  | { name: "order"; id: string }
  | { name: "adminVerification" }
  | { name: "adminOrders" };

interface Props {
  demoMode?: boolean;
}

export default function MarketplaceLayout({ demoMode = false }: Props) {
  const { user, hasPermission, loading } = useAuth();
  const [page, setPage] = useState<Page>({ name: "browse" });

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px", color: "var(--text-secondary)", flexDirection: "column", gap: "12px" }}>
        <SkeletonLoader width="240px" height="20px" borderRadius="4px" />
        <SkeletonLoader width="180px" height="20px" borderRadius="4px" />
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { icon: Store, label: "Etalase", page: { name: "browse" } as Page, show: true },
    { icon: Package, label: "Inventori", page: { name: "inventory" } as Page, show: hasPermission("CREATE_LISTING") },
    { icon: Search, label: "Cari Material", page: { name: "demand" } as Page, show: hasPermission("CREATE_DEMAND") },
    { icon: Package, label: "Penjualan Masuk", page: { name: "sellerDashboard" } as Page, show: hasPermission("VIEW_SELLER_ORDERS") },
    { icon: ShoppingBag, label: "Order Saya", page: { name: "buyerDashboard" } as Page, show: hasPermission("VIEW_BUYER_ORDERS") },
    { icon: Shield, label: "Verifikasi", page: { name: "adminVerification" } as Page, show: hasPermission("VERIFY_USERS") },
    { icon: ClipboardList, label: "Semua Order", page: { name: "adminOrders" } as Page, show: hasPermission("VIEW_ALL_ORDERS") },
  ].filter((item) => item.show);

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <div className="glass-panel" style={{ padding: "12px 20px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <Store size={20} color="var(--accent-green)" />
          <span style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>Marketplace</span>
          <div style={{ display: "flex", gap: "2px", flexWrap: "wrap" }}>
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setPage(item.page)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 14px", borderRadius: "6px", border: "none",
                  background: page.name === item.page.name ? "rgba(34,197,94,0.15)" : "transparent",
                  color: page.name === item.page.name ? "var(--accent-green)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: "13px", fontWeight: 600,
                }}
              >
                <item.icon size={14} /> {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {demoMode && (
        <div style={{
          padding: "8px 16px",
          marginBottom: "16px",
          borderRadius: "8px",
          background: "rgba(34,197,94,0.12)",
          border: "1px solid rgba(34,197,94,0.3)",
          color: "var(--accent-green)",
          fontSize: "13px",
          textAlign: "center",
          fontWeight: 600,
        }}>
          Mode Demo: pembelian & order tidak tersimpan ke database
        </div>
      )}

      {page.name === "browse" && <MarketplaceBrowse onSelectListing={(id: string) => setPage({ name: "listing", id })} />}
      {page.name === "listing" && <ListingDetail listingId={page.id} onBack={() => setPage({ name: "browse" })} demoMode={demoMode} />}
      {page.name === "inventory" && <InventoryManage />}
      {page.name === "demand" && <DemandForm onDemandCreated={(demandId: string) => setPage({ name: "match", demandId })} demoMode={demoMode} />}
      {page.name === "match" && <MatchSuggestion demandId={page.demandId} onBack={() => setPage({ name: "demand" })} demoMode={demoMode} />}
      {page.name === "buyerDashboard" && <BuyerDashboard onViewOrder={(id: string) => setPage({ name: "order", id })} onNavigate={(p: string) => setPage({ name: p } as Page)} />}
      {page.name === "sellerDashboard" && <SellerDashboard onNavigate={(p: string) => setPage({ name: p } as Page)} />}
      {page.name === "order" && <OrderDetail orderId={page.id} onBack={() => setPage({ name: "buyerDashboard" })} />}
      {page.name === "adminVerification" && <AdminVerification />}
      {page.name === "adminOrders" && <AdminOrders />}
    </div>
  );
}
