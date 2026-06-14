const STATUS_COLORS: Record<string, { background: string; color: string }> = {
  ACTIVE: { background: "rgba(34,197,94,0.2)", color: "#22c55e" },
  PENDING_VERIFICATION: { background: "rgba(245,158,11,0.2)", color: "#f59e0b" },
  SUSPENDED: { background: "rgba(239,68,68,0.2)", color: "#ef4444" },
  REJECTED: { background: "rgba(239,68,68,0.1)", color: "#ef4444" },
};

export default function VerificationStatusBadge({ status }: { status: string }) {
  const st = STATUS_COLORS[status] || STATUS_COLORS.PENDING_VERIFICATION;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: 500,
        ...st,
      }}
    >
      {status === "ACTIVE" ? "Verified" : status.replace(/_/g, " ")}
    </span>
  );
}
