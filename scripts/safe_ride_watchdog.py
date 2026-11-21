#!/usr/bin/env python3
"""
Phola Safe Ride Watchdog Anomaly Detector
Monitors live trip telemetry, calculates perpendicular cross-track deviations,
and triggers Guardian Circle distress events when route anomalies or unauthorized stops occur.
"""

import math
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class Coordinate:
    lat: float
    lng: float
    timestamp: float  # unix epoch in seconds


@dataclass
class WatchdogAlert:
    severity: str
    message: str
    deviation_meters: float
    current_location: Tuple[float, float]
    timestamp: float


def haversine_distance(p1: Coordinate, p2: Coordinate) -> float:
    """Distance in meters between two coordinates."""
    r = 6371000.0
    phi1, phi2 = math.radians(p1.lat), math.radians(p2.lat)
    d_phi = math.radians(p2.lat - p1.lat)
    d_lam = math.radians(p2.lng - p1.lng)

    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    return r * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def cross_track_distance_meters(point: Coordinate, seg_start: Coordinate, seg_end: Coordinate) -> float:
    """
    Computes cross-track distance (perpendicular distance in meters)
    from a point to a great-circle path segment.
    """
    d_start_point = haversine_distance(seg_start, point)
    if d_start_point < 1.0:
        return 0.0

    # Spherical bearings
    def bearing(a: Coordinate, b: Coordinate) -> float:
        lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
        d_lon = math.radians(b.lng - a.lng)
        y = math.sin(d_lon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lon)
        return math.atan2(y, x)

    theta13 = bearing(seg_start, point)
    theta12 = bearing(seg_start, seg_end)
    d13 = d_start_point / 6371000.0  # angular distance

    dxt = math.asin(math.sin(d13) * math.sin(theta13 - theta12))
    return abs(dxt * 6371000.0)


class SafeRideWatchdog:
    def __init__(
        self,
        planned_route: List[Coordinate],
        max_deviation_threshold_meters: float = 250.0,
        max_stationary_seconds: float = 180.0,
    ):
        self.planned_route = planned_route
        self.max_deviation = max_deviation_threshold_meters
        self.max_stationary_time = max_stationary_seconds

        self.last_moving_location: Optional[Coordinate] = None
        self.stationary_start_time: Optional[float] = None

    def evaluate_telemetry(self, current_pos: Coordinate) -> Optional[WatchdogAlert]:
        """Evaluates a live incoming GPS point against the planned route corridor."""
        # 1. Compute min cross-track deviation to any route segment
        min_deviation = float("inf")
        for i in range(len(self.planned_route) - 1):
            seg_start = self.planned_route[i]
            seg_end = self.planned_route[i + 1]
            dist = cross_track_distance_meters(current_pos, seg_start, seg_end)
            if dist < min_deviation:
                min_deviation = dist

        # Check route corridor deviation
        if min_deviation > self.max_deviation:
            return WatchdogAlert(
                severity="CRITICAL",
                message=f"ROUTE DEVIATION DETECTED: Vehicle deviated {min_deviation:.1f}m from expected path!",
                deviation_meters=min_deviation,
                current_location=(current_pos.lat, current_pos.lng),
                timestamp=current_pos.timestamp,
            )

        # 2. Check stationary dwell time
        if self.last_moving_location:
            speed_proxy = haversine_distance(self.last_moving_location, current_pos)
            if speed_proxy < 10.0:  # Moved less than 10 meters
                if self.stationary_start_time is None:
                    self.stationary_start_time = current_pos.timestamp
                elif current_pos.timestamp - self.stationary_start_time >= self.max_stationary_time:
                    return WatchdogAlert(
                        severity="WARNING",
                        message=f"UNEXPECTED STOP: Vehicle stationary for {current_pos.timestamp - self.stationary_start_time:.0f}s in transit corridor.",
                        deviation_meters=min_deviation,
                        current_location=(current_pos.lat, current_pos.lng),
                        timestamp=current_pos.timestamp,
                    )
            else:
                self.stationary_start_time = None
                self.last_moving_location = current_pos
        else:
            self.last_moving_location = current_pos

        return None


def run_watchdog_simulation():
    print("🚗 Starting Safe Ride Watchdog Trip Simulation...")
    # Expected route along Pretoria corridor (Burnett -> Francis Baard -> CBD)
    route = [
        Coordinate(-25.7505, 28.2385, 0),
        Coordinate(-25.7490, 28.2300, 0),
        Coordinate(-25.7480, 28.2200, 0),
        Coordinate(-25.7470, 28.2100, 0),
    ]

    watchdog = SafeRideWatchdog(route, max_deviation_threshold_meters=200.0)

    # Simulated trip updates
    pings = [
        Coordinate(-25.7504, 28.2380, time.time() + 10),   # On route
        Coordinate(-25.7489, 28.2295, time.time() + 60),   # On route
        Coordinate(-25.7600, 28.2350, time.time() + 120),  # Sudden detour into unlit industrial alley
    ]

    for idx, ping in enumerate(pings, 1):
        alert = watchdog.evaluate_telemetry(ping)
        if alert:
            print(f"🚨 [Ping #{idx}] {alert.severity}: {alert.message}")
            print(f"   Coordinates: {alert.current_location} | Deviation: {alert.deviation_meters:.1f}m")
            print("   Action: Automatic distress ping dispatched to Guardian Circle!\n")
        else:
            print(f"✓ [Ping #{idx}] Telemetry normal. Vehicle on scheduled corridor.")


if __name__ == "__main__":
    run_watchdog_simulation()
