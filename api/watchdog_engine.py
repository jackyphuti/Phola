#!/usr/bin/env python3
"""
Phola Safe Ride Watchdog Real-Time Telemetry & Anomaly Detection Engine.
Tracks live GPS breadcrumbs, detects unauthorized corridor deviations,
monitors stationary dwell times, and triggers Guardian Circle alerts.
"""

import math
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from safety_db import haversine_distance_meters, safety_db


@dataclass
class TelemetryPoint:
    lat: float
    lng: float
    timestamp: float
    speed_kmh: Optional[float] = None
    heading: Optional[float] = None


@dataclass
class RideSessionState:
    session_id: str
    service_id: str
    destination: str
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    dest_lat: Optional[float] = None
    dest_lng: Optional[float] = None
    created_at: float = field(default_factory=time.time)
    last_updated: float = field(default_factory=time.time)
    points: List[TelemetryPoint] = field(default_factory=list)
    stationary_since: Optional[float] = None
    status: str = "active"  # 'active' | 'warning' | 'critical' | 'completed'


def cross_track_distance_meters(
    p_lat: float, p_lng: float, start_lat: float, start_lng: float, end_lat: float, end_lng: float
) -> float:
    """
    Computes cross-track distance (perpendicular distance in meters)
    from a point to a great-circle path segment between start and end.
    """
    p_coord = (p_lat, p_lng)
    s_coord = (start_lat, start_lng)

    d_sp = haversine_distance_meters(start_lat, start_lng, p_lat, p_lng)
    if d_sp < 1.0:
        return 0.0

    def bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        l1, l2 = math.radians(lat1), math.radians(lat2)
        d_lon = math.radians(lon2 - lon1)
        y = math.sin(d_lon) * math.cos(l2)
        x = math.cos(l1) * math.sin(l2) - math.sin(l1) * math.cos(l2) * math.cos(d_lon)
        return math.atan2(y, x)

    theta13 = bearing(start_lat, start_lng, p_lat, p_lng)
    theta12 = bearing(start_lat, start_lng, end_lat, end_lng)
    d13 = d_sp / 6371000.0  # angular distance in radians

    sin_dxt = math.sin(d13) * math.sin(theta13 - theta12)
    # Clamp for numerical stability
    sin_dxt = max(-1.0, min(1.0, sin_dxt))
    dxt = math.asin(sin_dxt)
    return abs(dxt * 6371000.0)


