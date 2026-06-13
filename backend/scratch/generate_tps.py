import csv
import random
import json
import os

kecamatans = {
    'Sukolilo': ['Keputih', 'Nginden Jangkungan', 'Semolowaru', 'Klampis Ngasem', 'Medokan Semampir'],
    'Gubeng': ['Airlangga', 'Baratajaya', 'Gubeng', 'Kertajaya', 'Mojo', 'Pucang Sewu'],
    'Rungkut': ['Kedung Baruk', 'Medokan Ayu', 'Penjaringan Sari', 'Rungkut Kidul', 'Kali Rungkut', 'Wonorejo'],
    'Pakal': ['Babat Jerawat', 'Pakal', 'Sumberejo', 'Benowo'],
    'Tegalsari': ['Dr. Soetomo', 'Kedungdoro', 'Tegalsari', 'Wonorejo', 'Keputran'],
    'Wonokromo': ['Darmo', 'Jagir', 'Ngagel', 'Sawunggaling', 'Ngagelrejo'],
    'Tambaksari': ['Gading', 'Pacar Keling', 'Ploso', 'Rangkah', 'Tambaksari', 'Dukuh Setro', 'Karang Kembang'],
    'Sawahan': ['Banyu Urip', 'Kupang Krajan', 'Pakis', 'Petemon', 'Putat Jaya', 'Sawahan'],
    'Kenjeran': ['Bulak Banteng', 'Tambak Wedi', 'Tanah Kali Kedinding', 'Sidotopo Wetan'],
    'Mulyorejo': ['Dukuh Sutorejo', 'Kalijudan', 'Kalisari', 'Mulyorejo', 'Kejawan Putih'],
    'Wiyung': ['Babatan', 'Balas Klumprik', 'Jajar Tunggal', 'Wiyung'],
    'Jambangan': ['Jambangan', 'Karah', 'Kebonsari', 'Pagesangan'],
    'Wonocolo': ['Bendul Merisi', 'Jemur Wonosari', 'Margorejo', 'Sidosermo', 'Siwalankerto'],
    'Benowo': ['Kandangan', 'Romokalisari', 'Sememi', 'Tambak Osowilangun'],
    'Lakarsantri': ['Bangkingan', 'Jeruk', 'Lakarsantri', 'Lidah Kulon', 'Lidah Wetan']
}

streets = ['Jl. Raya', 'Jl. Pasar', 'Jl. Makam', 'Gg. Buntu', 'Jl. Mawar', 'Jl. Melati', 'Jl. Pahlawan', 'Jl. Indah', 'Jl. Baru', 'Jl. Taman', 'Jl. Kamboja', 'Jl. Merpati', 'Jl. Rajawali', 'Jl. Masjid', 'Jl. Sekolah']

tps_list = []
id_counter = 1

# Generate 218 items
while len(tps_list) < 218:
    kec = random.choice(list(kecamatans.keys()))
    kel = random.choice(kecamatans[kec])
    street = random.choice(streets)
    
    # Give some variation to the name format
    format_type = random.choice([1, 2, 3])
    if format_type == 1:
        name = f"TPS {street} {kel}"
    elif format_type == 2:
        name = f"TPS Pasar {kel}"
    else:
        name = f"TPS {kel} Blok {random.randint(1, 9)}"
    
    # Surabaya approx bounding box: Lat -7.21 to -7.38, Lng 112.60 to 112.80
    lat = -7.38 + random.random() * 0.17
    lng = 112.60 + random.random() * 0.20
    
    cap = random.choice([10, 15, 20, 25, 30, 40, 50])
    
    if name not in [t['name'] for t in tps_list]:
        tps_list.append({
            'id': id_counter,
            'name': name,
            'kecamatan': kec,
            'kelurahan': kel,
            'lat': round(lat, 5),
            'lng': round(lng, 5),
            'capacity': cap
        })
        id_counter += 1

csv_path = 'd:/Kuliahh/Semester 4/Big Data/AURORA/dashboard/public/dataset_tps_surabaya.csv'
ts_dir = 'd:/Kuliahh/Semester 4/Big Data/AURORA/dashboard/src/data'
ts_path = os.path.join(ts_dir, 'tpsData.ts')

os.makedirs(ts_dir, exist_ok=True)
os.makedirs('d:/Kuliahh/Semester 4/Big Data/AURORA/dashboard/public', exist_ok=True)

with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=['id', 'name', 'kecamatan', 'kelurahan', 'lat', 'lng', 'capacity'])
    writer.writeheader()
    writer.writerows(tps_list)

ts_content = f"export const TPS_DATA = {json.dumps(tps_list, indent=2)};\n"
with open(ts_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Generated {len(tps_list)} TPS items.")
