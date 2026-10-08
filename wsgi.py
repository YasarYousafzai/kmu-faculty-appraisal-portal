"""
WSGI Application entry-point for PythonAnywhere 100% Free Cloud Hosting.
KMU Faculty Annual Performance Appraisal Web Portal (v3.0)
Statutory Policy: KMU/REG/POL/2026/01-REV
"""

import os
import sys
import mimetypes

# Set project directory
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# Initialize standard mimetypes
mimetypes.init()

def application(environ, start_response):
    path_info = environ.get('PATH_INFO', '/')
    if path_info == '/' or not path_info:
        file_path = os.path.join(PROJECT_DIR, 'index.html')
    else:
        # Strip leading slash and sanitize
        clean_path = path_info.lstrip('/')
        file_path = os.path.join(PROJECT_DIR, clean_path)

    # Security check: ensure file path remains inside PROJECT_DIR
    real_project_dir = os.path.realpath(PROJECT_DIR)
    real_file_path = os.path.realpath(file_path)

    if not real_file_path.startswith(real_project_dir):
        status = '403 Forbidden'
        headers = [('Content-Type', 'text/plain')]
        start_response(status, headers)
        return [b'403 Forbidden']

    if os.path.exists(file_path) and os.path.isfile(file_path):
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = 'application/octet-stream'

        status = '200 OK'
        headers = [
            ('Content-Type', mime_type),
            ('Access-Control-Allow-Origin', '*'),
            ('Cache-Control', 'public, max-age=3600')
        ]
        start_response(status, headers)

        with open(file_path, 'rb') as f:
            return [f.read()]
    else:
        status = '404 Not Found'
        headers = [('Content-Type', 'text/html')]
        start_response(status, headers)
        return [b'<h1>404 Not Found - KMU Performance Appraisal Portal</h1>']