class WatchdogTelemetryEngine:
    def __init__(
        self,
        max_deviation_meters: float = 350.0,
        max_stationary_seconds: float = 180.0,  # 3 minutes dwell trigger
    ):
        self.max_deviation = max_deviation_meters
        self.max_stationary_time = max_stationary_seconds
        self.sessions: Dict[str, RideSessionState] = {}

    def get_or_create_session(
        self,
        session_id: str,
        service_id: str = "uber",
        destination: str = "",
        start_lat: Optional[float] = None,
        start_lng: Optional[float] = None,
        dest_lat: Optional[float] = None,
        dest_lng: Optional[float] = None,
    ) -> RideSessionState:
        if session_id not in self.sessions:
            self.sessions[session_id] = RideSessionState(
                session_id=session_id,
                service_id=service_id,
                destination=destination,
                start_lat=start_lat,
                start_lng=start_lng,
                dest_lat=dest_lat,
                dest_lng=dest_lng,
            )
        return self.sessions[session_id]

    def record_telemetry(
        self,
        session_id: str,
        lat: float,
        lng: float,
        timestamp: Optional[float] = None,
        speed_kmh: Optional[float] = None,
        heading: Optional[float] = None,
        service_id: str = "uber",
        destination: str = "",
        dest_lat: Optional[float] = None,
        dest_lng: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Processes an incoming live GPS fix for an active Safe Ride.
        Calculates:
        1. Route corridor deviation
        2. Stationary dwell anomaly
        3. Danger zone ingress
        4. Nearest SAPS police station
        5. Composite safety score (0-100)
        """
        now = timestamp or time.time()
        session = self.get_or_create_session(
            session_id=session_id,
            service_id=service_id,
            destination=destination,
            start_lat=lat if not self.sessions.get(session_id) else None,
            start_lng=lng if not self.sessions.get(session_id) else None,
            dest_lat=dest_lat,
            dest_lng=dest_lng,
        )

        # Update destination coords if newly discovered
        if dest_lat and not session.dest_lat:
            session.dest_lat = dest_lat
            session.dest_lng = dest_lng

        new_point = TelemetryPoint(
            lat=lat,
            lng=lng,
            timestamp=now,
            speed_kmh=speed_kmh,
            heading=heading,
        )

        # Stationary dwell detection
        is_stationary = False
        dwell_seconds = 0.0

        if session.points:
            last_point = session.points[-1]
            dist_moved = haversine_distance_meters(last_point.lat, last_point.lng, lat, lng)
            time_diff = max(1.0, now - last_point.timestamp)
            computed_speed = (dist_moved / time_diff) * 3.6  # km/h

            effective_speed = speed_kmh if speed_kmh is not None else computed_speed

            if effective_speed < 3.0 and dist_moved < 15.0:  # stationary
                if session.stationary_since is None:
                    session.stationary_since = last_point.timestamp
                dwell_seconds = now - session.stationary_since
                is_stationary = True
            else:
                session.stationary_since = None
        else:
            session.stationary_since = None

        session.points.append(new_point)
        session.last_updated = now

        # Prune older points to prevent unbounded memory growth (keep last 300 breadcrumbs)
        if len(session.points) > 300:
            session.points = session.points[-300:]

        # Spatial risk analysis via safety_db
        risk_eval = safety_db.evaluate_location_risk(lat, lng)

        # Corridor deviation check
        deviation_meters = 0.0
        deviation_alert = False
        if session.start_lat and session.dest_lat and session.dest_lng:
            deviation_meters = cross_track_distance_meters(
                p_lat=lat,
                p_lng=lng,
                start_lat=session.start_lat,
                start_lng=session.start_lng,
                end_lat=session.dest_lat,
                end_lng=session.dest_lng,
            )
            if deviation_meters > self.max_deviation:
                deviation_alert = True

        # Calculate composite safety score (0 to 100)
        safety_score = 100
        alerts: List[str] = []

        # Deduct for danger zones
        if risk_eval["level"] == "high":
            safety_score -= 35
            alerts.append(f"High-Risk Zone Alert: Inside {risk_eval['zoneName']}. Keep doors locked.")
        elif risk_eval["level"] == "moderate":
            safety_score -= 15
            alerts.append(f"Moderate Risk Area: {risk_eval['zoneName']}. Stay alert.")

        # Deduct for dwell/stationary stop
        if is_stationary and dwell_seconds >= self.max_stationary_time:
            safety_score -= 30
            dwell_mins = round(dwell_seconds / 60, 1)
            alerts.append(f"Stationary Dwell Alert: Vehicle stationary for {dwell_mins} mins at this location.")

        # Deduct for route deviation
        if deviation_alert:
            safety_score -= 30
            alerts.append(f"Route Deviation: Vehicle has drifted {round(deviation_meters)}m off expected corridor.")

        safety_score = max(5, min(100, safety_score))

        # Overall Status
        if safety_score < 50:
            status = "critical"
        elif safety_score < 80:
            status = "warning"
        else:
            status = "safe"

        session.status = status

        nearest_saps = risk_eval.get("nearestStation", {})

        return {
            "sessionId": session_id,
            "status": status,
            "safetyScore": safety_score,
            "inDangerZone": risk_eval.get("inZone", False) and risk_eval.get("level") == "high",
            "dangerZoneName": risk_eval["zoneName"] if risk_eval.get("inZone") else None,
            "riskLevel": risk_eval["level"],
            "deviationMeters": round(deviation_meters, 1),
            "isStationary": is_stationary,
            "dwellSeconds": round(dwell_seconds, 1),
            "nearestStation": nearest_saps,
            "alerts": alerts,
            "breadcrumbCount": len(session.points),
            "lastUpdated": now,
        }

    def close_session(self, session_id: str) -> bool:
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False


# Singleton engine instance
watchdog_engine = WatchdogTelemetryEngine()
