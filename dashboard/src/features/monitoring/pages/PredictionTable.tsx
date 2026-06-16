import type { TpsNode } from "./types";

interface PredictionTableProps {
  data: TpsNode[];
}

const tps3rData = [
  { id: 1, name: "Super Depo Sutorejo", pos: [-7.265, 112.795] as [number, number], volume: 11.85, organik: 4.30, kertas: 0.54, plastik: 0.53, bahanLain: 0.56, jumlahDaurUlang: 1.63, jumlahTerolah: 5.93, residu: 5.92 },
  { id: 2, name: "PDU Jambangan", pos: [-7.315, 112.715] as [number, number], volume: 6.32, organik: 2.19, kertas: 0.21, plastik: 0.51, bahanLain: 0.11, jumlahDaurUlang: 0.83, jumlahTerolah: 3.02, residu: 3.31 },
  { id: 3, name: "Pemilahan Bratang", pos: [-7.295, 112.765] as [number, number], volume: 1.63, organik: 0.80, kertas: 0.01, plastik: 0.02, bahanLain: 0.00, jumlahDaurUlang: 0.03, jumlahTerolah: 0.83, residu: 0.80 },
  { id: 4, name: "TPS 3R Tambak Osowilangun", pos: [-7.225, 112.655] as [number, number], volume: 7.77, organik: 3.32, kertas: 0.85, plastik: 0.65, bahanLain: 0.49, jumlahDaurUlang: 1.99, jumlahTerolah: 5.31, residu: 2.46 },
  { id: 5, name: "TPS 3R Tenggilis", pos: [-7.325, 112.755] as [number, number], volume: 5.24, organik: 1.48, kertas: 0.23, plastik: 0.33, bahanLain: 0.12, jumlahDaurUlang: 0.69, jumlahTerolah: 2.17, residu: 3.07 },
  { id: 6, name: "TPS 3R Kedung Cowek", pos: [-7.215, 112.785] as [number, number], volume: 3.69, organik: 1.25, kertas: 0.15, plastik: 0.40, bahanLain: 0.11, jumlahDaurUlang: 0.66, jumlahTerolah: 1.90, residu: 1.78 },
  { id: 7, name: "TPS 3R Gunung Anyar", pos: [-7.335, 112.795] as [number, number], volume: 3.27, organik: 1.35, kertas: 0.01, plastik: 0.20, bahanLain: 0.15, jumlahDaurUlang: 0.37, jumlahTerolah: 1.72, residu: 1.55 },
  { id: 8, name: "TPS 3R Karang Pilang", pos: [-7.335, 112.695] as [number, number], volume: 2.57, organik: 1.36, kertas: 0.07, plastik: 0.11, bahanLain: 0.08, jumlahDaurUlang: 0.25, jumlahTerolah: 1.62, residu: 0.96 },
  { id: 9, name: "TPS 3R Waru Gunung", pos: [-7.345, 112.685] as [number, number], volume: 2.40, organik: 1.25, kertas: 0.06, plastik: 0.08, bahanLain: 0.06, jumlahDaurUlang: 0.20, jumlahTerolah: 1.45, residu: 0.95 },
  { id: 10, name: "TPS 3R Banjarsugihan", pos: [-7.255, 112.665] as [number, number], volume: 3.97, organik: 0.97, kertas: 0.26, plastik: 0.33, bahanLain: 0.32, jumlahDaurUlang: 0.91, jumlahTerolah: 1.88, residu: 2.09 },
];

