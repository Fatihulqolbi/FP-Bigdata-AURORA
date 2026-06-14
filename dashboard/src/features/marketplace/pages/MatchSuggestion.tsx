import { useState } from "react";
import { useMatches } from "../hooks/useMatches";
import { orders } from "../api/marketplaceApi";
import { useAuth } from "../../../contexts/AuthContext";
import MatchSuggestionCard from "../components/MatchSuggestionCard";
import { ArrowLeft, Loader } from "lucide-react";

interface Props {
  demandId: string;
  onBack: () => void;
  demoMode?: boolean;
}

export default function MatchSuggestion({ demandId, onBack, demoMode = false }: Props) {
  const { data, isLoading, error } = useMatches(demandId);
  const { user } = useAuth();
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const matchData = data as any;

  const handleInstantOrder = async () => {
    setActionError("");
    setActionSuccess("");
    if (demoMode) {
      setActionSuccess("[Demo] Order instan simulasi! (tidak tersimpan)");
      return;
    }
    try {
      const order = await orders.createInstant(demandId);
      setActionSuccess(`Order instan berhasil dibuat! #${order.id.slice(-6)}`);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleCreateManualOrder = async (match: any) => {
    setActionError("");
    setActionSuccess("");
    if (demoMode) {
      setActionSuccess("[Demo] Order manual simulasi! (tidak tersimpan)");
      return;
    }
    try {
      const items = match.candidates.map((c: any) => ({
        listingId: c.listingId,
        sellerId: c.sellerId,
        quantity: c.availableQuantity,
        pricePerKg: c.pricePerKg,
      }));
      await orders.create({ demandId, items, logisticsOption: "PICKUP" });
      setActionSuccess("Order manual berhasil dibuat!");
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "14px", marginBottom: "16px" }}>
        <ArrowLeft size={18} /> Kembali
      </button>

      <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: "0 0 20px" }}>
        Saran Match
        {matchData?.instantOrderEligible && !isAdmin && (
          <span style={{ fontSize: "13px", background: "rgba(34,197,94,0.2)", color: "#22c55e", padding: "4px 10px", borderRadius: "8px", marginLeft: "12px" }}>
            Order Instan Tersedia!
          </span>
        )}
        {isAdmin && !demoMode && (
          <span style={{ fontSize: "13px", background: "rgba(245,158,11,0.2)", color: "#f59e0b", padding: "4px 10px", borderRadius: "8px", marginLeft: "12px" }}>
            Mode demo nonaktif — order tidak bisa dibuat
          </span>
        )}
      </h2>

      {actionSuccess && (
        <div style={{ padding: "14px", background: "rgba(34,197,94,0.15)", borderRadius: "8px", color: "var(--accent-green)", marginBottom: "16px", fontSize: "14px" }}>
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div style={{ padding: "14px", background: "rgba(239,68,68,0.15)", borderRadius: "8px", color: "#ef4444", marginBottom: "16px", fontSize: "14px" }}>
          {actionError}
        </div>
      )}

      {isLoading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "60px", color: "var(--text-secondary)" }}>
          <Loader size={20} className="spin" /> Mencari match terbaik...
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>
          Gagal memuat matching. Pastikan demand aktif.
        </div>
      )}

      {!isLoading && !error && matchData?.matches?.length === 0 && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <p style={{ fontSize: "16px", margin: "0 0 8px" }}>Tidak ada match ditemukan</p>
          <p style={{ fontSize: "13px", margin: 0 }}>Coba ubah kriteria demand (harga lebih tinggi, radius lebih besar).</p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {matchData?.matches?.map((match: any, i: number) => (
          <MatchSuggestionCard
            key={i}
            group={match}
            rank={i + 1}
            instantEligible={matchData.instantOrderEligible}
            onCreateOrder={() => i === 0 && matchData.instantOrderEligible ? handleInstantOrder() : handleCreateManualOrder(match)}
          />
        ))}
      </div>
    </div>
  );
}
