import pdfplumber
import re
import csv
import sys
from pathlib import Path

PDF_PATH = Path(r"D:\Github\FP-Bigdata-AURORA\ilide.info-data-tps-pr_1f4be750e8e1824a2d65ec243324bb25.pdf")
OUTPUT_DIR = Path(r"D:\Github\FP-Bigdata-AURORA\backend\api\prisma\data")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_CSV = OUTPUT_DIR / "tps_sampah_surabaya_raw.csv"

def normalize_kecamatan(name: str) -> str:
    name = name.strip().upper()
    replacements = {
        "BUBUTAN": "Bubutan",
        "SIMOKERTO": "Simokerto",
        "GENTENG": "Genteng",
        "TEGALSARI": "Tegalsari",
        "TANDES": "Tandes",
        "BENOWO": "Benowo",
        "PAKAL": "Pakal",
        "SAMBIKEREP": "Sambikerep",
        "LAKARSANTRI": "Lakarsantri",
        "SUKOMANUNGGAL": "Sukomanunggal",
        "KREMBANGAN": "Krembangan",
        "SEMAMPIR": "Semampir",
        "PABEAN CANTIAN": "Pabean Cantian",
        "BULAK": "Bulak",
        "KENJERAN": "Kenjeran",
        "TAMBAKSARI": "Tambaksari",
        "GUBENG": "Gubeng",
        "SUKOLILO": "Sukolilo",
        "RUNGKUT": "Rungkut",
        "GUNUNG ANYAR": "Gunung Anyar",
        "TENGGILIS MEJOYO": "Tenggilis Mejoyo",
        "MULYOREJO": "Mulyorejo",
        "SAWAHAN": "Sawahan",
        "WONOKROMO": "Wonokromo",
        "WONOCOLO": "Wonocolo",
        "KARANG PILANG": "Karang Pilang",
        "GAYUNGAN": "Gayungan",
        "JAMBANGAN": "Jambangan",
        "WIYUNG": "Wiyung",
        "DUKUH PAKIS": "Dukuh Pakis",
        "ASEMROWO": "Asemrowo",
    }
    return replacements.get(name, name.title())

def parse_capacity(container_text: str, daya_tampung_text: str):
    container_text = (container_text or "").replace(" ", "").replace(",", ".").upper()
    daya_text = (daya_tampung_text or "").replace(" ", "").replace(",", ".").upper()
    
    # Try daya tampung first
    m = re.search(r"([\d\.]+)", daya_text)
    if m:
        total_m3 = float(m.group(1))
        m_count = re.search(r"^(\d+)", container_text)
        count = int(m_count.group(1)) if m_count else 1
        return count, total_m3
    
    # Fallback: parse container text like '2(14M3)'
    m = re.search(r"(\d+)\(([\d\.]+)\s*M3\)", container_text)
    if m:
        count = int(m.group(1))
        m3 = float(m.group(2))
        return count, count * m3
    
    return 1, 14.0

def clean_text(text) -> str:
    if text is None:
        return ""
    return text.replace("\n", " ").replace("\u2010", "-").strip()

def clean_name(text: str) -> str:
    text = clean_text(text)
    words = text.split()
    if len(words) >= 2 and words[0].upper() == words[1].upper():
        return " ".join(words[1:])
    return text

def is_header_row(row) -> bool:
    text = " ".join([str(c or "").upper() for c in row])
    if "NAMA LPS" in text or "DEPO" in text and "LOKASI" in text:
        return True
    if re.match(r"^\s*\d+\s+\d+\s+\d+\s+\d+", text):
        return True
    return False

def is_kecamatan_header(row) -> tuple[bool, str | None]:
    for cell in row:
        if cell and isinstance(cell, str):
            m = re.search(r"KECAMATAN\s+(.+)", cell, re.IGNORECASE)
            if m:
                return True, normalize_kecamatan(m.group(1).strip())
    return False, None

def is_section_header(row) -> bool:
    text = " ".join([str(c or "").upper() for c in row])
    return "SURABAYA" in text and len(text) < 50

