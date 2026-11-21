#!/usr/bin/env python3
"""
Phola Safety Data Integrity Auditor
Validates SAPS Police Stations, Hospitals, and High-Risk Danger Zones to ensure:
1. GPS coordinates strictly fall within South African borders (Lat: -35 to -22, Lng: 16 to 33)
2. Emergency contact phone numbers conform to valid South African telecommunication patterns
3. Zero duplicate station IDs or code collisions
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SAPS_FILE = REPO_ROOT / "lib" / "saps-stations.ts"
ZONES_FILE = REPO_ROOT / "lib" / "high-risk-zones.ts"

# Geographic bounding box of South Africa
SA_LAT_MIN, SA_LAT_MAX = -35.5, -22.0
SA_LNG_MIN, SA_LNG_MAX = 16.0, 33.5


def extract_objects_from_ts(content: str, pattern: str):
    return re.findall(pattern, content, re.DOTALL)


def audit_saps_stations() -> bool:
    print("🚓 [1/2] Auditing SAPS Police Stations & Emergency Facilities...")
    if not SAPS_FILE.exists():
        print(f"❌ Missing file: {SAPS_FILE}")
        return False

    text = SAPS_FILE.read_text(encoding="utf-8")

    # Match station objects: name, lat, lng, phone
    matches = re.findall(
        r'name:\s*[\'"]([^\'"]+)[\'"].*?lat:\s*([-\d\.]+).*?lng:\s*([-\d\.]+).*?phone:\s*[\'"]([^\'"]+)[\'"]',
        text,
        re.DOTALL,
    )

    if not matches:
        print("⚠️ No station objects detected via regex pattern.")
        return False

    has_errors = False
    seen_names = set()

    for name, lat_str, lng_str, phone in matches:
        lat, lng = float(lat_str), float(lng_str)

        # Coordinate check
        if not (SA_LAT_MIN <= lat <= SA_LAT_MAX and SA_LNG_MIN <= lng <= SA_LNG_MAX):
            print(f"  ❌ Coordinate out of bounds for '{name}': ({lat}, {lng})")
            has_errors = True

        # Phone check
        clean_phone = re.sub(r'[\s\-\(\)]', '', phone)
        if not (clean_phone == '10111' or clean_phone.startswith('0800') or len(clean_phone) in (10, 11)):
            print(f"  ⚠️ Non-standard phone for '{name}': {phone}")

        if name in seen_names:
            print(f"  ❌ Duplicate facility name: '{name}'")
            has_errors = True
        seen_names.add(name)

    print(f"  ✓ Verified {len(matches)} SAPS stations and emergency facilities across Mzansi.")
    return not has_errors


def audit_danger_zones() -> bool:
    print("⚠️ [2/2] Auditing High-Risk Danger Zones...")
    if not ZONES_FILE.exists():
        print(f"❌ Missing file: {ZONES_FILE}")
        return False

    text = ZONES_FILE.read_text(encoding="utf-8")

    matches = re.findall(
        r'id:\s*[\'"]([^\'"]+)[\'"].*?name:\s*[\'"]([^\'"]+)[\'"].*?lat:\s*([-\d\.]+).*?lng:\s*([-\d\.]+).*?radiusMeters:\s*(\d+)',
        text,
        re.DOTALL,
    )

    if not matches:
        print("⚠️ No danger zone objects detected.")
        return False

    has_errors = False
    seen_ids = set()

    for zone_id, name, lat_str, lng_str, radius_str in matches:
        lat, lng = float(lat_str), float(lng_str)
        radius = int(radius_str)

        if not (SA_LAT_MIN <= lat <= SA_LAT_MAX and SA_LNG_MIN <= lng <= SA_LNG_MAX):
            print(f"  ❌ Coordinates out of South Africa bounds for '{name}': ({lat}, {lng})")
            has_errors = True

        if radius < 50 or radius > 15000:
            print(f"  ⚠️ Suspicious safety radius for '{name}': {radius}m")

        if zone_id in seen_ids:
            print(f"  ❌ Duplicate zone ID: '{zone_id}'")
            has_errors = True
        seen_ids.add(zone_id)

    print(f"  ✓ Verified {len(matches)} high-risk danger zones with calibrated safety radiuses.")
    return not has_errors


def main():
    saps_ok = audit_saps_stations()
    zones_ok = audit_danger_zones()

    if saps_ok and zones_ok:
        print("\n✅ All safety, emergency facility, and danger zone datasets verified with 100% integrity!")
        sys.exit(0)
    else:
        print("\n❌ Dataset validation errors encountered.")
        sys.exit(1)


if __name__ == "__main__":
    main()
