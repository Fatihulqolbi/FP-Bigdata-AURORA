import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../features/marketplace/api/marketplaceApi";
import { toast } from "sonner";
import { User, Mail, Lock, MapPin, Phone, LogOut, Sun, Moon, Shield, Key, Palette, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("aurora_theme") as "dark" | "light") || "dark"
  );

  const [profile, setProfile] = useState({
    name: user?.name || "",
    kecamatan: user?.kecamatan || "",
    contact: (user as any)?.contact || "",
  });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("aurora_theme", next);
    const root = document.documentElement.style;
    root.setProperty("--bg-dark", next === "dark" ? "#0f172a" : "#f8fafc");
    root.setProperty("--bg-card", next === "dark" ? "rgba(30, 41, 59, 0.7)" : "rgba(255,255,255,0.8)");
    root.setProperty("--text-primary", next === "dark" ? "#f8fafc" : "#0f172a");
    root.setProperty("--text-secondary", next === "dark" ? "#94a3b8" : "#475569");
    root.setProperty("--glass-border", next === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)");
    root.setProperty("--glass-shadow", next === "dark" ? "0 8px 32px 0 rgba(0,0,0,0.37)" : "0 8px 32px 0 rgba(0,0,0,0.1)");
    toast.success(`Tema ${next === "dark" ? "gelap" : "terang"} diaktifkan`);
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await auth.updateProfile(profile);
      await refreshUser();
      toast.success("Profil berhasil diperbarui.");
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan profil.");
    } finally { setSaving(false); }
  }

  async function handleChangePassword() {
    if (pwForm.newPassword !== pwForm.confirm) { toast.error("Konfirmasi password baru tidak cocok."); return; }
    if (pwForm.newPassword.length < 6) { toast.error("Password baru minimal 6 karakter."); return; }
    setChangingPw(true);
    try {
      await auth.changePassword(pwForm.oldPassword, pwForm.newPassword);
      setPwForm({ oldPassword: "", newPassword: "", confirm: "" });
      toast.success("Password berhasil diubah.");
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah password.");
    } finally { setChangingPw(false); }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== user?.email) { toast.error("Ketik email Anda dengan benar untuk konfirmasi."); return; }
    setDeleting(true);
    try {
      await auth.deleteAccount("confirm");
      toast.success("Akun telah dinonaktifkan.");
      logout();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus akun.");
    } finally { setDeleting(false); }
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <User size={24} color="var(--accent-green)" />
        <div>
          <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0 }}>Pengaturan Akun</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "2px 0 0" }}>
            {user?.email} · {user?.role}
          </p>
        </div>
      </div>

      {/* SECTION: Account Info */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px" }}>
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Shield size={18} color="var(--accent-green)" />
            <h3 style={{ fontSize: "16px", color: "var(--text-primary)", margin: 0 }}>Profil</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Input icon={<Mail size={15} />} value={user?.email || ""} disabled placeholder="Email" />
            <Input icon={<User size={15} />} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Nama lengkap" />
            <Input icon={<MapPin size={15} />} value={profile.kecamatan} onChange={e => setProfile({ ...profile, kecamatan: e.target.value })} placeholder="Kecamatan" />
            <Input icon={<Phone size={15} />} value={profile.contact} onChange={e => setProfile({ ...profile, contact: e.target.value })} placeholder="Kontak (nomor HP)" />
            <button onClick={handleSaveProfile} disabled={saving} style={btnPrimary(saving)}>
              {saving ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>

        {/* SECTION: Security */}
        <div className="glass-panel" style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <Key size={18} color="var(--accent-green)" />
            <h3 style={{ fontSize: "16px", color: "var(--text-primary)", margin: 0 }}>Ubah Password</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <Input icon={<Lock size={15} />} type="password" value={pwForm.oldPassword} onChange={e => setPwForm({ ...pwForm, oldPassword: e.target.value })} placeholder="Password saat ini" />
            <Input icon={<Lock size={15} />} type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} placeholder="Password baru (min. 6 karakter)" />
            <Input icon={<Lock size={15} />} type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Konfirmasi password baru" />
            <button onClick={handleChangePassword} disabled={changingPw || !pwForm.oldPassword || !pwForm.newPassword} style={btnPrimary(changingPw)}>
              {changingPw ? "Mengubah..." : "Ubah Password"}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION: Appearance & Session */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: "20px" }}>
        <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Palette size={20} color="var(--text-secondary)" />
            <div>
              <div style={{ fontSize: "15px", color: "var(--text-primary)", fontWeight: 600 }}>Tema Tampilan</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Saat ini: {theme === "dark" ? "Gelap" : "Terang"}</div>
            </div>
          </div>
          <button onClick={toggleTheme} style={{
            padding: "8px 18px", borderRadius: "8px", border: "1px solid var(--glass-border)",
            background: theme === "dark" ? "rgba(139,92,246,0.15)" : "rgba(245,158,11,0.15)",
            color: theme === "dark" ? "#8b5cf6" : "#f59e0b",
            cursor: "pointer", fontSize: "13px", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "dark" ? "Mode Terang" : "Mode Gelap"}
          </button>
        </div>

        <div className="glass-panel" style={{ padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <LogOut size={20} color="var(--text-secondary)" />
            <div>
              <div style={{ fontSize: "15px", color: "var(--text-primary)", fontWeight: 600 }}>Keluar Akun</div>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Anda akan kembali ke halaman login.</div>
            </div>
          </div>
          <button onClick={logout} style={{
            padding: "8px 18px", borderRadius: "8px", border: "1px solid #ef4444",
            background: "transparent", color: "#ef4444", cursor: "pointer",
            fontSize: "13px", fontWeight: 600,
          }}>Keluar</button>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="glass-panel" style={{ padding: "24px", border: "1px solid rgba(239,68,68,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <AlertTriangle size={18} color="#ef4444" />
          <h3 style={{ fontSize: "16px", color: "#ef4444", margin: 0 }}>Zona Berbahaya</h3>
        </div>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
          Tindakan ini akan menonaktifkan akun Anda secara permanen. Semua data Anda akan dipertahankan tetapi akun tidak dapat digunakan kembali.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            placeholder={`Ketik: ${user?.email}`}
            style={{ ...inp, border: "1px solid rgba(239,68,68,0.4)", flex: 1, minWidth: "240px" }}
          />
          <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirm !== user?.email} style={{
            padding: "10px 24px", borderRadius: "8px", border: "none",
            background: deleting || deleteConfirm !== user?.email ? "var(--glass-border)" : "#ef4444",
            color: deleting || deleteConfirm !== user?.email ? "var(--text-secondary)" : "white",
            fontWeight: 700, fontSize: "14px", cursor: deleting || deleteConfirm !== user?.email ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}>
            {deleting ? "Menghapus..." : "Hapus Akun Saya"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ icon, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { icon: React.ReactNode }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-secondary)", display: "flex" }}>{icon}</span>
      <input {...rest} style={inp} />
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 11px 11px 38px", borderRadius: "8px",
  background: "rgba(255,255,255,0.05)", border: "1px solid var(--glass-border)",
  color: "var(--text-primary)", fontSize: "14px", outline: "none", boxSizing: "border-box",
};

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  padding: "12px", borderRadius: "8px", border: "none",
  background: disabled ? "var(--glass-border)" : "var(--accent-green)",
  color: disabled ? "var(--text-secondary)" : "var(--bg-dark)",
  fontWeight: 700, fontSize: "14px", cursor: disabled ? "not-allowed" : "pointer",
  marginTop: "4px",
});
