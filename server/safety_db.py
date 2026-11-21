#!/usr/bin/env python3
"""
Phola South Africa Safety Database & Spatial Query Engine.
Provides real-time spatial lookup for SAPS Police Stations, High-Risk Danger Zones,
Safe Havens, and contextual crime risk assessments across South Africa.
"""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

DATA_FILE = Path(__file__).resolve().parent / "safety_data.json"


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes exact spherical distance in meters between two GPS coordinates using Haversine formula."""
    r = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


class SafetyDatabase:
    def __init__(self, data_file: Path = DATA_FILE):
        self.stations: List[Dict[str, Any]] = []
        self.zones: List[Dict[str, Any]] = []
        self.station_map: Dict[str, Dict[str, Any]] = {}
        self.load(data_file)

    def load(self, data_file: Path):
        if data_file.exists():
            with open(data_file, "r", encoding="utf-8") as f:
                payload = json.load(f)
                self.stations = payload.get("stations", [])
                self.zones = payload.get("zones", [])
                for s in self.stations:
                    self.station_map[s["code"]] = s
        else:
            self.stations = []
            self.zones = []

    def get_all_stations(self) -> List[Dict[str, Any]]:
        return self.stations

    def get_all_zones(self) -> List[Dict[str, Any]]:
        return self.zones

    def get_station_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        return self.station_map.get(code)

    def find_nearest_saps_station(self, lat: float, lng: float) -> Tuple[Optional[Dict[str, Any]], float]:
        """Finds the nearest SAPS police station and returns (station_dict, distance_in_meters)."""
        if not self.stations:
            return None, float("inf")

        nearest = None
        min_dist = float("inf")

        for station in self.stations:
            dist = haversine_distance_meters(lat, lng, station["lat"], station["lng"])
            if dist < min_dist:
                min_dist = dist
                nearest = station

        return nearest, min_dist

    def evaluate_location_risk(self, lat: float, lng: float) -> Dict[str, Any]:
        """
        Evaluates GPS coordinates against all South African safety zones.
        Returns risk level ('high' | 'moderate' | 'safe'), zone details,
        and nearest SAPS station information.
        """
        nearest_station, station_distance = self.find_nearest_saps_station(lat, lng)

        # 1. Check if user is currently inside any known safety zone
        enclosing_zones = []
        for zone in self.zones:
            dist = haversine_distance_meters(lat, lng, zone["lat"], zone["lng"])
            if dist <= zone["radiusMeters"]:
                enclosing_zones.append((zone, dist))

        if enclosing_zones:
            # Sort with high risk taking priority, then by distance to centroid
            level_rank = {"high": 3, "moderate": 2, "safe": 1}
            enclosing_zones.sort(key=lambda item: (-level_rank.get(item[0]["level"], 0), item[1]))
            top_zone, dist_to_centroid = enclosing_zones[0]

            return {
                "level": top_zone["level"],
                "zoneName": top_zone["name"],
                "region": top_zone["region"],
                "badgeText": f"{top_zone['level'].upper()} RISK ZONE" if top_zone['level'] != 'safe' else "VERIFIED SAFE HAVEN",
                "color": "red" if top_zone["level"] == "high" else ("amber" if top_zone["level"] == "moderate" else "emerald"),
                "advice": top_zone["safetyAdvice"],
                "riskFactors": top_zone.get("riskFactors", []),
                "distanceToCentroidMeters": round(dist_to_centroid, 1),
                "inZone": True,
                "nearestStation": {
                    "code": nearest_station["code"] if nearest_station else None,
                    "name": nearest_station["name"] if nearest_station else "Nearest SAPS Sector",
                    "phone": nearest_station.get("phone", "10111") if nearest_station else "10111",
                    "distanceMeters": round(station_distance, 1) if nearest_station else None,
                    "distanceKm": round(station_distance / 1000.0, 2) if nearest_station else None,
                }
            }

        # 2. If outside all zones, find the closest zone
        closest_zone = None
        min_zone_dist = float("inf")
        for zone in self.zones:
            dist = haversine_distance_meters(lat, lng, zone["lat"], zone["lng"])
            edge_dist = dist - zone["radiusMeters"]
            if edge_dist < min_zone_dist:
                min_zone_dist = edge_dist
                closest_zone = zone

        return {
            "level": "safe",
            "zoneName": "Standard South African Safety Corridor",
            "region": closest_zone["region"] if closest_zone else "South Africa",
            "badgeText": "NORMAL CORRIDOR",
            "color": "emerald",
            "advice": "Normal vigilance recommended. Stay alert, travel in well-lit areas, and keep phone emergency shortcuts accessible.",
            "riskFactors": ["Standard opportunistic crime precautions apply"],
            "distanceToCentroidMeters": None,
            "inZone": False,
            "nearestZone": {
                "name": closest_zone["name"] if closest_zone else None,
                "level": closest_zone["level"] if closest_zone else None,
                "distanceMeters": round(max(0, min_zone_dist), 1) if closest_zone else None,
            },
            "nearestStation": {
                "code": nearest_station["code"] if nearest_station else None,
                "name": nearest_station["name"] if nearest_station else "Nearest SAPS Sector",
                "phone": nearest_station.get("phone", "10111") if nearest_station else "10111",
                "distanceMeters": round(station_distance, 1) if nearest_station else None,
                "distanceKm": round(station_distance / 1000.0, 2) if nearest_station else None,
            }
        }


# Singleton instance
safety_db = SafetyDatabase()
