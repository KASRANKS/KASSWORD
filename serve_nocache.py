"""Kassword local dev server - no-cache + correct WASM mime + LOCALHOST-ONLY bind.

Wave 1B #5 hardening: bind to '127.0.0.1' explicitly (not 0.0.0.0, so no other device on
the LAN can reach the wallet origin) AND reject any request whose Host header is not localhost,
so a DNS-rebinding attacker cannot resolve an attacker domain to 127.0.0.1, load malicious JS
into the wallet origin, and read the encrypted vault or call the signer.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7852
ALLOWED_HOSTS = {f'127.0.0.1:{PORT}', f'localhost:{PORT}', f'[::1]:{PORT}'}

class NoCacheHandler(SimpleHTTPRequestHandler):
    def _check_host(self):
        host = self.headers.get('Host', '')
        if host not in ALLOWED_HOSTS:
            self.send_response(403)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            try:
                self.wfile.write(b'Forbidden -- host header must be 127.0.0.1 or localhost')
            except Exception:
                pass
            return False
        return True

    def do_GET(self):
        if not self._check_host():
            return
        super().do_GET()

    def do_HEAD(self):
        if not self._check_host():
            return
        super().do_HEAD()

    def do_POST(self):
        if not self._check_host():
            return
        try:
            super().do_POST()
        except Exception:
            self.send_response(501)
            self.end_headers()

    def do_OPTIONS(self):
        if not self._check_host():
            return
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'no-referrer')
        if self.path.endswith('.wasm'):
            self.send_header('Content-Type', 'application/wasm')
        super().end_headers()
    def log_message(self, fmt, *args):
        if args and len(args) >= 2 and str(args[1]) != '200':
            super().log_message(fmt, *args)

if __name__ == '__main__':
    print(f'  Serving KASSWORD (no-cache, localhost-only) on http://127.0.0.1:{PORT}')
    print(f'  Press Ctrl+C to stop')
    try:
        ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler).serve_forever()
    except KeyboardInterrupt:
        print('\n  Server stopped.')
