import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

const API_BASE = "http://localhost:4000/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  address?: string;
  kecamatan?: string;
  contact?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserStats {
  total: number;
  byRole: { role: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

const roleColors: Record<string, string> = {
  ADMIN: "#ef4444",
  ADMIN_TPS: "#f59e0b",
  BANK_SAMPAH: "#10b981",
  INDUSTRI: "#3b82f6",
  WARGA: "#8b5cf6",
  UMKM: "#06b6d4",
  DRIVER: "#f97316",
};

const statusColors: Record<string, string> = {
  ACTIVE: "#10b981",
  PENDING_VERIFICATION: "#f59e0b",
  SUSPENDED: "#ef4444",
  REJECTED: "#6b7280",
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const token = localStorage.getItem("aurora_token") || "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");

      const res = await fetch(`${API_BASE}/auth/admin/users?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token, search, roleFilter, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/stats`, { headers });
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchUsers(); fetchStats(); }, [fetchUsers, fetchStats]);

  const handleUpdate = async (userId: string, data: any) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/${userId}`, {
        method: "PATCH", headers, body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("User berhasil diupdate");
        setEditingUser(null);
        fetchUsers();
        fetchStats();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal update");
      }
    } catch { toast.error("Koneksi gagal"); }
  };



  const handleCreate = async (data: { name: string; email: string; password: string; role: string; status: string }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users`, {
        method: "POST", headers, body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success(`User ${data.name} berhasil dibuat`);
        setShowCreate(false);
        fetchUsers();
        fetchStats();
      } else {
        const err = await res.json();
        toast.error(err.error || "Gagal membuat user");
      }
    } catch { toast.error("Koneksi gagal"); }
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <StatCard label="Total User" value={stats.total} color="var(--text-primary)" />
          {stats.byRole.slice(0, 4).map((r) => (
            <StatCard key={r.role} label={r.role.replace("_", " ")} value={r.count} color={roleColors[r.role] || "#6b7280"} />
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel" style={{ padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama/email..."
          style={{ flex: 1, minWidth: "200px", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", outline: "none" }}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px" }}>
          <option value="">Semua Role</option>
          <option value="ADMIN">Admin</option>
          <option value="ADMIN_TPS">Admin TPS</option>
          <option value="BANK_SAMPAH">Bank Sampah</option>
          <option value="INDUSTRI">Industri</option>
          <option value="WARGA">Warga</option>
          <option value="UMKM">UMKM</option>
          <option value="DRIVER">Driver</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px" }}>
          <option value="">Semua Status</option>
          <option value="ACTIVE">Aktif</option>
          <option value="PENDING_VERIFICATION">Pending</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="REJECTED">Ditolak</option>
        </select>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "8px 16px", borderRadius: "6px",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "white", border: "none", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          + Tambah Akun
        </button>
      </div>

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: "16px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ padding: "10px 8px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Nama</th>
              <th style={{ padding: "10px 8px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Email</th>
              <th style={{ padding: "10px 8px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Role</th>
              <th style={{ padding: "10px 8px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Status</th>
              <th style={{ padding: "10px 8px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Terdaftar</th>
              <th style={{ padding: "10px 8px", textAlign: "right", color: "var(--text-secondary)", fontWeight: 600 }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>Memuat...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--text-secondary)" }}>Tidak ada user ditemukan</td></tr>
            ) : users.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding: "10px 8px", color: "var(--text-primary)", fontWeight: 600 }}>{user.name}</td>
                <td style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>{user.email}</td>
                <td style={{ padding: "10px 8px" }}>
                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, background: `${roleColors[user.role]}20`, color: roleColors[user.role] }}>{user.role.replace("_", " ")}</span>
                </td>
                <td style={{ padding: "10px 8px" }}>
                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, background: `${statusColors[user.status]}20`, color: statusColors[user.status] }}>{user.status.replace("_", " ")}</span>
                </td>
                <td style={{ padding: "10px 8px", color: "var(--text-secondary)" }}>{new Date(user.createdAt).toLocaleDateString("id-ID")}</td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button onClick={() => setEditingUser(user)} style={{ padding: "4px 10px", borderRadius: "4px", background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)", fontSize: "10px", cursor: "pointer" }}>Edit</button>
                    {user.status === "ACTIVE" && (
                      <button onClick={() => handleUpdate(user.id, { status: "SUSPENDED" })} style={{ padding: "4px 10px", borderRadius: "4px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", fontSize: "10px", cursor: "pointer" }}>Suspend</button>
                    )}
                    {user.status === "SUSPENDED" && (
                      <button onClick={() => handleUpdate(user.id, { status: "ACTIVE" })} style={{ padding: "4px 10px", borderRadius: "4px", background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", fontSize: "10px", cursor: "pointer" }}>Aktifkan</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <EditModal user={editingUser} onSave={(data) => handleUpdate(editingUser.id, data)} onClose={() => setEditingUser(null)} />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateModal onSave={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass-panel" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EditModal({ user, onSave, onClose }: { user: User; onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="glass-panel" style={{ padding: "24px", width: "400px", maxHeight: "80vh", overflow: "auto" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Edit User</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Nama
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }} />
          </label>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }} />
          </label>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Role
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }}>
              <option value="ADMIN">Admin</option>
              <option value="ADMIN_TPS">Admin TPS</option>
              <option value="BANK_SAMPAH">Bank Sampah</option>
              <option value="INDUSTRI">Industri</option>
              <option value="WARGA">Warga</option>
              <option value="UMKM">UMKM</option>
              <option value="DRIVER">Driver</option>
            </select>
          </label>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }}>
              <option value="ACTIVE">Aktif</option>
              <option value="PENDING_VERIFICATION">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REJECTED">Ditolak</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.12)", fontSize: "12px", cursor: "pointer" }}>Batal</button>
          <button onClick={() => onSave({ name, email, role, status })} style={{ padding: "8px 16px", borderRadius: "6px", background: "#3b82f6", color: "white", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Simpan</button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onSave, onClose }: { onSave: (data: any) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("WARGA");
  const [status, setStatus] = useState("ACTIVE");

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !password.trim()) return;
    onSave({ name, email, password, role, status });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="glass-panel" style={{ padding: "24px", width: "420px", maxHeight: "80vh", overflow: "auto" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Tambah Akun Baru</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Nama
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }} />
          </label>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@contoh.com" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }} />
          </label>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 karakter" style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }} />
          </label>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Role
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }}>
              <option value="ADMIN">Admin</option>
              <option value="ADMIN_TPS">Admin TPS</option>
              <option value="BANK_SAMPAH">Bank Sampah</option>
              <option value="INDUSTRI">Industri</option>
              <option value="WARGA">Warga</option>
              <option value="UMKM">UMKM</option>
              <option value="DRIVER">Driver</option>
            </select>
          </label>
          <label style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "12px", marginTop: "4px" }}>
              <option value="ACTIVE">Aktif</option>
              <option value="PENDING_VERIFICATION">Pending</option>
            </select>
          </label>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: "6px", background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.12)", fontSize: "12px", cursor: "pointer" }}>Batal</button>
          <button onClick={handleSubmit} style={{ padding: "8px 16px", borderRadius: "6px", background: "#10b981", color: "white", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Buat Akun</button>
        </div>
      </div>
    </div>
  );
}