def main():
    records = []
    current_kecamatan = None
    entry_no = 0
    
    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                # Skip first header row, then process
                row_idx = 0
                for row in table:
                    row_idx += 1
                    if not row or len(row) < 10:
                        continue
                    
                    # Skip header rows
                    if row_idx <= 2 or is_header_row(row) or is_section_header(row):
                        # But check if it's a kecamatan header
                        is_kec, kec_name = is_kecamatan_header(row)
                        if is_kec:
                            current_kecamatan = kec_name
                        continue
                    
                    # Check for kecamatan header anywhere
                    is_kec, kec_name = is_kecamatan_header(row)
                    if is_kec:
                        current_kecamatan = kec_name
                        continue
                    
                    if not current_kecamatan:
                        continue
                    
                    # Parse data row
                    nama = clean_name(clean_text(row[1])) or clean_name(clean_text(row[2]))
                    lokasi = clean_text(row[3])
                    kelurahan_lokasi = clean_text(row[4])      # col 4 actually contains kelurahan
                    wilayah_dilayani = clean_text(row[5])
                    jenis = clean_text(row[6])
                    container = clean_text(row[7])
                    daya = clean_text(row[8])
                    status_raw = clean_text(row[9])
                    
                    # Skip empty/invalid rows
                    if not nama or not lokasi:
                        continue
                    # Skip if lokasi is just a kelurahan without Jl.
                    if not lokasi.upper().startswith("JL.") and not lokasi.upper().startswith("DEPAN") and not lokasi.upper().startswith("PASAR"):
                        # Sometimes location and kelurahan are swapped
                        if kelurahan_lokasi.upper().startswith("JL."):
                            lokasi, kelurahan_lokasi = kelurahan_lokasi, lokasi
                    
                    entry_no += 1
                    
                    tps_type = "COMPACTOR" if "COMPACTOR" in jenis.upper() else "TPS_BIASA"
                    count, m3 = parse_capacity(container, daya)
                    
                    status_upper = (status_raw or "").upper()
                    status = "AKTIF" if "AKTIF" in status_upper and "TIDAK" not in status_upper else "NONAKTIF"
                    
                    # Combine kelurahan info
                    kelurahan_combined = kelurahan_lokasi
                    if wilayah_dilayani and wilayah_dilayani != kelurahan_lokasi:
                        kelurahan_combined = f"{kelurahan_lokasi}, {wilayah_dilayani}" if kelurahan_lokasi else wilayah_dilayani
                    
                    records.append({
                        "no": entry_no,
                        "name": nama,
                        "address": lokasi,
                        "kecamatan": current_kecamatan,
                        "kelurahan": kelurahan_combined,
                        "tps_type": tps_type,
                        "unit_count": count,
                        "capacity_m3": round(m3, 2),
                        "capacity_kg": round(m3 * 250, 2),
                        "status": status,
                    })
    
    # Deduplicate
    seen = set()
    unique_records = []
    for r in records:
        key = (r["name"].upper(), r["kecamatan"].upper(), r["address"].upper())
        if key not in seen:
            seen.add(key)
            unique_records.append(r)
    
    # Write CSV
    fieldnames = ["no", "name", "address", "kecamatan", "kelurahan", "tps_type", "unit_count", "capacity_m3", "capacity_kg", "status"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unique_records)
    
    print(f"Extracted {len(unique_records)} unique records to {OUTPUT_CSV}", flush=True)
    print(f"Active: {sum(1 for r in unique_records if r['status']=='AKTIF')}", flush=True)
    print(f"Inactive: {sum(1 for r in unique_records if r['status']=='NONAKTIF')}", flush=True)
    print("Sample:", flush=True)
    for r in unique_records[:5]:
        print(f"  {r['no']}: {r['name']} | {r['address']} | {r['kecamatan']} | {r['tps_type']} | {r['capacity_kg']}kg | {r['status']}", flush=True)

if __name__ == "__main__":
    main()
