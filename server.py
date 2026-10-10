#!/usr/bin/env python3
"""Local preview server for the KMU draft appraisal calculator."""

from __future__ import annotations

import argparse
import http.server
from pathlib import Path
from urllib.parse import urlsplit


PROJECT_DIR = Path(__file__).resolve().parent
PUBLIC_PATHS = {
    "/", "/index.html", "/styles.css", "/app.js", "/kmu_logo.png",
    "/KMU_Unified_Policy_Draft.docx",
}


class PortalHandler(http.server.SimpleHTTPRequestHandler):
    """Serve only the public static files required by the calculator."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIR), **kwargs)

    def _allowed(self) -> bool:
        return urlsplit(self.path).path in PUBLIC_PATHS

    def do_GET(self):  # noqa: N802 - inherited HTTP handler API
        if not self._allowed():
            self.send_error(404, "Not found")
            return
        super().do_GET()

    def do_HEAD(self):  # noqa: N802 - inherited HTTP handler API
        if not self._allowed():
            self.send_error(404, "Not found")
            return
        super().do_HEAD()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            "connect-src 'none'; object-src 'none'; base-uri 'none'; "
            "form-action 'none'; frame-ancestors 'none'",
        )
        super().end_headers()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preview the KMU draft appraisal calculator locally.")
    parser.add_argument("--host", default="127.0.0.1", help="Bind address; defaults to loopback only.")
    parser.add_argument("--port", type=int, default=8088, help="Local port; defaults to 8088.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        print("WARNING: this exposes a draft static calculator on the network. It has no authentication.")
    server = http.server.ThreadingHTTPServer((args.host, args.port), PortalHandler)
    print(f"KMU draft appraisal calculator preview: http://{args.host}:{args.port}")
    print("Controlled pilot only; do not enter confidential or disciplinary personnel data.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
