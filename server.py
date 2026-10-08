#!/usr/bin/env python3
"""
KMU Faculty Annual Performance Appraisal Web Portal (v3.0)
Lightweight local HTTP server for development, preview, and departmental network sharing.
Zero external dependencies (uses standard library http.server).
"""

import http.server
import socketserver
import os
import sys
import webbrowser

PORT = 8088

class KMUAppraisalHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and caching headers for local testing
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def main():
    directory = os.path.dirname(os.path.abspath(__file__))
    os.chdir(directory)

    port = PORT
    for attempt in range(5):
        try:
            with socketserver.TCPServer(("", port), KMUAppraisalHandler) as httpd:
                url = f"http://localhost:{port}"
                print("=" * 70)
                print("  KHYBER MEDICAL UNIVERSITY (KMU), PESHAWAR")
                print("  Faculty Annual Performance Appraisal Web Portal (v3.0)")
                print("  Statutory Reference: KMU/REG/POL/2026/01-REV")
                print("=" * 70)
                print(f"  [+] Local Portal Server running at: {url}")
                print(f"  [+] Serving directory: {directory}")
                print("  [+] Press Ctrl+C to stop the server")
                print("=" * 70)
                
                # Attempt to open default browser automatically
                try:
                    webbrowser.open(url)
                except Exception:
                    pass

                httpd.serve_forever()
                break
        except OSError as e:
            if "Address already in use" in str(e):
                port += 1
            else:
                raise e

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("[+] KMU Appraisal Portal server stopped cleanly.")
        sys.exit(0)
