#!/usr/bin/env python3
"""Serve Firebase-style SPA routes while keeping missing assets as 404."""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import re


class StaticSpaHandler(SimpleHTTPRequestHandler):
    spa_route = re.compile(r"^/(?:file|folder)/[^/]+/?$")

    def send_head(self):
        path = urlsplit(self.path).path
        candidate = Path(self.translate_path(path))
        if not candidate.is_file() and self.spa_route.fullmatch(path):
            self.path = "/index.html"
        return super().send_head()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", default=".")
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("port", type=int, nargs="?", default=3000)
    args = parser.parse_args()

    handler = lambda *handler_args, **handler_kwargs: StaticSpaHandler(
        *handler_args, directory=args.directory, **handler_kwargs
    )
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"Serving SPA static files from {Path(args.directory).resolve()} on {args.bind}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()