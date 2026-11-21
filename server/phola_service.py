#!/usr/bin/env python3
"""
Phola Python Runtime Microservice.
High-concurrency, zero-external-dependency background HTTP server powering:
- Live Safe Ride watchdog telemetry and corridor anomaly detection
- Court-admissible Section 212 SAPS sworn docket affidavit generation
- Real-time geospatial danger zone and nearest SAPS station evaluation
"""

import json
import logging
import os
import signal
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docket_engine import docket_engine
from safety_db import safety_db
from watchdog_engine import watchdog_engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [PholaPy] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("PholaService")

HOST = os.getenv("PHOLA_HOST", "127.0.0.1")
PORT = int(os.getenv("PHOLA_PORT", "8000"))


class PholaRequestHandler(BaseHTTPRequestHandler):
    """Handles HTTP requests with full CORS and JSON support."""

    server_version = "PholaPyService/1.0"

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
        self.send_header("Access-Control-Max-Age", "86400")

    def _send_json(self, status_code: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_cors_headers()
        self.end_headers()

    def _read_json_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        raw = self.rfile.read(content_length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception as e:
            logger.warning(f"Malformed JSON payload received: {e}")
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Support both bare and /py-api prefixed paths
        if path.startswith("/py-api"):
            path = path[len("/py-api"):]
            if not path:
                path = "/"

        if path in ("", "/", "/health"):
            self._send_json(
                HTTPStatus.OK,
                {
                    "status": "healthy",
                    "service": "Phola Python Runtime Service",
                    "version": "1.0.0",
                    "sapsStationsLoaded": len(safety_db.get_all_stations()),
                    "dangerZonesLoaded": len(safety_db.get_all_zones()),
                    "activeWatchdogSessions": len(watchdog_engine.sessions),
                },
            )
        elif path == "/safety/zones":
            self._send_json(HTTPStatus.OK, {"zones": safety_db.get_all_zones()})
        elif path == "/safety/stations":
            self._send_json(HTTPStatus.OK, {"stations": safety_db.get_all_stations()})
        else:
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Route not found", "path": self.path})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Support both bare and /py-api prefixed paths
        if path.startswith("/py-api"):
            path = path[len("/py-api"):]

        body = self._read_json_body()

        try:
            if path == "/watchdog/telemetry":
                session_id = body.get("sessionId")
                lat = body.get("lat") or body.get("currentLat")
                lng = body.get("lng") or body.get("currentLng")

                if not session_id or lat is None or lng is None:
                    self._send_json(
                        HTTPStatus.BAD_REQUEST,
                        {"error": "Missing required fields: sessionId, lat, lng"},
                    )
                    return

                res = watchdog_engine.record_telemetry(
                    session_id=str(session_id),
                    lat=float(lat),
                    lng=float(lng),
                    timestamp=body.get("timestamp"),
                    speed_kmh=body.get("speedKmh"),
                    heading=body.get("heading"),
                    service_id=body.get("serviceId", "uber"),
                    destination=body.get("destination", ""),
                    dest_lat=body.get("destLat"),
                    dest_lng=body.get("destLng"),
                )
                self._send_json(HTTPStatus.OK, res)

            elif path == "/watchdog/close":
                session_id = body.get("sessionId")
                if not session_id:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Missing sessionId"})
                    return
                closed = watchdog_engine.close_session(str(session_id))
                self._send_json(HTTPStatus.OK, {"closed": closed, "sessionId": session_id})

            elif path == "/docket/generate":
                if not body:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Empty incident body"})
                    return
                docket = docket_engine.generate_docket(body)
                self._send_json(HTTPStatus.OK, docket)

            elif path == "/safety/evaluate":
                lat = body.get("lat")
                lng = body.get("lng")
                if lat is None or lng is None:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Missing coordinates: lat, lng"})
                    return
                result = safety_db.evaluate_location_risk(float(lat), float(lng))
                self._send_json(HTTPStatus.OK, result)

            else:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Route not found", "path": self.path})

        except Exception as e:
            logger.error(f"Error handling POST {path}: {e}", exc_info=True)
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(e)})

    def log_message(self, format, *args):
        # Override default stderr logging to use logger
        logger.info("%s - %s" % (self.address_string(), format % args))


def run_server():
    server = ThreadingHTTPServer((HOST, PORT), PholaRequestHandler)
    logger.info(f"Phola Python Service listening on http://{HOST}:{PORT}")
    logger.info(f"Loaded {len(safety_db.get_all_stations())} SAPS stations & {len(safety_db.get_all_zones())} danger zones.")

    def handle_sig(sig, frame):
        logger.info("Gracefully stopping Phola Python service...")
        server.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_sig)
    signal.signal(signal.SIGTERM, handle_sig)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        logger.info("Phola Python service terminated cleanly.")


if __name__ == "__main__":
    run_server()
