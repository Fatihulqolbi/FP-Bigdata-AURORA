import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../features/marketplace/api/marketplaceApi";
import { toast } from "sonner";
import { Store, LogIn, Mail, Lock, User, MapPin, Copy, Info } from "lucide-react";

interface Props {
  onLoginSuccess: (role: string) => void;
}

export default function LoginPage({ onLoginSuccess }: Props) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("WARGA");
  const [kecamatan, setKecamatan] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError("");
    setSubmitting(true);
    try {
      let resultRole = role;
      if (mode === "login") {
        resultRole = await login(email, password);
      } else {
        resultRole = await register({
          email,
          password,
          role,
          name,
          kecamatan,
        });
      }
      onLoginSuccess(resultRole);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-dark)",
        padding: "20px",
      }}
    >
      <div style={{ maxWidth: "440px", width: "100%", animation: "fadeIn 0.5s ease-in-out" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <Store size={48} color="var(--accent-green)" style={{ marginBottom: "12px" }} />
          <h2 style={{ fontSize: "26px", color: "var(--text-primary)", margin: "0 0 4px" }}>
            AURORA Marketplace
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Platform jual-beli material & produk daur ulang Surabaya
          </p>
        </div>

        <div className="glass-panel" style={{ padding: "28px" }}>
          <div
            style={{
              display: "flex",
              marginBottom: "24px",
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid var(--glass-border)",
            }}
          >
            <button
              onClick={() => setMode("login")}
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                borderRadius: 0,
                background: mode === "login" ? "var(--accent-green)" : "transparent",
                color: mode === "login" ? "var(--bg-dark)" : "var(--text-secondary)",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <LogIn size={14} style={{ marginRight: "6px", display: "inline" }} />
              Masuk
            </button>
            <button
              onClick={() => setMode("register")}
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                borderRadius: 0,
                background: mode === "register" ? "var(--accent-green)" : "transparent",
                color: mode === "register" ? "var(--bg-dark)" : "var(--text-secondary)",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <User size={14} style={{ marginRight: "6px", display: "inline" }} />
              Daftar
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              <Mail
                size={16}
                color="var(--text-secondary)"
                style={{ position: "absolute", left: "12px", top: "13px" }}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                color="var(--text-secondary)"
                style={{ position: "absolute", left: "12px", top: "13px" }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </div>

            {mode === "register" && (
              <>
                <div style={{ position: "relative" }}>
                  <User
                    size={16}
                    color="var(--text-secondary)"
                    style={{ position: "absolute", left: "12px", top: "13px" }}
                  />
                  <input
                    type="text"
                    placeholder="Nama lengkap"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={inputStyle}
                  />
                </div>

                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={inputStyle}
                >
                  <option value="WARGA">Warga (Pembeli Produk)</option>
                  <option value="INDUSTRI">Industri (Pembeli Material)</option>
                  <option value="BANK_SAMPAH">Bank Sampah (Penjual)</option>
                </select>

                <div style={{ position: "relative" }}>
                  <MapPin
                    size={16}
                    color="var(--text-secondary)"
                    style={{ position: "absolute", left: "12px", top: "13px" }}
                  />
                  <input
                    type="text"
                    placeholder="Kecamatan"
                    value={kecamatan}
                    onChange={(e) => setKecamatan(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !email || !password || (mode === "register" && !name)}
              style={{
                padding: "14px",
                borderRadius: "10px",
                border: "none",
                background:
                  email && password && (!mode.includes("register") || name)
                    ? "var(--accent-green)"
                    : "var(--glass-border)",
                color:
                  email && password && (!mode.includes("register") || name)
                    ? "var(--bg-dark)"
                    : "var(--text-secondary)",
                fontWeight: 700,
                fontSize: "15px",
                cursor: email && password ? "pointer" : "not-allowed",
                marginTop: "6px",
                transition: "all 0.2s",
              }}
            >
              {submitting ? "Memproses..." : mode === "login" ? "Masuk ke AURORA" : "Daftar Akun"}
            </button>
          </div>

          {mode === "login" && (
            <div style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  auth.forgotPassword(email || "").then(() => toast("Jika email terdaftar, link reset telah dikirim (lihat console backend).")).catch(() => toast.error("Gagal mengirim reset."));
                }}
                style={{ color: "var(--accent-green)", textDecoration: "none" }}
              >
                Lupa password?
              </a>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: "14px",
                padding: "12px",
                background: "rgba(239,68,68,0.15)",
                borderRadius: "8px",
                color: "#ef4444",
                fontSize: "13px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: "18px",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "10px" }}>
            <Info size={14} />
            <strong>Akun Demo (password: password123)</strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", textAlign: "left" }}>
            {[
              { email: "admin@aurora.go.id", label: "Admin (DLH)" },
              { email: "admin.tps@aurora.go.id", label: "Admin TPS" },
              { email: "bank.bratang@aurora.go.id", label: "Bank Sampah", sub: "Bratang" },
              { email: "bank.keputih@aurora.go.id", label: "Bank Sampah", sub: "Keputih" },
              { email: "bank.wonorejo@aurora.go.id", label: "Bank Sampah", sub: "Wonorejo" },
              { email: "pt.daurulang@aurora.go.id", label: "Industri" },
              { email: "warga@aurora.go.id", label: "Warga" },
            ].map((demo) => (
              <div
                key={demo.email}
                onClick={() => { setEmail(demo.email); setMode("login"); }}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--glass-border)",
                  transition: "all 0.2s",
                }}
                title="Klik untuk mengisi email"
              >
                <div style={{ fontSize: "11px", color: "var(--text-primary)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <Copy size={10} opacity={0.5} /> {demo.label}{demo.sub ? ` (${demo.sub})` : ""}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", wordBreak: "break-all" }}>{demo.email}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 12px 12px 38px",
  borderRadius: "8px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--glass-border)",
  color: "var(--text-primary)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};
