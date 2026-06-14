import { AlertTriangle, Check, X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "success" | "info";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "info",
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  if (!open) return null;

  const colors: Record<string, { bg: string; icon: string }> = {
    danger: { bg: "rgba(239,68,68,0.15)", icon: "#ef4444" },
    success: { bg: "rgba(34,197,94,0.15)", icon: "#22c55e" },
    info: { bg: "rgba(59,130,246,0.15)", icon: "#3b82f6" },
  };
  const c = colors[variant] || colors.info;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
      onClick={onCancel}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: "420px",
          width: "100%",
          padding: "28px",
          animation: "fadeIn 0.3s ease-in-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: c.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={22} color={c.icon} />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", color: "var(--text-primary)", margin: "0 0 4px" }}>{title}</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{message}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "1px solid var(--glass-border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <X size={14} /> {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              background: variant === "danger" ? "#ef4444" : variant === "success" ? "var(--accent-green)" : "#3b82f6",
              color: "white",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {loading ? (
              "Memproses..."
            ) : (
              <>
                <Check size={14} /> {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
