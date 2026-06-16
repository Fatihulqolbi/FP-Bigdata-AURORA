import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { useAuth } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import SkeletonLoader from "./features/marketplace/components/SkeletonLoader";
import {
  LayoutDashboard,
  Truck,
  Recycle,
  Settings,
  Bell,
  Server,
  Store,
  LogOut,
  Eye,
  EyeOff,
  MapPin,
  Users,
} from "lucide-react";
import MarketplaceLayout from "./features/marketplace/MarketplaceLayout";
import SettingsPage from "./pages/SettingsPage";
import TpsManagement from "./pages/TpsManagement";
import LogisticsPage from "./pages/LogisticsPage";
import RealtimeDashboard from "./features/monitoring/pages/RealtimeDashboard";
import DriverPage from "./pages/DriverPage";
import UserManagement from "./pages/UserManagement";
import PipelineDashboard from "./pages/PipelineDashboard";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import { TPS_DATA } from "./data/tpsData";
import type { TpsNode, TruckSim } from "./features/monitoring/pages/types";

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (user && user.role !== "ADMIN" && activeTab === "dashboard") {
      setActiveTab("marketplace");
    }
  }, [user]);

  const [liveTonnage, setLiveTonnage] = useState(1792);
  const [showCompactor, setShowCompactor] = useState(true);
  const [showDumpTruck, setShowDumpTruck] = useState(true);
  const [showArmRoll, setShowArmRoll] = useState(true);

  const [simState, setSimState] = useState(() => {
    const initialTps: TpsNode[] = TPS_DATA.map((tps) => {
      const startPercentage = 25 + Math.random() * 40;
      const volume = parseFloat(
        ((startPercentage / 100) * tps.capacity).toFixed(2)
      );

      let newStatus = "Aman";
      let newPredictedFull = "Besok Pagi";
      if (startPercentage >= 90) {
        newStatus = `Kritis (${startPercentage.toFixed(0)}%)`;
      } else if (startPercentage >= 75) {
        newStatus = `Warning (${startPercentage.toFixed(0)}%)`;
      } else {
        newStatus = `Aman (${startPercentage.toFixed(0)}%)`;
      }

      return {
        id: tps.id,
        tps: tps.name,
        area: tps.kecamatan,
        pos: [tps.lat, tps.lng] as [number, number],
        volume: volume,
        capacity: tps.capacity,
        status: newStatus,
        predicted_full: newPredictedFull,
      };
    });

    const benowoPos: [number, number] = [-7.234, 112.62];
    const initialTrucksList: TruckSim[] = [];
    let idCounter = 1;

    const distributeTruck = (truck: TruckSim) => {
      const rand = Math.random();
      if (rand < 0.3) {
        return truck;
      } else {
        const targetTps = TPS_DATA[Math.floor(Math.random() * TPS_DATA.length)];
        const tpsPos: [number, number] = [targetTps.lat, targetTps.lng];
        const progress = Math.random();

        if (rand < 0.65) {
          const curPos: [number, number] = [
            benowoPos[0] + progress * (tpsPos[0] - benowoPos[0]),
            benowoPos[1] + progress * (tpsPos[1] - benowoPos[1]),
          ];
          const angle =
            (Math.atan2(
              -(tpsPos[0] - benowoPos[0]),
              tpsPos[1] - benowoPos[1]
            ) *
              180) /
            Math.PI;
          return {
            ...truck,
            state: "to_tps",
            targetTpsId: targetTps.id,
            startPos: benowoPos,
            endPos: tpsPos,
            progress: progress,
            pos: curPos,
            angle: angle,
          };
        } else {
          const curPos: [number, number] = [
            tpsPos[0] + progress * (benowoPos[0] - tpsPos[0]),
            tpsPos[1] + progress * (benowoPos[1] - tpsPos[1]),
          ];
          const angle =
            (Math.atan2(
              -(benowoPos[0] - tpsPos[0]),
              benowoPos[1] - tpsPos[1]
            ) *
              180) /
            Math.PI;
          return {
            ...truck,
            state: "to_benowo",
            targetTpsId: targetTps.id,
            startPos: tpsPos,
            endPos: benowoPos,
            progress: progress,
            pos: curPos,
            angle: angle,
          };
        }
      }
    };

    for (let i = 0; i < 21; i++) {
      initialTrucksList.push(
        distributeTruck({
          id: idCounter++,
          type: "Compactor",
          capacity: 16,
          color: "#3b82f6",
          pos: benowoPos,
          targetTpsId: null,
          state: "idle",
          progress: 0,
          speed: 0.01 + Math.random() * 0.02,
          startPos: benowoPos,
          endPos: benowoPos,
          angle: 0,
        })
      );
    }

    for (let i = 0; i < 30; i++) {
      initialTrucksList.push(
        distributeTruck({
          id: idCounter++,
          type: "Dump Truck",
          capacity: 20,
          color: "#f59e0b",
          pos: benowoPos,
          targetTpsId: null,
          state: "idle",
          progress: 0,
          speed: 0.01 + Math.random() * 0.02,
          startPos: benowoPos,
          endPos: benowoPos,
          angle: 0,
        })
      );
    }

    for (let i = 0; i < 101; i++) {
      initialTrucksList.push(
        distributeTruck({
          id: idCounter++,
          type: "Arm Roll",
          capacity: 10,
          color: "#10b981",
          pos: benowoPos,
          targetTpsId: null,
          state: "idle",
          progress: 0,
          speed: 0.01 + Math.random() * 0.02,
          startPos: benowoPos,
          endPos: benowoPos,
          angle: 0,
        })
      );
    }

    return { tpsNodes: initialTps, trucks: initialTrucksList };
  });

  const tpsNodes = simState.tpsNodes;
  const trucks = simState.trucks;

  // Simulation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTonnage((prev) => prev + Math.floor(Math.random() * 2));

      setSimState((prev) => {
        const nextTps = prev.tpsNodes.map((row) => {
          const occupancy = row.volume / row.capacity;
          let genRate = 0.01 + Math.random() * 0.03;
          if (occupancy > 0.7) genRate = 0.001 + Math.random() * 0.005;
          else if (occupancy < 0.2) genRate = 0.02 + Math.random() * 0.04;
          const newVolume = Math.min(row.capacity, row.volume + genRate);
          return { ...row, volume: parseFloat(newVolume.toFixed(2)) };
        });

        const benowoPos: [number, number] = [-7.234, 112.62];
        const targetCounts: Record<number, number> = {};
        prev.trucks.forEach((t) => {
          if (t.state === "to_tps" && t.targetTpsId !== null) {
            targetCounts[t.targetTpsId] = (targetCounts[t.targetTpsId] || 0) + 1;
          }
        });

        const nextTrucks = prev.trucks.map((truck) => {
          if (truck.state === "idle") {
            const candidates = nextTps.filter((tps) => {
              const occupancy = tps.volume / tps.capacity;
              const activeTargets = targetCounts[tps.id] || 0;
              return occupancy > 0.25 && activeTargets < 1;
            });

            if (candidates.length > 0) {
              candidates.sort((a, b) => b.volume - a.volume);
              const selectedTps = candidates[0];
              targetCounts[selectedTps.id] = (targetCounts[selectedTps.id] || 0) + 1;

              const tpsPos: [number, number] = [selectedTps.pos[0], selectedTps.pos[1]];
              const angle =
                (Math.atan2(-(tpsPos[0] - benowoPos[0]), tpsPos[1] - benowoPos[1]) * 180) / Math.PI;

              return {
                ...truck,
                state: "to_tps",
                targetTpsId: selectedTps.id,
                startPos: benowoPos,
                endPos: tpsPos,
                progress: 0,
                pos: benowoPos,
                angle: angle,
              };
            }
            return truck;
          } else if (truck.state === "to_tps") {
            const nextProgress = truck.progress + truck.speed;
            if (nextProgress < 1) {
              const curPos: [number, number] = [
                truck.startPos[0] + nextProgress * (truck.endPos[0] - truck.startPos[0]),
                truck.startPos[1] + nextProgress * (truck.endPos[1] - truck.startPos[1]),
              ];
              return { ...truck, progress: nextProgress, pos: curPos };
            } else {
              const tpsIndex = nextTps.findIndex((t) => t.id === truck.targetTpsId);
              if (tpsIndex !== -1) {
                const targetTps = nextTps[tpsIndex];
                const collected = Math.min(targetTps.volume, truck.capacity);
                nextTps[tpsIndex] = {
                  ...targetTps,
                  volume: parseFloat(Math.max(0, targetTps.volume - collected).toFixed(2)),
                };
              }

              const angle =
                (Math.atan2(
                  -(benowoPos[0] - truck.endPos[0]),
                  benowoPos[1] - truck.endPos[1]
                ) * 180) / Math.PI;
              return {
                ...truck,
                state: "to_benowo",
                startPos: truck.endPos,
                endPos: benowoPos,
                progress: 0,
                pos: truck.endPos,
                angle: angle,
              };
            }
          } else if (truck.state === "to_benowo") {
            const nextProgress = truck.progress + truck.speed;
            if (nextProgress < 1) {
              const curPos: [number, number] = [
                truck.startPos[0] + nextProgress * (truck.endPos[0] - truck.startPos[0]),
                truck.startPos[1] + nextProgress * (truck.endPos[1] - truck.startPos[1]),
              ];
              return { ...truck, progress: nextProgress, pos: curPos };
            } else {
              setLiveTonnage((prevTonnage) => prevTonnage + truck.capacity);
              return {
                ...truck,
                state: "idle",
                targetTpsId: null,
                progress: 0,
                pos: benowoPos,
                angle: 0,
              };
            }
          }
          return truck;
        });

        const updatedTps = nextTps.map((row) => {
          const percentage = (row.volume / row.capacity) * 100;
          let newStatus = "Aman";
          let newPredictedFull = "Besok Pagi";

          if (percentage >= 90) {
            newStatus = `Kritis (${percentage.toFixed(0)}%)`;
            const minutesLeft = Math.max(5, Math.floor((100 - percentage) * 4));
            const time = new Date(new Date().getTime() + minutesLeft * 60000);
            newPredictedFull = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")} WIB`;
          } else if (percentage >= 75) {
            newStatus = `Warning (${percentage.toFixed(0)}%)`;
            const hoursLeft = Math.floor((100 - percentage) / 6);
            const time = new Date(new Date().getTime() + hoursLeft * 3600000);
            newPredictedFull = `${time.getHours().toString().padStart(2, "0")}:00 WIB`;
          } else {
            newStatus = `Aman (${percentage.toFixed(0)}%)`;
          }

          return { ...row, status: newStatus, predicted_full: newPredictedFull };
        });

        return { tpsNodes: updatedTps, trucks: nextTrucks };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Toaster position="top-right" theme="dark" richColors />
      <div className="animated-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      {authLoading ? (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "16px",
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ fontSize: "18px" }}>Memuat AURORA...</div>
          <SkeletonLoader width="200px" height="6px" borderRadius="3px" />
        </div>
      ) : !user ? (
        <LoginPage
          onLoginSuccess={(role) => {
            if (role === "ADMIN") setActiveTab("dashboard");
            else if (role === "DRIVER") setActiveTab("driver");
            else setActiveTab("marketplace");
          }}
        />
      ) : (
        <div className="dashboard-layout">
          {/* Sidebar */}
          <aside className="sidebar glass-panel">
            <div className="logo-container">
              <img
                src="/logo-aurora.png"
                alt="AURORA Logo"
                style={{ width: "40px", height: "40px", objectFit: "contain" }}
              />
              <div className="logo-text text-gradient">AURORA</div>
            </div>

            <nav className="nav-menu">
              {[
                { id: "dashboard", icon: LayoutDashboard, label: "Realtime Monitor" },
                { id: "logistics", icon: Truck, label: "Armada & Rute" },
                { id: "driver", icon: Truck, label: "Dashboard Supir" },
                { id: "sorting", icon: Recycle, label: "Sorting Hub" },
                { id: "pipeline", icon: Server, label: "Data Pipeline" },
                { id: "tps", icon: MapPin, label: "Manajemen TPS" },
                { id: "users", icon: Users, label: "Manajemen Akun" },
                { id: "marketplace", icon: Store, label: "Marketplace" },
                { id: "settings", icon: Settings, label: "Pengaturan" },
              ]
                .filter((item) => {
                  // DRIVER only sees driver + settings
                  if (user?.role === "DRIVER") return item.id === "driver" || item.id === "settings";
                  // ADMIN_TPS sees TPS management
                  if (item.id === "tps")
                    return (
                      user?.role === "ADMIN" ||
                      user?.role === "ADMIN_TPS" ||
                      user?.permissions?.includes("MANAGE_TPS")
                    );
                  // Hide driver from admin (driver has its own login)
                  if (item.id === "driver") return false;
                  // Users management only for ADMIN
                  if (item.id === "users") return user?.role === "ADMIN";
                  // ADMIN sees everything else
                  if (user?.role === "ADMIN") return true;
                  // Others see marketplace + settings
                  return item.id === "marketplace" || item.id === "settings";
                })
                .map((item) => (
                  <a
                    key={item.id}
                    className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </a>
                ))}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="main-content">
            <header className="header">
              <div>
                <h1>Monitoring Arus Sumber Daya</h1>
                <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>
                  Surabaya Waste Management System
                </p>
              </div>
              <div className="header-actions">
                <div className="status-badge glass-panel">
                  <div className="pulse"></div>
                  Pipeline Aktif (Spark & Kafka)
                </div>
                {user && (
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", padding: "0 8px" }}>
                    {user.name}
                  </span>
                )}
                {user?.role === "ADMIN" && activeTab === "marketplace" && (
                  <button
                    onClick={() => setDemoMode(!demoMode)}
                    title={demoMode ? "Demo Buyer aktif" : "Aktifkan Demo Buyer"}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      border: "1px solid var(--glass-border)",
                      background: demoMode ? "rgba(34,197,94,0.2)" : "transparent",
                      color: demoMode ? "var(--accent-green)" : "var(--text-secondary)",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {demoMode ? <Eye size={14} /> : <EyeOff size={14} />}
                    {demoMode ? "Demo ON" : "Demo"}
                  </button>
                )}
                <button
                  className="glass-panel"
                  style={{
                    padding: "10px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    border: "none",
                    color: "var(--text-primary)",
                  }}
                >
                  <Bell size={20} />
                </button>
                <button
                  className="glass-panel"
                  onClick={logout}
                  title="Keluar"
                  style={{
                    padding: "10px",
                    borderRadius: "50%",
                    cursor: "pointer",
                    border: "none",
                    color: "var(--text-secondary)",
                  }}
                >
                  <LogOut size={18} />
                </button>
              </div>
            </header>

            {/* M4: Realtime Monitor (extracted) */}
            {activeTab === "dashboard" && (
              <RealtimeDashboard
                tpsNodes={tpsNodes}
                trucks={trucks}
                liveTonnage={liveTonnage}
                showCompactor={showCompactor}
                showDumpTruck={showDumpTruck}
                showArmRoll={showArmRoll}
              />
            )}

            {/* M4: Armada & Rute with OSRM road-following routes */}
            {activeTab === "logistics" && <LogisticsPage />}

            {activeTab === "driver" && <DriverPage />}

            {activeTab === "marketplace" && <MarketplaceLayout demoMode={demoMode} />}

            {activeTab === "sorting" && (
              <div style={{ animation: "fadeIn 0.5s ease-in-out" }}>
                <div
                  className="glass-panel"
                  style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}
                >
                  <Recycle size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                  <h3 style={{ fontSize: "18px", color: "var(--text-primary)", marginBottom: "8px" }}>
                    Sorting Hub
                  </h3>
                  <p style={{ fontSize: "13px" }}>
                    Panel monitoring pusat pemilahan sampah akan tersedia di tahap selanjutnya.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "pipeline" && <PipelineDashboard />}

            {activeTab === "settings" && <SettingsPage />}

            {activeTab === "tps" && <TpsManagement />}

            {activeTab === "users" && <UserManagement />}
          </main>
        </div>
      )}
    </>
  );
}

export default App;
