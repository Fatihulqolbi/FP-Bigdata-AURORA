# OSRM Self-Host + HERE Traffic API — Build Guide

Panduan ini menjelaskan cara setup OSRM self-hosted di server Linux (Ubuntu/Debian),
lalu mengintegrasikannya dengan HERE Traffic API untuk rerouting berbasis data kemacetan real-time.

---

## Arsitektur Sistem

```
[User/App]
    │
    ▼
[Traffic Service]  ←──── HERE Traffic Flow API
    │   (cek jamFactor tiap N menit)
    │
    ▼
[OSRM Engine]  (self-hosted)
    │   (minta 3 rute alternatif)
    │
    ▼
[Rute Terbaik dikembalikan ke User]
```

---

## 1. Prasyarat Server

| Kebutuhan       | Minimum             | Direkomendasikan     |
|-----------------|---------------------|----------------------|
| OS              | Ubuntu 22.04         | Ubuntu 22.04 LTS     |
| RAM             | 4 GB                 | 8 GB+                |
| CPU             | 2 core               | 4 core+              |
| Storage         | 20 GB                | 50 GB+ (tergantung map) |
| Node.js         | v18+                 | v20 LTS              |

---

## 2. Install OSRM via Docker (Direkomendasikan)

Pakai Docker supaya tidak perlu build dari source — lebih cepat dan mudah dikelola.

### 2a. Install Docker

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose curl wget
sudo systemctl enable docker
sudo usermod -aG docker $USER
# Logout & login ulang agar group docker aktif
```

### 2b. Download Peta Jawa Timur (OpenStreetMap)

```bash
mkdir -p ~/osrm-data && cd ~/osrm-data

# Download peta Jawa Timur dari Geofabrik
wget https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf

# (Opsional) Kalau hanya butuh area Surabaya, crop dulu dengan osmium:
# sudo apt install -y osmium-tool
# osmium extract --bbox=112.5,-7.5,113.0,-7.0 java-latest.osm.pbf -o surabaya.osm.pbf
```

> **Tip:** File `java-latest.osm.pbf` sekitar 300–400 MB. Kalau server RAM-nya terbatas,
> disarankan crop ke area Surabaya/GKS saja (bbox di atas).

### 2c. Pre-process Peta dengan OSRM

```bash
cd ~/osrm-data

# Ekstrak graph jalan (pakai profil car)
docker run -t -v "$(pwd):/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/java-latest.osm.pbf

# Partisi (untuk Multi-Level Dijkstra)
docker run -t -v "$(pwd):/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/java-latest.osrm

# Customize (finalisasi graph)
docker run -t -v "$(pwd):/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/java-latest.osrm
```

> Proses ini memakan waktu 10–30 menit tergantung ukuran file dan spesifikasi server.

### 2d. Jalankan OSRM Server

```bash
docker run -d \
  --name osrm \
  --restart unless-stopped \
  -p 5000:5000 \
  -v "$(pwd):/data" \
  ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/java-latest.osrm
```

### 2e. Test OSRM

```bash
# Cek apakah server jalan
curl "http://localhost:5000/route/v1/driving/112.7378,-7.2575;112.7520,-7.2458?alternatives=3&overview=full"
```

Jika muncul response JSON berisi `routes`, OSRM sudah berjalan normal.

---

## 3. Setup HERE Traffic API

### 3a. Daftar Akun HERE

1. Buka [developer.here.com](https://developer.here.com)
2. Klik **Get started for free**
3. Buat project baru → generate **API Key**
4. Simpan API Key kamu — akan dipakai di langkah berikutnya

> Gratis hingga 1.000 request/hari untuk Traffic Flow API pada free tier.

### 3b. Test HERE Traffic API

```bash
# Ganti YOUR_API_KEY dan koordinat titik yang ingin dicek
curl "https://data.traffic.hereapi.com/v7/flow?in=circle:-7.2575,112.7378;r=2000&apiKey=YOUR_API_KEY"
```

Response penting yang perlu diperhatikan:

```json
{
  "results": [
    {
      "location": { ... },
      "currentFlow": {
        "speed": 12,          // kecepatan saat ini (km/h)
        "freeFlow": 50,       // kecepatan normal (km/h)
        "jamFactor": 8.5      // 0 = lancar, 10 = total macet
      }
    }
  ]
}
```

---

## 4. Traffic Service (Node.js)

Buat service kecil yang:
1. Mengambil data kemacetan dari HERE
2. Meminta 3 rute alternatif dari OSRM
3. Mengembalikan rute terbaik berdasarkan jamFactor

### 4a. Inisialisasi Project

```bash
mkdir ~/traffic-service && cd ~/traffic-service
npm init -y
npm install express axios dotenv
```

### 4b. File `.env`

```env
HERE_API_KEY=your_here_api_key_here
OSRM_URL=http://localhost:5000
PORT=3001
JAM_THRESHOLD=7
TRAFFIC_RADIUS=2000
```

### 4c. File `index.js`

```js
require('dotenv').config();
const express = require('express');
const axios   = require('axios');

const app  = express();
app.use(express.json());

const {
  HERE_API_KEY,
  OSRM_URL,
  PORT = 3001,
  JAM_THRESHOLD = 7,
  TRAFFIC_RADIUS = 2000,
} = process.env;

