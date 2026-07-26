#!/usr/bin/env python3
"""Static server for the built frontend, with correct cache headers.

    python3 serve_dist.py <port> <dist-dir>

- /assets/* filenames carry content hashes -> cache forever
- everything else (index.html) -> no-cache, so browsers revalidate every
  load and never keep serving a stale bundle after a redeploy
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class CacheAwareHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.path.startswith("/assets/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):  # 与 http.server 默认一致但去掉 DNS 反查
        sys.stderr.write("%s - %s\n" % (self.client_address[0], fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8002
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(CacheAwareHandler, directory=directory)
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    main()
