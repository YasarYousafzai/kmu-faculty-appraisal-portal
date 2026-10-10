"""Minimal WSGI entry point for the KMU draft appraisal calculator."""

from __future__ import annotations

import mimetypes
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent
PUBLIC_FILES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/styles.css": "styles.css",
    "/app.js": "app.js",
    "/kmu_logo.png": "kmu_logo.png",
    "/KMU_Unified_Policy_Draft.docx": "KMU_Unified_Policy_Draft.docx",
}

SECURITY_HEADERS = [
    ("Cache-Control", "no-store"),
    ("X-Content-Type-Options", "nosniff"),
    ("Referrer-Policy", "no-referrer"),
    ("Permissions-Policy", "camera=(), microphone=(), geolocation=()"),
    ("X-Frame-Options", "DENY"),
    (
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
        "connect-src 'none'; object-src 'none'; base-uri 'none'; "
        "form-action 'none'; frame-ancestors 'none'",
    ),
]


def response(start_response, status: str, body: bytes, content_type: str):
    headers = [("Content-Type", content_type), ("Content-Length", str(len(body))), *SECURITY_HEADERS]
    start_response(status, headers)
    return [body]


def application(environ, start_response):
    method = environ.get("REQUEST_METHOD", "GET").upper()
    if method not in {"GET", "HEAD"}:
        return response(start_response, "405 Method Not Allowed", b"Method not allowed", "text/plain; charset=utf-8")

    filename = PUBLIC_FILES.get(environ.get("PATH_INFO", "/"))
    if not filename:
        return response(start_response, "404 Not Found", b"Not found", "text/plain; charset=utf-8")

    file_path = PROJECT_DIR / filename
    if not file_path.is_file():
        return response(start_response, "404 Not Found", b"Not found", "text/plain; charset=utf-8")

    body = file_path.read_bytes()
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    if content_type.startswith("text/") or content_type in {"application/javascript", "application/json"}:
        content_type = f"{content_type}; charset=utf-8"
    if method == "HEAD":
        headers = [("Content-Type", content_type), ("Content-Length", str(len(body))), *SECURITY_HEADERS]
        start_response("200 OK", headers)
        return [b""]
    return response(start_response, "200 OK", body, content_type)
