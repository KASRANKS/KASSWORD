"""Kassword local dev server - no-cache + correct WASM mime + LOCALHOST-ONLY bind.

Binds to '127.0.0.1' explicitly (not 0.0.0.0, so no other device on the LAN can reach the wallet
origin) AND rejects any request whose Host header is not localhost, so a DNS-rebinding attacker
cannot resolve an attacker domain to 127.0.0.1, load malicious JS into the wallet origin, and read
the encrypted vault or call the signer.

Robust startup: if the requested port is already in use (another copy running, or another app),
it automatically tries the next ports instead of crashing with WinError 10013, prints the URL it
actually bound, and opens your browser there.
"""
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

REQ_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 7852
PORT_TRIES = 30


def make_handler(port):
    allowed = {f'127.0.0.1:{port}', f'localhost:{port}', f'[::1]:{port}'}

    class NoCacheHandler(SimpleHTTPRequestHandler):
        # Serve .wasm with a single application/wasm Content-Type via guess_type()
        # (send_head sets it once), instead of appending a second header in end_headers() which produced
        # the duplicated "Content-Type: application/wasm, application/wasm".
        extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm'}

        def _check_host(self):
            if self.headers.get('Host', '') not in allowed:
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
            if self._check_host():
                super().do_GET()

        def do_HEAD(self):
            if self._check_host():
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
            if self._check_host():
                self.send_response(204)
                self.end_headers()

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            self.send_header('X-Frame-Options', 'DENY')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('X-Content-Type-Options', 'nosniff')
            super().end_headers()

        def log_message(self, fmt, *args):
            if args and len(args) >= 2 and str(args[1]) != '200':
                super().log_message(fmt, *args)

    return NoCacheHandler


if __name__ == '__main__':
    server = None
    chosen = None
    for p in range(REQ_PORT, REQ_PORT + PORT_TRIES):
        try:
            server = ThreadingHTTPServer(('127.0.0.1', p), make_handler(p))
            chosen = p
            break
        except OSError:
            continue  # port busy - try the next one instead of crashing

    if server is None:
        print(f'  Could not find a free port in {REQ_PORT}..{REQ_PORT + PORT_TRIES - 1}.')
        print('  Close whatever is using those ports and try again.')
        sys.exit(1)

    url = f'http://127.0.0.1:{chosen}/'
    if chosen != REQ_PORT:
        print(f'  Port {REQ_PORT} was busy - using {chosen} instead.')
    print(f'  Serving KASSWORD (no-cache, localhost-only) on {url}')
    print('  Opening your browser... (press Ctrl+C here to stop)')
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  Server stopped.')
