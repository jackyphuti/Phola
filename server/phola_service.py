#!/usr/bin/env python3
"""
Phola Python Local & Container Service Runner.
Delegates to api/index.py for unified local and Vercel serverless execution.
"""

import os
import sys
from http.server import ThreadingHTTPServer
from pathlib import Path

# Add api directory to path
api_dir = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(api_dir))

from index import handler

if __name__ == "__main__":
    host = os.getenv("PHOLA_HOST", "127.0.0.1")
    port = int(os.getenv("PHOLA_PORT", "8000"))
    server = ThreadingHTTPServer((host, port), handler)
    print(f"Phola Python Service running on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
