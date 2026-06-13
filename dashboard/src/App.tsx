import { useState, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  LayoutDashboard, Truck, Recycle, Settings, Bell, 
  TrendingUp, Server
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
import { TPS_DATA } from './data/tpsData';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const getTruckImageIcon = (type: string, angle: number) => {
  let imgUrl = '/Referensi/3.png'; // default Compactor (blue)
  if (type === 'Arm Roll') imgUrl = '/Referensi/1.png'; // green
  else if (type === 'Dump Truck') imgUrl = '/Referensi/2.png'; // orange
  
  return new L.DivIcon({
    html: `<div style="width: 52px; height: 38px; display: flex; align-items: center; justify-content: center;">
             <img src="${imgUrl}" style="width: 48px; height: 34px; object-fit: contain; transform: rotate(${angle + 180}deg); transition: transform 0.5s ease-in-out; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));" />
           </div>`,
    className: 'truck-marker-custom',
    iconSize: [52, 38],
    iconAnchor: [26, 19]
  });
};



const tpsIcon = new L.DivIcon({
  html: `<div style="background-color: #fde047; width: 8px; height: 8px; border-radius: 50%; border: 1px solid #450a0a;"></div>`,
  className: 'tps-marker'
});

const tps3rIcon = new L.DivIcon({
  html: `<div style="background-color: #d946ef; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px #d946ef;"></div>`,
  className: 'tps3r-marker'
});

const pltsaIcon = new L.DivIcon({
  html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #ef4444; position: relative;">
           <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%; border: 2px solid #ef4444; animation: pulse 2s infinite;"></div>
         </div>`,
  className: 'pltsa-marker'
});

const WeatherCard = () => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState<{ temp: number, condition: string, icon: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch('https://api.openweathermap.org/data/2.5/weather?q=Surabaya&units=metric&appid=747f88191af5092eea65dcb7786af771')
      .then(res => {
        if (!res.ok) throw new Error('API Key invalid or inactive');
        return res.json();
      })
      .then(data => {
        if(data && data.main) {
          setWeather({
            temp: Math.round(data.main.temp),
            condition: data.weather[0].main,
            icon: data.weather[0].icon
          });
        }
      })
      .catch(err => {
        console.error("OpenWeather API Error:", err.message);
        // Fallback data untuk menjaga presentasi tetap berjalan lancar jika API Key belum aktif
        setWeather({
          temp: 32,
          condition: 'Cerah',
          icon: '01d'
        });
      });
  }, []);

  return (
    <div className="card">
      <div className="info-section">
        <div className="left-side">
          <div className="weather">
            <div>
              {weather ? (
                <img src={`https://openweathermap.org/img/wn/${weather.icon}.png`} alt="weather icon" style={{ width: '24px', height: '24px', filter: 'brightness(0) invert(1)' }} />
              ) : (
                <svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={{width: '24px', height: '24px'}}>
                   <path d="M5.5 16a3.5 3.5 0 01-.369-6.98 4 4 0 117.759-1.549 3.5 3.5 0 11-7.39 8.529z" />
                </svg>
              )}
            </div>
            <div>{weather ? weather.condition : 'Memuat'}</div>
          </div>
          <div className="temperature">{weather ? `${weather.temp}°` : '--°'}</div>
        </div>
        <div className="right-side">
          <div>
            <div className="hour">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="date">{time.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          </div>
          <div>Surabaya</div>
        </div>
        <div className="background-design">
          <div className="circle"></div>
          <div className="circle"></div>
          <div className="circle"></div>
        </div>
      </div>
      <div className="days-section">
        <button><div className="day">HARI INI</div></button>
        <button><div className="day">BESOK</div></button>
      </div>
    </div>
  );
};

const dataFlow = [
  { time: '08:00', tps: 120, hub: 90, optimal: 50 },
  { time: '10:00', tps: 250, hub: 180, optimal: 120 },
  { time: '12:00', tps: 400, hub: 300, optimal: 250 },
  { time: '14:00', tps: 380, hub: 350, optimal: 300 },
  { time: '16:00', tps: 520, hub: 420, optimal: 380 },
  { time: '18:00', tps: 480, hub: 450, optimal: 420 },
  { time: '20:00', tps: 200, hub: 380, optimal: 450 },
];

const activities = [
  { id: 1, title: 'Kafka Stream: 500+ events/sec', time: 'Just now', icon: 'K', status: 'success' },
  { id: 2, title: 'Truk B-1234 sampai di Sorting Hub', time: '5 min ago', icon: 'T', status: 'success' },
  { id: 3, title: 'HDFS Storage threshold 80%', time: '15 min ago', icon: 'H', status: 'warning' },
  { id: 4, title: 'Spark Job: Aggregation Complete', time: '1 hour ago', icon: 'S', status: 'success' },
];

// Using state for real-time dishubData instead of static array
// See component body for the stateful version

