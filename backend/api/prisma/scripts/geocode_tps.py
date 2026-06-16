import csv
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

INPUT_CSV = Path(r"D:\Github\FP-Bigdata-AURORA\backend\api\prisma\data\tps_sampah_surabaya_raw.csv")
OUTPUT_CSV = Path(r"D:\Github\FP-Bigdata-AURORA\backend\api\prisma\data\tps_sampah_surabaya_geocoded.csv")

SURABAYA_BOUNDS = {
    "min_lat": -7.45,
    "max_lat": -7.10,
    "min_lng": 112.55,
    "max_lng": 113.00,
}

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

def clean_text(text: str) -> str:
    if text is None:
        return ""
    return text.replace("\n", " ").replace("\u2010", "-").strip()

def build_queries(row: dict) -> list[tuple[str, float]]:
    """Return list of (query, base_confidence) strategies."""
    address = clean_text(row.get("address", ""))
    kelurahan = clean_text(row.get("kelurahan", "").split(",")[0]).replace("Kel.", "").strip()
    kecamatan = clean_text(row.get("kecamatan", "")).strip()
    name = clean_text(row.get("name", "")).strip()
    
    queries = []
    
    # Strategy 1: full address
    if address and kelurahan and kecamatan:
        queries.append((f"{address}, Kel. {kelurahan}, Kec. {kecamatan}, Surabaya, Jawa Timur, Indonesia", 0.90))
    
    # Strategy 2: street + city
    if address:
        queries.append((f"{address}, Surabaya, Jawa Timur, Indonesia", 0.75))
    
    # Strategy 3: name + street + city (for landmarks like Pasar, Makam)
    if name and address:
        queries.append((f"{name}, {address}, Surabaya, Jawa Timur, Indonesia", 0.70))
    
    # Strategy 4: kelurahan + kecamatan (fallback to neighborhood center)
    if kelurahan and kecamatan:
        queries.append((f"Kel. {kelurahan}, Kec. {kecamatan}, Surabaya, Jawa Timur, Indonesia", 0.50))
    
    # Strategy 5: kecamatan only
    if kecamatan:
        queries.append((f"Kec. {kecamatan}, Surabaya, Jawa Timur, Indonesia", 0.35))
    
    return queries

def normalize_address(text: str) -> str:
    return text.lower().replace("jl.", "jalan").replace("kel.", "kelurahan").replace("kec.", "kecamatan")

def calculate_confidence(row: dict, result: dict, base_confidence: float) -> float:
    display = normalize_address(result.get("display_name", ""))
    kecamatan = row.get("kecamatan", "").lower()
    kelurahan = row.get("kelurahan", "").split(",")[0].replace("Kel.", "").strip().lower()
    address = normalize_address(row.get("address", ""))
    
    score = base_confidence
    if kecamatan and kecamatan in display:
        score += 0.05
    if kelurahan and kelurahan in display:
        score += 0.05
    if address and any(word in display for word in address.split() if len(word) > 3):
        score += 0.05
    return min(score, 1.0)

def geocode_address(query: str):
    params = {
        "q": query,
        "format": "json",
        "limit": 1,
        "countrycodes": "id",
    }
    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode(params)}"
    headers = {"User-Agent": "AURORA-SmartWaste-Project/1.0 (testing)"}
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data:
                return data[0]
    except Exception as e:
        print(f"  Geocoding error: {e}", flush=True)
    return None

def is_inside_surabaya(lat: float, lng: float) -> bool:
    return (SURABAYA_BOUNDS["min_lat"] <= lat <= SURABAYA_BOUNDS["max_lat"] and
            SURABAYA_BOUNDS["min_lng"] <= lng <= SURABAYA_BOUNDS["max_lng"])

def main():
    rows = []
    with open(INPUT_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"Geocoding {len(rows)} TPS entries with fallback strategies...", flush=True)
    print("This may take ~3-4 minutes due to Nominatim rate limit.\n", flush=True)
    
    results = []
    for i, row in enumerate(rows, 1):
        queries = build_queries(row)
        print(f"[{i}/{len(rows)}] {row['name']}", flush=True)
        
        lat = None
        lng = None
        confidence = 0.0
        used_query = ""
        geocoded_address = ""
        
        for query, base_conf in queries:
            print(f"  Trying: {query[:90]}...", flush=True)
            result = geocode_address(query)
            time.sleep(1.1)
            if result:
                lat = float(result.get("lat", 0))
                lng = float(result.get("lon", 0))
                geocoded_address = result.get("display_name", "")
                confidence = calculate_confidence(row, result, base_conf)
                used_query = query
                print(f"  -> FOUND ({confidence:.2f})", flush=True)
                break
        else:
            print(f"  -> NO RESULT", flush=True)
        
        needs_review = (lat is None or lng is None or 
                        not is_inside_surabaya(lat, lng) or 
                        confidence < 0.75)
        
        results.append({
            **row,
            "used_query": used_query,
            "lat": lat,
            "lng": lng,
            "confidence": round(confidence, 2),
            "needs_review": "TRUE" if needs_review else "FALSE",
            "geocoded_address": geocoded_address,
        })
    
    # Write output
    fieldnames = list(results[0].keys())
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    
    total = len(results)
    success = sum(1 for r in results if r["lat"] is not None)
    review = sum(1 for r in results if r["needs_review"] == "TRUE")
    high_conf = sum(1 for r in results if r["lat"] is not None and r["confidence"] >= 0.75)
    print(f"\nDone! Total: {total}, Geocoded: {success}, High Confidence: {high_conf}, Needs Review: {review}", flush=True)
    print(f"Output: {OUTPUT_CSV}", flush=True)

if __name__ == "__main__":
    main()
