interface Props {
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
}

export default function PriceRangeBadge({ minPrice, maxPrice, currentPrice }: Props) {
  const isOutOfRange = currentPrice < minPrice || currentPrice > maxPrice;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 600,
        background: isOutOfRange ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
        color: isOutOfRange ? "#ef4444" : "#3b82f6",
      }}
    >
      Rp {currentPrice.toLocaleString("id-ID")}/kg
      <span style={{ opacity: 0.6, fontSize: "10px", marginLeft: "4px" }}>
        (min Rp {minPrice.toLocaleString("id-ID")})
      </span>
    </span>
  );
}