const tps3rData = [
  { id: 1, name: 'Super Depo Sutorejo', pos: [-7.265, 112.795] as [number, number], volume: 11.85, organik: 4.30, kertas: 0.54, plastik: 0.53, bahanLain: 0.56, jumlahDaurUlang: 1.63, jumlahTerolah: 5.93, residu: 5.92 },
  { id: 2, name: 'PDU Jambangan', pos: [-7.315, 112.715] as [number, number], volume: 6.32, organik: 2.19, kertas: 0.21, plastik: 0.51, bahanLain: 0.11, jumlahDaurUlang: 0.83, jumlahTerolah: 3.02, residu: 3.31 },
  { id: 3, name: 'Pemilahan Bratang', pos: [-7.295, 112.765] as [number, number], volume: 1.63, organik: 0.80, kertas: 0.01, plastik: 0.02, bahanLain: 0.00, jumlahDaurUlang: 0.03, jumlahTerolah: 0.83, residu: 0.80 },
  { id: 4, name: 'TPS 3R Tambak Osowilangun', pos: [-7.225, 112.655] as [number, number], volume: 7.77, organik: 3.32, kertas: 0.85, plastik: 0.65, bahanLain: 0.49, jumlahDaurUlang: 1.99, jumlahTerolah: 5.31, residu: 2.46 },
  { id: 5, name: 'TPS 3R Tenggilis', pos: [-7.325, 112.755] as [number, number], volume: 5.24, organik: 1.48, kertas: 0.23, plastik: 0.33, bahanLain: 0.12, jumlahDaurUlang: 0.69, jumlahTerolah: 2.17, residu: 3.07 },
  { id: 6, name: 'TPS 3R Kedung Cowek', pos: [-7.215, 112.785] as [number, number], volume: 3.69, organik: 1.25, kertas: 0.15, plastik: 0.40, bahanLain: 0.11, jumlahDaurUlang: 0.66, jumlahTerolah: 1.90, residu: 1.78 },
  { id: 7, name: 'TPS 3R Gunung Anyar', pos: [-7.335, 112.795] as [number, number], volume: 3.27, organik: 1.35, kertas: 0.01, plastik: 0.20, bahanLain: 0.15, jumlahDaurUlang: 0.37, jumlahTerolah: 1.72, residu: 1.55 },
  { id: 8, name: 'TPS 3R Karang Pilang', pos: [-7.335, 112.695] as [number, number], volume: 2.57, organik: 1.36, kertas: 0.07, plastik: 0.11, bahanLain: 0.08, jumlahDaurUlang: 0.25, jumlahTerolah: 1.62, residu: 0.96 },
  { id: 9, name: 'TPS 3R Waru Gunung', pos: [-7.345, 112.685] as [number, number], volume: 2.40, organik: 1.25, kertas: 0.06, plastik: 0.08, bahanLain: 0.06, jumlahDaurUlang: 0.20, jumlahTerolah: 1.45, residu: 0.95 },
  { id: 10, name: 'TPS 3R Banjarsugihan', pos: [-7.255, 112.665] as [number, number], volume: 3.97, organik: 0.97, kertas: 0.26, plastik: 0.33, bahanLain: 0.32, jumlahDaurUlang: 0.91, jumlahTerolah: 1.88, residu: 2.09 },
];



const truckTypes = [
  { name: 'Compactor', value: 21, color: '#3b82f6' },
  { name: 'Dump Truck', value: 30, color: '#f59e0b' },
  { name: 'Arm Roll', value: 101, color: '#10b981' },
];

const capaianData = [
  { name: 'Penanganan Sampah', value: 91.71, color: '#0ea5e9' },
  { name: 'Pengurangan Sampah', value: 7.43, color: '#eab308' },
  { name: 'Terbuang', value: 0.86, color: '#ef4444' },
];

const jenisSampahData = [
  { name: 'Sisa Makanan', value: 55.5, color: '#3b82f6' },
  { name: 'Plastik', value: 22.0, color: '#22c55e' },
  { name: 'Kayu/Ranting', value: 9.4, color: '#ef4444' },
  { name: 'Lainnya', value: 13.1, color: '#8b5cf6' },
];

const sumberSampahData = [
  { name: 'Rumah Tangga', value: 85.2, color: '#3b82f6' },
  { name: 'Pasar Tradisional', value: 7.2, color: '#f59e0b' },
  { name: 'Lainnya', value: 7.6, color: '#8b5cf6' },
];

