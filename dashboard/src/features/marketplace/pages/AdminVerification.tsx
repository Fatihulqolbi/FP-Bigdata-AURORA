import { useState, useEffect } from "react";
import { admin } from "../api/marketplaceApi";
import { Shield, CheckCircle, XCircle } from "lucide-react";

export default function AdminVerification() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await admin.getVerifications();
      setPending(data as any[]);
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(userId: string, status: string) {
    try {
      await admin.verifyUser(userId, status);
      setMsg(`User ${userId.slice(-6)} → ${status}`);
      loadData();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
            <Shield size={22} /> Verifikasi Akun
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Moderasi pendaftaran Bank Sampah & Industri
          </p>
        </div>
        <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
          {pending.length} menunggu verifikasi
        </span>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", background: "rgba(59,130,246,0.15)", borderRadius: "8px", color: "#3b82f6", marginBottom: "16px", fontSize: "13px" }}>
          {msg}
        </div>
      )}

      {loading && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>Memuat...</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {pending.map((user: any) => (
          <div key={user.id} className="glass-panel" style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {user.email} | {user.role} | {user.contact || "-"} | {user.address || "-"}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Terdaftar: {new Date(user.createdAt).toLocaleDateString("id-ID")}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                onClick={() => handleVerify(user.id, "ACTIVE")}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "6px 14px", borderRadius: "6px", border: "none",
                  background: "var(--accent-green)", color: "var(--bg-dark)",
                  fontSize: "12px", fontWeight: 600, cursor: "pointer",
                }}
              >
                <CheckCircle size={14} /> Verifikasi
              </button>
              <button
                onClick={() => handleVerify(user.id, "REJECTED")}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "6px 14px", borderRadius: "6px", border: "1px solid #ef4444",
                  background: "transparent", color: "#ef4444",
                  fontSize: "12px", fontWeight: 600, cursor: "pointer",
                }}
              >
                <XCircle size={14} /> Tolak
              </button>
            </div>
          </div>
        ))}
      </div>

      {!loading && pending.length === 0 && (
        <div className="glass-panel" style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-secondary)" }}>
          <CheckCircle size={48} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: "16px", margin: "12px 0 8px" }}>Semua akun terverifikasi</p>
          <p style={{ fontSize: "13px", margin: 0 }}>Tidak ada pendaftaran yang menunggu.</p>
        </div>
      )}
    </div>
  );
}