// ─── Ambil titik macet dari HERE ─────────────────────────────────────────────
async function getJamPoints(lat, lon) {
  const url = `https://data.traffic.hereapi.com/v7/flow`
    + `?in=circle:${lat},${lon};r=${TRAFFIC_RADIUS}`
    + `&apiKey=${HERE_API_KEY}`;

  const { data } = await axios.get(url);

  const jamPoints = [];
  for (const result of data.results ?? []) {
    if ((result.currentFlow?.jamFactor ?? 0) >= Number(JAM_THRESHOLD)) {
      for (const link of result.location?.shape?.links ?? []) {
        for (const pt of link.points ?? []) {
          jamPoints.push({ lat: pt.lat, lon: pt.lng });
        }
      }
    }
  }
  return jamPoints;
}

// ─── Hitung apakah titik rute melewati area macet ────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreRoute(route, jamPoints, thresholdKm = 0.1) {
  // Decode polyline sederhana — OSRM mengembalikan geometry sebagai GeoJSON
  const coords = route.geometry.coordinates; // [lon, lat]
  let hits = 0;
  for (const [rLon, rLat] of coords) {
    for (const jp of jamPoints) {
      if (haversineKm(rLat, rLon, jp.lat, jp.lon) < thresholdKm) {
        hits++;
        break;
      }
    }
  }
  return hits; // makin kecil makin bagus
}

// ─── Endpoint utama: POST /route ──────────────────────────────────────────────
// Body: { origin: [lon, lat], destination: [lon, lat] }
app.post('/route', async (req, res) => {
  const { origin, destination } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin dan destination wajib diisi' });
  }

  const [oLon, oLat] = origin;
  const [dLon, dLat] = destination;

  try {
    // 1. Ambil titik macet di sekitar origin
    const jamPoints = await getJamPoints(oLat, oLon);

    // 2. Minta 3 rute alternatif dari OSRM
    const osrmUrl =
      `${OSRM_URL}/route/v1/driving/${oLon},${oLat};${dLon},${dLat}`
      + `?alternatives=3&overview=full&geometries=geojson&steps=true`;

    const { data: osrmData } = await axios.get(osrmUrl);

    if (osrmData.code !== 'Ok') {
      return res.status(500).json({ error: 'OSRM gagal menghitung rute' });
    }

    // 3. Skor tiap rute
    const scored = osrmData.routes.map((route, i) => ({
      index: i,
      distanceKm: (route.distance / 1000).toFixed(2),
      durationMin: (route.duration / 60).toFixed(1),
      jamHits: scoreRoute(route, jamPoints),
      route,
    }));

    // 4. Pilih rute dengan jamHits paling sedikit (tie-break: durasi terpendek)
    scored.sort((a, b) => a.jamHits - b.jamHits || a.route.duration - b.route.duration);
    const best = scored[0];

    return res.json({
      recommended: {
        distanceKm: best.distanceKm,
        durationMin: best.durationMin,
        jamHits: best.jamHits,
        geometry: best.route.geometry,
        steps: best.route.legs[0].steps,
      },
      alternatives: scored.slice(1).map(s => ({
        distanceKm: s.distanceKm,
        durationMin: s.durationMin,
        jamHits: s.jamHits,
        geometry: s.route.geometry,
      })),
      jamPointsFound: jamPoints.length,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Traffic service running on port ${PORT}`));
```

### 4d. Jalankan Service

```bash
node index.js
```

### 4e. Test Endpoint

```bash
curl -X POST http://localhost:3001/route \
  -H "Content-Type: application/json" \
  -d '{
    "origin":      [112.7378, -7.2575],
    "destination": [112.7520, -7.2458]
  }'
```

---

## 5. Jalankan dengan PM2 (Produksi)

```bash
npm install -g pm2

# Jalankan service
pm2 start index.js --name traffic-service

# Simpan agar auto-start saat reboot
pm2 save
pm2 startup
```

---

## 6. (Opsional) Update Peta Otomatis

Peta OSM perlu diperbarui berkala agar data jalan tetap akurat.

```bash
# Buat script update: ~/osrm-data/update-map.sh
#!/bin/bash
cd ~/osrm-data
wget -q -O java-latest.osm.pbf https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf

docker stop osrm

docker run -t -v "$(pwd):/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/java-latest.osm.pbf
docker run -t -v "$(pwd):/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/java-latest.osrm
docker run -t -v "$(pwd):/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/java-latest.osrm

docker start osrm
echo "Map updated: $(date)"
```

```bash
chmod +x ~/osrm-data/update-map.sh

# Jadwalkan tiap minggu (Minggu jam 3 pagi)
crontab -e
# Tambahkan baris:
# 0 3 * * 0 /bin/bash ~/osrm-data/update-map.sh >> ~/osrm-data/update.log 2>&1
```

---

## 7. Ringkasan Port & Endpoint

| Service         | Port  | Endpoint Utama                          |
|-----------------|-------|-----------------------------------------|
| OSRM            | 5000  | `GET /route/v1/driving/{coords}`        |
| Traffic Service | 3001  | `POST /route` (origin + destination)    |

---

## 8. Troubleshooting

**OSRM tidak mau start**
```bash
docker logs osrm
# Pastikan file .osrm ada di ~/osrm-data/
ls ~/osrm-data/*.osrm
```

**HERE API 401 Unauthorized**
- Cek API Key di `.env`, pastikan tidak ada spasi
- Pastikan project HERE sudah diaktifkan di dashboard

**Rute tidak menghindari macet**
- Turunkan nilai `JAM_THRESHOLD` di `.env` (coba nilai `5`)
- Naikkan `TRAFFIC_RADIUS` untuk jangkauan lebih luas (misalnya `5000`)
- Pastikan OSRM mengembalikan minimal 2–3 rute alternatif

---

*Build guide ini menggunakan OSRM v5.x (MLD algorithm) + HERE Traffic Flow API v7.*