const PredictionTable = ({ data }: { data: any[] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
    <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }}></div>
            Live AI Prediction: Kafka & Spark Streaming
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Model didasarkan pada aggregasi <i>real-time payload</i> TPS (Volume, <i>Event</i>, Jam) melalui pipeline Hadoop & Spark.</p>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <th style={{ padding: '8px' }}>Nama TPS</th>
            <th style={{ padding: '8px' }}>Kecamatan</th>
            <th style={{ padding: '8px' }}>Volume Saat Ini</th>
            <th style={{ padding: '8px' }}>Kapasitas Maks</th>
            <th style={{ padding: '8px' }}>Status Peringatan</th>
            <th style={{ padding: '8px' }}>Sistem Prediksi Penuh</th>
          </tr>
        </thead>
        <tbody style={{ fontSize: '14px' }}>
          {data.slice().sort((a,b) => (b.volume/b.capacity) - (a.volume/a.capacity)).slice(0, 15).map((row) => (
            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{row.tps}</td>
              <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{row.area}</td>
              <td style={{ padding: '8px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{row.volume} Ton</td>
              <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{row.capacity} Ton</td>
              <td style={{ padding: '8px' }}>
                <span style={{ 
                  padding: '4px 8px', borderRadius: '12px', fontSize: '11px',
                  background: row.status.includes('Kritis') ? 'rgba(239,68,68,0.2)' : row.status.includes('Warning') ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)',
                  color: row.status.includes('Kritis') ? '#ef4444' : row.status.includes('Warning') ? '#f59e0b' : '#22c55e'
                }}>
                  {row.status}
                </span>
              </td>
              <td style={{ padding: '8px', color: row.status.includes('Kritis') ? '#ef4444' : 'var(--text-secondary)', fontWeight: 'bold' }}>{row.predicted_full}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>Menampilkan 15 TPS paling kritis dari total {data.length} lokasi.</div>
    </div>
    
    <div className="glass-panel" style={{ padding: '20px', overflowX: 'auto' }}>
      <h3 style={{ fontSize: '18px', marginBottom: '4px', color: 'var(--text-primary)', textAlign: 'center' }}>Tabel 2.2 Laporan Pemilahan Sampah (Ton/Hari) Tahun 2024</h3>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', textAlign: 'center' }}>Sumber: Dinas Lingkungan Hidup Kota Surabaya, 2024</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
            <th rowSpan={2} style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>NO.</th>
            <th rowSpan={2} style={{ padding: '10px', border: '1px solid var(--glass-border)', textAlign: 'left' }}>LOKASI FASILITAS</th>
            <th rowSpan={2} style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>SAMPAH MASUK</th>
            <th colSpan={6} style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>SAMPAH TEROLAH</th>
            <th rowSpan={2} style={{ padding: '10px', border: '1px solid var(--glass-border)', color: '#ef4444' }}>RESIDU</th>
          </tr>
          <tr style={{ background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)' }}>
            <th style={{ padding: '8px', border: '1px solid var(--glass-border)' }}>ORGANIK</th>
            <th style={{ padding: '8px', border: '1px solid var(--glass-border)' }}>KERTAS</th>
            <th style={{ padding: '8px', border: '1px solid var(--glass-border)' }}>PLASTIK</th>
            <th style={{ padding: '8px', border: '1px solid var(--glass-border)' }}>BHN LAIN</th>
            <th style={{ padding: '8px', border: '1px solid var(--glass-border)' }}>JUMLAH D.U.</th>
            <th style={{ padding: '8px', border: '1px solid var(--glass-border)', color: 'var(--accent-green)' }}>JML TEROLAH</th>
          </tr>
        </thead>
        <tbody>
          {tps3rData.map((row, i) => (
            <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <td style={{ padding: '8px', borderLeft: '1px solid var(--glass-border)', borderRight: '1px solid var(--glass-border)' }}>{i + 1}</td>
              <td style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}>{row.name}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{row.volume.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{row.organik.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{row.kertas.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{row.plastik.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{row.bahanLain.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)' }}>{row.jumlahDaurUlang.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: 'var(--accent-green)', fontWeight: 'bold' }}>{row.jumlahTerolah.toFixed(2).replace('.', ',')}</td>
              <td style={{ padding: '8px', borderRight: '1px solid var(--glass-border)', color: '#ef4444' }}>{row.residu.toFixed(2).replace('.', ',')}</td>
            </tr>
          ))}
          <tr style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            <td colSpan={2} style={{ padding: '10px', textAlign: 'center', border: '1px solid var(--glass-border)' }}>J U M L A H</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>48,71</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>18,28</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>2,39</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>3,15</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>2,01</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)' }}>7,55</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)', color: 'var(--accent-green)' }}>25,83</td>
            <td style={{ padding: '10px', border: '1px solid var(--glass-border)', color: '#ef4444' }}>22,88</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [liveTonnage, setLiveTonnage] = useState(1792); // Base on Surabaya data
  const [showCompactor, setShowCompactor] = useState(true);
  const [showDumpTruck, setShowDumpTruck] = useState(true);
  const [showArmRoll, setShowArmRoll] = useState(true);

  const [simState, setSimState] = useState(() => {
    const initialTps = TPS_DATA.map((tps) => {
      const startPercentage = 25 + Math.random() * 40; // start between 25% and 65%
      const volume = parseFloat(((startPercentage / 100) * tps.capacity).toFixed(2));
      
      let newStatus = 'Aman';
      let newPredictedFull = 'Besok Pagi';
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
        predicted_full: newPredictedFull
      };
    });

    const benowoPos: [number, number] = [-7.234, 112.620];
    const initialTrucksList: any[] = [];
    let idCounter = 1;

    // Helper to distribute trucks across states at start
    const distributeTruck = (truck: any) => {
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
            benowoPos[1] + progress * (tpsPos[1] - benowoPos[1])
          ];
          const angle = Math.atan2(-(tpsPos[0] - benowoPos[0]), tpsPos[1] - benowoPos[1]) * 180 / Math.PI;
          return {
            ...truck,
            state: 'to_tps',
            targetTpsId: targetTps.id,
            startPos: benowoPos,
            endPos: tpsPos,
            progress: progress,
            pos: curPos,
            angle: angle
          };
        } else {
          const curPos: [number, number] = [
            tpsPos[0] + progress * (benowoPos[0] - tpsPos[0]),
            tpsPos[1] + progress * (benowoPos[1] - tpsPos[1])
          ];
          const angle = Math.atan2(-(benowoPos[0] - tpsPos[0]), benowoPos[1] - tpsPos[1]) * 180 / Math.PI;
          return {
            ...truck,
            state: 'to_benowo',
            targetTpsId: targetTps.id,
            startPos: tpsPos,
            endPos: benowoPos,
            progress: progress,
            pos: curPos,
            angle: angle
          };
        }
      }
    };

    // 21 Compactors
    for (let i = 0; i < 21; i++) {
      initialTrucksList.push(distributeTruck({
        id: idCounter++,
        type: 'Compactor',
        capacity: 16,
        color: '#3b82f6',
        pos: benowoPos,
        targetTpsId: null,
        state: 'idle',
        progress: 0,
        speed: 0.01 + Math.random() * 0.02,
        startPos: benowoPos,
        endPos: benowoPos,
        angle: 0
      }));
    }

    // 30 Dump Trucks
    for (let i = 0; i < 30; i++) {
      initialTrucksList.push(distributeTruck({
        id: idCounter++,
        type: 'Dump Truck',
        capacity: 20,
        color: '#f59e0b',
        pos: benowoPos,
        targetTpsId: null,
        state: 'idle',
        progress: 0,
        speed: 0.01 + Math.random() * 0.02,
        startPos: benowoPos,
        endPos: benowoPos,
        angle: 0
      }));
    }

    // 101 Arm Rolls
    for (let i = 0; i < 101; i++) {
      initialTrucksList.push(distributeTruck({
        id: idCounter++,
        type: 'Arm Roll',
        capacity: 10,
        color: '#10b981',
        pos: benowoPos,
        targetTpsId: null,
        state: 'idle',
        progress: 0,
        speed: 0.01 + Math.random() * 0.02,
        startPos: benowoPos,
        endPos: benowoPos,
        angle: 0
      }));
    }

    return { tpsNodes: initialTps, trucks: initialTrucksList };
  });

  const tpsNodes = simState.tpsNodes;
  const trucks = simState.trucks;

  const filteredTrucks = trucks.filter(truck => {
    if (truck.type === 'Compactor') return showCompactor;
    if (truck.type === 'Dump Truck') return showDumpTruck;
    if (truck.type === 'Arm Roll') return showArmRoll;
    return true;
  });

  // Simulated streaming closed-loop logic for waste generation & truck logistics
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveTonnage(prev => prev + Math.floor(Math.random() * 2));

      setSimState(prev => {
        // Step 1: Accumulate waste slowly on all TPS nodes
        const nextTps = prev.tpsNodes.map(row => {
          const occupancy = row.volume / row.capacity;
          
          // Closed-loop balance adjustment
          let genRate = 0.01 + Math.random() * 0.03; // Average 0.02 Ton
          if (occupancy > 0.70) {
            genRate = 0.001 + Math.random() * 0.005; // Slow down when nearly full
          } else if (occupancy < 0.20) {
            genRate = 0.02 + Math.random() * 0.04; // Speed up when nearly empty
          }

          const newVolume = Math.min(row.capacity, row.volume + genRate);
          return { ...row, volume: parseFloat(newVolume.toFixed(2)) };
        });

        // Step 2: Update trucks logistics and perform waste collection
        const benowoPos: [number, number] = [-7.234, 112.620];
        
        // Count how many trucks are currently targeted towards each TPS
        const targetCounts: Record<number, number> = {};
        prev.trucks.forEach(t => {
          if (t.state === 'to_tps' && t.targetTpsId !== null) {
            targetCounts[t.targetTpsId] = (targetCounts[t.targetTpsId] || 0) + 1;
          }
        });

        const nextTrucks = prev.trucks.map(truck => {
          if (truck.state === 'idle') {
            // Find candidates with > 25% occupancy and targeted by < 1 truck to spread them out
            const candidates = nextTps.filter(tps => {
              const occupancy = tps.volume / tps.capacity;
              const activeTargets = targetCounts[tps.id] || 0;
              return occupancy > 0.25 && activeTargets < 1;
            });

            if (candidates.length > 0) {
              // Prioritize the top fullest candidates
              candidates.sort((a, b) => b.volume - a.volume);
              const selectedTps = candidates[0];

              // Mark this TPS as targeted
              targetCounts[selectedTps.id] = (targetCounts[selectedTps.id] || 0) + 1;

              const tpsPos: [number, number] = [selectedTps.pos[0], selectedTps.pos[1]];
              const angle = Math.atan2(-(tpsPos[0] - benowoPos[0]), tpsPos[1] - benowoPos[1]) * 180 / Math.PI;

              return {
                ...truck,
                state: 'to_tps',
                targetTpsId: selectedTps.id,
                startPos: benowoPos,
                endPos: tpsPos,
                progress: 0,
                pos: benowoPos,
                angle: angle
              };
            }
            return truck; // Stay idle
          } else if (truck.state === 'to_tps') {
            const nextProgress = truck.progress + truck.speed;
            if (nextProgress < 1) {
              const curPos: [number, number] = [
                truck.startPos[0] + nextProgress * (truck.endPos[0] - truck.startPos[0]),
                truck.startPos[1] + nextProgress * (truck.endPos[1] - truck.startPos[1])
              ];
              return {
                ...truck,
                progress: nextProgress,
                pos: curPos
              };
            } else {
              // Arrived at TPS! Collect waste up to capacity
              const tpsIndex = nextTps.findIndex(t => t.id === truck.targetTpsId);
              if (tpsIndex !== -1) {
                const targetTps = nextTps[tpsIndex];
                const collected = Math.min(targetTps.volume, truck.capacity);

                nextTps[tpsIndex] = {
                  ...targetTps,
                  volume: parseFloat(Math.max(0, targetTps.volume - collected).toFixed(2))
                };
              }

              // Turn around heading to Benowo
              const angle = Math.atan2(-(benowoPos[0] - truck.endPos[0]), benowoPos[1] - truck.endPos[1]) * 180 / Math.PI;
              return {
                ...truck,
                state: 'to_benowo',
                startPos: truck.endPos,
                endPos: benowoPos,
                progress: 0,
                pos: truck.endPos,
                angle: angle
              };
            }
          } else if (truck.state === 'to_benowo') {
            const nextProgress = truck.progress + truck.speed;
            if (nextProgress < 1) {
              const curPos: [number, number] = [
                truck.startPos[0] + nextProgress * (truck.endPos[0] - truck.startPos[0]),
                truck.startPos[1] + nextProgress * (truck.endPos[1] - truck.startPos[1])
              ];
              return {
                ...truck,
                progress: nextProgress,
                pos: curPos
              };
            } else {
              // Arrived at Benowo! Add waste to live tonnage
              setLiveTonnage(prevTonnage => prevTonnage + truck.capacity);

              return {
                ...truck,
                state: 'idle',
                targetTpsId: null,
                progress: 0,
                pos: benowoPos,
                angle: 0
              };
            }
          }
          return truck;
        });

        // Step 3: Recalculate status and predicted full time for all TPS nodes
        const updatedTps = nextTps.map(row => {
          const percentage = (row.volume / row.capacity) * 100;
          let newStatus = 'Aman';
          let newPredictedFull = 'Besok Pagi';

          if (percentage >= 90) {
            newStatus = `Kritis (${percentage.toFixed(0)}%)`;
            const minutesLeft = Math.max(5, Math.floor((100 - percentage) * 4));
            const time = new Date(new Date().getTime() + minutesLeft * 60000);
            newPredictedFull = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')} WIB`;
          } else if (percentage >= 75) {
            newStatus = `Warning (${percentage.toFixed(0)}%)`;
            const hoursLeft = Math.floor((100 - percentage) / 6);
            const time = new Date(new Date().getTime() + hoursLeft * 3600000);
            newPredictedFull = `${time.getHours().toString().padStart(2, '0')}:00 WIB`;
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
      <div className="animated-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="sidebar glass-panel">
          <div className="logo-container">
            <img src="/logo-aurora.png" alt="AURORA Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <div className="logo-text text-gradient">AURORA</div>
          </div>
          
          <nav className="nav-menu">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Realtime Monitor' },
              { id: 'logistics', icon: Truck, label: 'Armada & Rute' },
              { id: 'sorting', icon: Recycle, label: 'Sorting Hub' },
              { id: 'pipeline', icon: Server, label: 'Data Pipeline' },
              { id: 'settings', icon: Settings, label: 'Pengaturan' },
            ].map(item => (
              <a 
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
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
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Surabaya Waste Management System</p>
            </div>
            <div className="header-actions">
              <div className="status-badge glass-panel">
                <div className="pulse"></div>
                Pipeline Aktif (Spark & Kafka)
              </div>
              <button className="glass-panel" style={{ padding: '10px', borderRadius: '50%', cursor: 'pointer', border: 'none', color: 'var(--text-primary)' }}>
                <Bell size={20} />
              </button>
            </div>
          </header>
        {activeTab === 'dashboard' && (
          <>
            <PredictionTable data={tpsNodes} />

            <div className="stats-grid">
              <WeatherCard />
              <div className="stat-card glass-panel" style={{ padding: '20px' }}>
                <div className="stat-header">
                  <span>Total Timbulan Hari Ini</span>
                </div>
              <div className="stat-value" style={{ fontSize: '28px' }}>{liveTonnage.toLocaleString()} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ton</span></div>
              <div className="stat-change change-positive" style={{ marginTop: 'auto' }}>
                <TrendingUp size={16} /> +2.4% dari kemarin
              </div>
            </div>
            
            <div className="stat-card glass-panel" style={{ padding: '20px' }}>
              <div className="stat-header">
                <span>Total TPS Tersebar</span>
              </div>
              <div className="stat-value text-gradient" style={{ fontSize: '28px' }}>{tpsNodes.length} <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Lokasi</span></div>
              <div className="stat-change change-positive" style={{ marginTop: 'auto' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Surabaya mencakup 10 TPS3R Aktif</span>
              </div>
            </div>

            <div className="stat-card glass-panel" style={{ padding: '20px' }}>
              <div className="stat-header">
                <span>Total Truk Aktif (DKRTH)</span>
              </div>
              <div className="stat-value" style={{ fontSize: '28px' }}>152 <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Unit</span></div>
              <div className="stat-change change-positive" style={{ marginTop: 'auto' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Arm Roll, Compactor, & Dump Truck</span>
              </div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-card glass-panel">
              <div className="chart-title">Resource Flow (Sampah → TPS → Hub → Optimal)</div>
              <div style={{ height: '300px', width: '100%' }}>
                <ResponsiveContainer width="99%" height="100%">
                  <AreaChart data={dataFlow} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTps" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorHub" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOpt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-dark)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="tps" name="TPS Transit" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTps)" />
                    <Area type="monotone" dataKey="hub" name="Sorting Hub" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHub)" />
                    <Area type="monotone" dataKey="optimal" name="Fasilitas Optimal (PLTSa/Daur Ulang)" stroke="#10b981" fillOpacity={1} fill="url(#colorOpt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card glass-panel">
              <div className="chart-title">Armada Pengangkut Sampah (DKRTH 2025)</div>
              <div style={{ height: '220px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <ResponsiveContainer width="99%" height="100%">
                  <PieChart>
                    <Pie
                      data={truckTypes}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => percent !== undefined ? `${name} (${(percent * 100).toFixed(0)}%)` : name}
                      labelLine={false}
                      isAnimationActive={false}
                    >
                      {truckTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-dark)', border: 'none', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <img src="/Referensi/Dump Truck.png" alt="Dump Truck" style={{ width: '70px', height: '50px', objectFit: 'contain', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px', border: '1px solid var(--glass-border)' }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Dump Truck (20 Ton)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <img src="/Referensi/Compactor.png" alt="Compactor" style={{ width: '70px', height: '50px', objectFit: 'contain', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px', border: '1px solid var(--glass-border)' }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Compactor (16 Ton)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <img src="/Referensi/ArmRoll.png" alt="Arm Roll" style={{ width: '70px', height: '50px', objectFit: 'contain', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px', border: '1px solid var(--glass-border)' }} />
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Arm Roll (10 Ton)</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '16px' }}>
                Sumber: Dinas Kebersihan dan Pertamanan, 2025
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '24px', marginTop: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '4px', color: 'var(--text-primary)' }}>Data Timbulan & Komposisi Sampah (Surabaya 2024)</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Sumber: https://sipsn.kemenlh.go.id/, 2025</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              <div className="chart-card glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px' }}>
                <div className="chart-title" style={{ fontSize: '14px', textAlign: 'center' }}>Capaian Pengelolaan</div>
                <div style={{ height: '180px' }}>
                  <ResponsiveContainer width="99%" height="100%">
                    <PieChart>
                      <Pie data={capaianData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ value }) => `${value}%`} labelLine={false} isAnimationActive={false}>
                        {capaianData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-dark)', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>Timbulan Sampah: 660.946 Ton/Tahun</div>
              </div>

              <div className="chart-card glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px' }}>
                <div className="chart-title" style={{ fontSize: '14px', textAlign: 'center' }}>Komposisi Berdasarkan Jenis</div>
                <div style={{ height: '180px' }}>
                  <ResponsiveContainer width="99%" height="100%">
                    <PieChart>
                      <Pie data={jenisSampahData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ value }) => `${value}%`} labelLine={false} isAnimationActive={false}>
                        {jenisSampahData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-dark)', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>Mayoritas Sisa Makanan (55.5%)</div>
              </div>

              <div className="chart-card glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '16px' }}>
                <div className="chart-title" style={{ fontSize: '14px', textAlign: 'center' }}>Komposisi Berdasarkan Sumber</div>
                <div style={{ height: '180px' }}>
                  <ResponsiveContainer width="99%" height="100%">
                    <PieChart>
                      <Pie data={sumberSampahData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ value }) => `${value}%`} labelLine={false} isAnimationActive={false}>
                        {sumberSampahData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: 'var(--bg-dark)', border: 'none', borderRadius: '8px', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>Mayoritas Rumah Tangga (85.2%)</div>
              </div>
            </div>
          </div>

          <div className="charts-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
             <div className="chart-card glass-panel">
                <div className="chart-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Live Data Pipeline (Kafka & Spark)
                  <span className="status-success" style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px' }}>Active</span>
                </div>
                <div className="recent-activity">
                  {activities.map(activity => (
                    <div key={activity.id} className="activity-item">
                      <div className="activity-icon" style={{ 
                        background: activity.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)' 
                      }}>
                        {activity.icon}
                      </div>
                      <div className="activity-details">
                        <div className="activity-title">{activity.title}</div>
                        <div className="activity-time">{activity.time}</div>
                      </div>
                      <div className={`activity-status status-${activity.status}`}>
                        {activity.status === 'success' ? 'OK' : 'Warn'}
                      </div>
                    </div>
                  ))}
                </div>
             </div>
             <div className="chart-card glass-panel" style={{ padding: '24px 24px 24px 24px', display: 'flex', flexDirection: 'column' }}>
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Peta Persebaran {tpsNodes.length} TPS & 10 TPS3R (Surabaya)
                  <span className="status-success" style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', marginLeft: 'auto' }}>Live Map Tracking</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', border: '1px solid white' }}></div> PLTSa Benowo (Pusat)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fde047', border: '1px solid #450a0a' }}></div> TPS ({tpsNodes.length})</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d946ef', border: '1px solid white' }}></div> TPS3R (10)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#3b82f6' }}></div> Compactor (21)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b' }}></div> Dump Truck (30)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }}></div> Arm Roll (101)</div>
                </div>
                <div className="map-container" style={{ padding: 0, border: 'none', flex: 1, minHeight: '300px' }}>
                  <MapContainer 
                    center={[-7.2504, 112.7688]} 
                    zoom={12} 
                    minZoom={12}
                    maxBounds={[
                      [-7.3500, 112.5500], // Southwest
                      [-7.1500, 112.8500]  // Northeast
                    ]}
                    maxBoundsViscosity={1.0}
                    style={{ height: '100%', width: '100%', borderRadius: '12px' }}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {tpsNodes.map(tps => (
                      <Marker key={`tps-${tps.id}`} position={tps.pos} icon={tpsIcon}>
                        <Tooltip direction="top" offset={L.point(0, -10)} opacity={1}>
                          <div style={{ textAlign: 'center' }}>
                            <strong style={{ color: '#000' }}>{tps.tps}</strong><br/>
                            <span style={{ fontSize: '11px', color: '#666' }}>Vol: {tps.volume} / {tps.capacity} Ton</span>
                          </div>
                        </Tooltip>
                      </Marker>
                    ))}
                    {tps3rData.map(tps3r => (
                      <Marker key={`tps3r-${tps3r.id}`} position={tps3r.pos} icon={tps3rIcon}>
                        <Popup>{tps3r.name} - {tps3r.volume} Ton/Hari</Popup>
                      </Marker>
                    ))}
                    <Marker position={[-7.234, 112.620]} icon={pltsaIcon} zIndexOffset={1000}>
                      <Tooltip direction="top" offset={L.point(0, -15)} opacity={1} permanent>
                        <div style={{ textAlign: 'center' }}>
                          <strong style={{ color: '#ef4444', fontSize: '14px' }}>PLTSa Benowo</strong><br/>
                          <span style={{ fontSize: '11px', color: '#666' }}>Pusat Pengolahan Utama</span>
                        </div>
                      </Tooltip>
                    </Marker>
                    {trucks.map(truck => (
                      <Marker key={`truck-${truck.id}`} position={truck.pos} icon={getTruckImageIcon(truck.type, truck.angle)}>
                        <Popup>
                          <div style={{ fontSize: '12px', color: '#000' }}>
                            <strong>Truk {truck.id} ({truck.type})</strong><br/>
                            <span>Status: {truck.state === 'to_tps' ? 'Menuju TPS' : truck.state === 'to_benowo' ? 'Kembali ke Benowo' : 'Idle'}</span><br/>
                            <span>Kapasitas: {truck.capacity} Ton</span>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>
          </div>
          </>
        )}

        {activeTab === 'logistics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.5s ease-in-out' }}>
            {/* Upper stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              <div className="stat-card glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Compactor (16 Ton)</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>21 Unit</div>
                </div>
              </div>
              <div className="stat-card glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Dump Truck (20 Ton)</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>30 Unit</div>
                </div>
              </div>
              <div className="stat-card glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Arm Roll (10 Ton)</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>101 Unit</div>
                </div>
              </div>
              <div className="stat-card glass-panel" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status Operasional</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#10b981' }}>100% Aktif</div>
                </div>
              </div>
            </div>

            {/* Main map section */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '24px', minHeight: '650px' }}>
              {/* Map Panel */}
              <div className="chart-card glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '680px' }}>
                <div className="chart-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Peta Logistik & Rute Real-Time Surabaya (152 Armada)
                  <span className="status-success" style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', marginLeft: 'auto' }}>High Resolution Track</span>
                </div>
                
                {/* Legend and Filter Bar */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', border: '1px solid white' }}></div> PLTSa Benowo</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#fde047', border: '1px solid #450a0a' }}></div> TPS</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#d946ef', border: '1px solid white' }}></div> TPS3R</div>
                  
                  {/* Interactive toggle checkboxes for premium feel */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: showCompactor ? 'rgba(59, 130, 246, 0.15)' : 'transparent', padding: '4px 8px', borderRadius: '6px', border: '1px solid #3b82f6', color: '#3b82f6' }}>
                    <input type="checkbox" checked={showCompactor} onChange={(e) => setShowCompactor(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3b82f6' }}></div>
                    Compactor {showCompactor ? 'Visible' : 'Hidden'}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: showDumpTruck ? 'rgba(245, 158, 11, 0.15)' : 'transparent', padding: '4px 8px', borderRadius: '6px', border: '1px solid #f59e0b', color: '#f59e0b' }}>
                    <input type="checkbox" checked={showDumpTruck} onChange={(e) => setShowDumpTruck(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#f59e0b' }}></div>
                    Dump Truck {showDumpTruck ? 'Visible' : 'Hidden'}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: showArmRoll ? 'rgba(16, 185, 129, 0.15)' : 'transparent', padding: '4px 8px', borderRadius: '6px', border: '1px solid #10b981', color: '#10b981' }}>
                    <input type="checkbox" checked={showArmRoll} onChange={(e) => setShowArmRoll(e.target.checked)} style={{ display: 'none' }} />
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10b981' }}></div>
                    Arm Roll {showArmRoll ? 'Visible' : 'Hidden'}
                  </label>
                </div>

                <div className="map-container" style={{ padding: 0, border: 'none', flex: 1 }}>
                  <MapContainer 
                    center={[-7.2504, 112.7688]} 
                    zoom={12} 
                    minZoom={12}
                    maxBounds={[
                      [-7.3500, 112.5500],
                      [-7.1500, 112.8500]
                    ]}
                    maxBoundsViscosity={1.0}
                    style={{ height: '100%', width: '100%', borderRadius: '12px' }}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {tpsNodes.map(tps => (
                      <Marker key={`tps-l-${tps.id}`} position={tps.pos} icon={tpsIcon}>
                        <Tooltip direction="top" offset={L.point(0, -10)} opacity={1}>
                          <div style={{ textAlign: 'center' }}>
                            <strong style={{ color: '#000' }}>{tps.tps}</strong><br/>
                            <span style={{ fontSize: '11px', color: '#666' }}>Vol: {tps.volume} / {tps.capacity} Ton</span>
                          </div>
                        </Tooltip>
                      </Marker>
                    ))}
                    {tps3rData.map(tps3r => (
                      <Marker key={`tps3r-l-${tps3r.id}`} position={tps3r.pos} icon={tps3rIcon}>
                        <Popup>{tps3r.name} - {tps3r.volume} Ton/Hari</Popup>
                      </Marker>
                    ))}
                    <Marker position={[-7.234, 112.620]} icon={pltsaIcon} zIndexOffset={1000}>
                      <Tooltip direction="top" offset={L.point(0, -15)} opacity={1} permanent>
                        <div style={{ textAlign: 'center' }}>
                          <strong style={{ color: '#ef4444', fontSize: '14px' }}>PLTSa Benowo</strong><br/>
                          <span style={{ fontSize: '11px', color: '#666' }}>Pusat Pengolahan Utama</span>
                        </div>
                      </Tooltip>
                    </Marker>
                    {filteredTrucks.map(truck => (
                      <Marker key={`truck-l-${truck.id}`} position={truck.pos} icon={getTruckImageIcon(truck.type, truck.angle)}>
                        <Popup>
                          <div style={{ fontSize: '12px', color: '#000' }}>
                            <strong>Truk {truck.id} ({truck.type})</strong><br/>
                            <span>Status: {truck.state === 'to_tps' ? 'Menuju TPS' : truck.state === 'to_benowo' ? 'Kembali ke Benowo' : 'Idle'}</span><br/>
                            <span>Kapasitas: {truck.capacity} Ton</span>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </div>

              {/* Sidebar Tracker Panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Truck Status Stats */}
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', margin: 0, color: 'var(--text-primary)' }}>Status Armada Saat Ini</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Menuju TPS (Muat)</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {trucks.filter(t => t.state === 'to_tps').length} Truk
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                      <div style={{ width: `${(trucks.filter(t => t.state === 'to_tps').length / 152) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: '2px' }}></div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Menuju Benowo (Bongkar)</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {trucks.filter(t => t.state === 'to_benowo').length} Truk
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                      <div style={{ width: `${(trucks.filter(t => t.state === 'to_benowo').length / 152) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: '2px' }}></div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Idle di Depo / Benowo</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {trucks.filter(t => t.state === 'idle').length} Truk
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                      <div style={{ width: `${(trucks.filter(t => t.state === 'idle').length / 152) * 100}%`, height: '100%', background: '#10b981', borderRadius: '2px' }}></div>
                    </div>
                  </div>
                </div>

                {/* Real-time Tracking Feed */}
                <div className="glass-panel" style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '14px', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Live Logistics Feed</h4>
                  <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                    {trucks.slice(0, 15).map(truck => {
                      const tpsName = tpsNodes.find(t => t.id === truck.targetTpsId)?.tps || 'Depo Utama';
                      return (
                        <div key={`feed-${truck.id}`} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `3px solid ${truck.color}`, fontSize: '11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            <span>Truk {truck.id} ({truck.type})</span>
                            <span style={{ color: truck.state === 'to_tps' ? '#3b82f6' : truck.state === 'to_benowo' ? '#f59e0b' : '#10b981' }}>
                              {truck.state === 'to_tps' ? 'Muat' : truck.state === 'to_benowo' ? 'Bongkar' : 'Idle'}
                            </span>
                          </div>
                          <div style={{ color: 'var(--text-secondary)' }}>
                            {truck.state === 'to_tps' && `Tujuan: ${tpsName}`}
                            {truck.state === 'to_benowo' && `Rute: Benowo`}
                            {truck.state === 'idle' && `Posisi: Benowo (Depo)`}
                          </div>
                          {truck.state !== 'idle' && (
                            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '1.5px' }}>
                                <div style={{ width: `${truck.progress * 100}%`, height: '100%', background: truck.color, borderRadius: '1.5px' }}></div>
                              </div>
                              <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{Math.round(truck.progress * 100)}%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
    </>
  );
}

export default App;