export default function PredictionTable({ data }: PredictionTableProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "24px" }}>
      <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "18px", marginBottom: "4px", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ef4444", animation: "pulse 1.5s infinite" }}></div>
              Live AI Prediction: Kafka & Spark Streaming
            </h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Model didasarkan pada aggregasi <i>real-time payload</i> TPS (Volume, <i>Event</i>, Jam) melalui pipeline Hadoop & Spark.
            </p>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--glass-border)", color: "var(--text-secondary)", fontSize: "14px" }}>
              <th style={{ padding: "8px" }}>Nama TPS</th>
              <th style={{ padding: "8px" }}>Kecamatan</th>
              <th style={{ padding: "8px" }}>Volume Saat Ini</th>
              <th style={{ padding: "8px" }}>Kapasitas Maks</th>
              <th style={{ padding: "8px" }}>Status Peringatan</th>
              <th style={{ padding: "8px" }}>Sistem Prediksi Penuh</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: "14px" }}>
            {data
              .slice()
              .sort((a, b) => b.volume / b.capacity - a.volume / a.capacity)
              .slice(0, 15)
              .map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "8px", color: "var(--text-primary)" }}>{row.tps}</td>
                  <td style={{ padding: "8px", color: "var(--text-secondary)" }}>{row.area}</td>
                  <td style={{ padding: "8px", color: "var(--text-primary)", fontWeight: "bold" }}>{row.volume} Ton</td>
                  <td style={{ padding: "8px", color: "var(--text-secondary)" }}>{row.capacity} Ton</td>
                  <td style={{ padding: "8px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        background: row.status.includes("Kritis")
                          ? "rgba(239,68,68,0.2)"
                          : row.status.includes("Warning")
                            ? "rgba(245,158,11,0.2)"
                            : "rgba(34,197,94,0.2)",
                        color: row.status.includes("Kritis")
                          ? "#ef4444"
                          : row.status.includes("Warning")
                            ? "#f59e0b"
                            : "#22c55e",
                      }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "8px",
                      color: row.status.includes("Kritis") ? "#ef4444" : "var(--text-secondary)",
                      fontWeight: "bold",
                    }}
                  >
                    {row.predicted_full}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <div style={{ textAlign: "center", marginTop: "10px", fontSize: "12px", color: "var(--text-secondary)" }}>
          Menampilkan 15 TPS paling kritis dari total {data.length} lokasi.
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "20px", overflowX: "auto" }}>
        <h3 style={{ fontSize: "18px", marginBottom: "4px", color: "var(--text-primary)", textAlign: "center" }}>
          Tabel 2.2 Laporan Pemilahan Sampah (Ton/Hari) Tahun 2024
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "16px", textAlign: "center" }}>
          Sumber: Dinas Lingkungan Hidup Kota Surabaya, 2024
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-secondary)" }}>
              <th rowSpan={2} style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>NO.</th>
              <th rowSpan={2} style={{ padding: "10px", border: "1px solid var(--glass-border)", textAlign: "left" }}>LOKASI FASILITAS</th>
              <th rowSpan={2} style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>SAMPAH MASUK</th>
              <th colSpan={6} style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>SAMPAH TEROLAH</th>
              <th rowSpan={2} style={{ padding: "10px", border: "1px solid var(--glass-border)", color: "#ef4444" }}>RESIDU</th>
            </tr>
            <tr style={{ background: "rgba(255,255,255,0.02)", color: "var(--text-secondary)" }}>
              <th style={{ padding: "8px", border: "1px solid var(--glass-border)" }}>ORGANIK</th>
              <th style={{ padding: "8px", border: "1px solid var(--glass-border)" }}>KERTAS</th>
              <th style={{ padding: "8px", border: "1px solid var(--glass-border)" }}>PLASTIK</th>
              <th style={{ padding: "8px", border: "1px solid var(--glass-border)" }}>BHN LAIN</th>
              <th style={{ padding: "8px", border: "1px solid var(--glass-border)" }}>JUMLAH D.U.</th>
              <th style={{ padding: "8px", border: "1px solid var(--glass-border)", color: "var(--accent-green)" }}>JML TEROLAH</th>
            </tr>
          </thead>
          <tbody>
            {tps3rData.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "8px", borderLeft: "1px solid var(--glass-border)", borderRight: "1px solid var(--glass-border)" }}>{i + 1}</td>
                <td style={{ padding: "8px", textAlign: "left", borderRight: "1px solid var(--glass-border)", color: "var(--text-primary)" }}>{row.name}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)" }}>{row.volume.toFixed(2).replace(".", ",")}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)" }}>{row.organik.toFixed(2).replace(".", ",")}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)" }}>{row.kertas.toFixed(2).replace(".", ",")}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)" }}>{row.plastik.toFixed(2).replace(".", ",")}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)" }}>{row.bahanLain.toFixed(2).replace(".", ",")}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)" }}>{row.jumlahDaurUlang.toFixed(2).replace(".", ",")}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)", color: "var(--accent-green)", fontWeight: "bold" }}>{row.jumlahTerolah.toFixed(2).replace(".", ",")}</td>
                <td style={{ padding: "8px", borderRight: "1px solid var(--glass-border)", color: "#ef4444" }}>{row.residu.toFixed(2).replace(".", ",")}</td>
              </tr>
            ))}
            <tr style={{ background: "rgba(255,255,255,0.05)", fontWeight: "bold", color: "var(--text-primary)" }}>
              <td colSpan={2} style={{ padding: "10px", textAlign: "center", border: "1px solid var(--glass-border)" }}>J U M L A H</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>48,71</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>18,28</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>2,39</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>3,15</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>2,01</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)" }}>7,55</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)", color: "var(--accent-green)" }}>25,83</td>
              <td style={{ padding: "10px", border: "1px solid var(--glass-border)", color: "#ef4444" }}>22,88</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
