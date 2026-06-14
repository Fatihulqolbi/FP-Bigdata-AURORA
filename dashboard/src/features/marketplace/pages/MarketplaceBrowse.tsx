import { useState } from "react";
import { useListings } from "../hooks/useListings";
import ListingCard from "../components/ListingCard";
import type { Listing } from "../types";
import { Search } from "lucide-react";

interface Props {
  onSelectListing: (id: string) => void;
}

export default function MarketplaceBrowse({ onSelectListing }: Props) {
  const [type, setType] = useState<string>("");
  const [search, setSearch] = useState("");

  const params: Record<string, string> = {};
  if (type) params.type = type;

  const { data, isLoading, error } = useListings(params);

  const listings: Listing[] = data?.listings || [];

  const filtered = search
    ? listings.filter(
        (l: Listing) =>
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          l.category.name.toLowerCase().includes(search.toLowerCase()) ||
          l.seller.name.toLowerCase().includes(search.toLowerCase())
      )
    : listings;

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0 }}>Marketplace</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Etalase material daur ulang & produk kerajinan
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "12px 16px", marginBottom: "20px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "200px" }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Cari material atau produk..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, background: "transparent", border: "none", color: "var(--text-primary)",
              fontSize: "14px", outline: "none",
            }}
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
            color: "var(--text-primary)", padding: "6px 12px", borderRadius: "6px", fontSize: "13px",
          }}
        >
          <option value="">Semua Tipe</option>
          <option value="MATERIAL">Material</option>
          <option value="PRODUCT">Produk</option>
        </select>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
          Memuat listing...
        </div>
      )}

      {error && (
        <div style={{ textAlign: "center", padding: "40px", color: "#ef4444" }}>
          Gagal memuat data. Pastikan backend berjalan.
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <p style={{ fontSize: "16px", margin: "0 0 8px" }}>Belum ada listing</p>
          <p style={{ fontSize: "13px", margin: 0 }}>Bank Sampah belum membuat listing tersedia.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {filtered.map((listing: Listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onView={() => onSelectListing(listing.id)}
          />
        ))}
      </div>
    </div>
  );
}
