#!/usr/bin/env python3
"""
Phola Geospatial Danger Zone Analyzer
Calculates dynamic crime hotspot clusters and evaluates high-risk danger zones.
Uses Haversine distance spatial clustering to compute zone centroids and safety radiuses.
"""

import math
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class IncidentPoint:
    lat: float
    lng: float
    crime_type: str
    severity: str  # 'critical' | 'high' | 'medium' | 'low'
    timestamp: str


@dataclass
class DangerZone:
    id: str
    name: str
    lat: float
    lng: float
    radius_meters: float
    threat_level: str
    recommended_action: str


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes exact spherical distance in meters between two GPS coordinates."""
    r = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def cluster_incidents(
    incidents: List[IncidentPoint],
    cluster_threshold_meters: float = 800.0,
    min_incidents_for_zone: int = 3,
) -> List[DangerZone]:
    """
    Groups incident points into high-risk danger clusters and calculates centroids and threat radiuses.
    """
    assigned = [False] * len(incidents)
    zones: List[DangerZone] = []

    for i, p1 in enumerate(incidents):
        if assigned[i]:
            continue

        cluster = [p1]
        assigned[i] = True

        for j, p2 in enumerate(incidents):
            if not assigned[j]:
                dist = haversine_distance_meters(p1.lat, p1.lng, p2.lat, p2.lng)
                if dist <= cluster_threshold_meters:
                    cluster.append(p2)
                    assigned[j] = True

        if len(cluster) >= min_incidents_for_zone:
            # Centroid
            avg_lat = sum(p.lat for p in cluster) / len(cluster)
            avg_lng = sum(p.lng for p in cluster) / len(cluster)

            # Radius is max distance from centroid + 150m buffer (min 300m)
            max_d = max(haversine_distance_meters(avg_lat, avg_lng, p.lat, p.lng) for p in cluster)
            radius = max(350.0, max_d + 150.0)

            # Determine threat level
            critical_count = sum(1 for p in cluster if p.severity in ('critical', 'high'))
            threat = "CRITICAL" if critical_count >= 2 else "HIGH"

            zones.append(
                DangerZone(
                    id=f"zone-{len(zones) + 1}",
                    name=f"Dynamic Risk Cluster #{len(zones) + 1} ({len(cluster)} incidents)",
                    lat=round(avg_lat, 6),
                    lng=round(avg_lng, 6),
                    radius_meters=round(radius, 1),
                    threat_level=threat,
                    recommended_action="Exercise heightened vigilance; consider Safe Ride Watchdog routing.",
                )
            )

    return zones


def check_location_risk(lat: float, lng: float, zones: List[DangerZone]) -> Optional[Tuple[DangerZone, float]]:
    """Checks if a user's current GPS position falls inside any known danger zone."""
    for zone in zones:
        dist = haversine_distance_meters(lat, lng, zone.lat, zone.lng)
        if dist <= zone.radius_meters:
            return zone, dist
    return None


def run_demo():
    print("📍 Running Phola Danger Zone Spatial Analysis...")
    # Sample incident reports from high-traffic Gauteng corridors
    sample_reports = [
        IncidentPoint(-25.7505, 28.2385, "robbery", "high", "2026-11-20T21:00:00Z"),
        IncidentPoint(-25.7510, 28.2390, "harassment", "medium", "2026-11-20T22:30:00Z"),
        IncidentPoint(-25.7495, 28.2378, "assault", "critical", "2026-11-21T00:15:00Z"),
        IncidentPoint(-26.2041, 28.0473, "theft", "medium", "2026-11-21T18:00:00Z"),
        IncidentPoint(-26.2050, 28.0480, "robbery", "high", "2026-11-21T19:30:00Z"),
        IncidentPoint(-26.2035, 28.0465, "gbv_distress", "critical", "2026-11-21T20:10:00Z"),
    ]

    zones = cluster_incidents(sample_reports, cluster_threshold_meters=700.0, min_incidents_for_zone=3)
    print(f"✓ Detected {len(zones)} active danger zones:\n")
    for z in zones:
        print(f"  🚨 [{z.threat_level}] {z.name}")
        print(f"     Coordinates: ({z.lat}, {z.lng}) | Radius: {z.radius_meters}m")
        print(f"     Action: {z.recommended_action}\n")

    # Test coordinate
    test_lat, test_lng = -25.7507, 28.2387
    risk_match = check_location_risk(test_lat, test_lng, zones)
    if risk_match:
        zone, dist = risk_match
        print(f"⚠️ User at ({test_lat}, {test_lng}) is INSIDE '{zone.name}' (distance to center: {dist:.1f}m)")
    else:
        print(f"✅ User at ({test_lat}, {test_lng}) is in a SAFE zone.")


if __name__ == "__main__":
    run_demo()
