#!/usr/bin/env python3
import csv
import os
import sys
import urllib.request
from urllib.parse import urlparse

CSV_URL = "https://raw.githubusercontent.com/nflverse/nflverse-pbp/master/teams_colors_logos.csv"
OUT_DIR = os.path.join("public", "images", "nfl", "teams")

def ext_from_url(url: str) -> str:
    path = urlparse(url).path.lower()
    if path.endswith(".svg"):
        return ".svg"
    if path.endswith(".png"):
        return ".png"
    if path.endswith(".jpg") or path.endswith(".jpeg"):
        return ".jpg"
    return ".img"

def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "seahawksfanzone/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)

    with urllib.request.urlopen(CSV_URL, timeout=30) as r:
        text = r.read().decode("utf-8", errors="replace")

    reader = csv.DictReader(text.splitlines())
    if not reader.fieldnames:
        print("Could not read CSV headers", file=sys.stderr)
        return 1

    # Find likely columns (CSV has been stable, but keep this resilient)
    headers = reader.fieldnames
    def pick(candidates):
        for c in candidates:
            if c in headers:
                return c
        return None

    abbr_col = pick(["team_abbr", "abbr", "team"])
    logo_col = pick(["team_logo_wikipedia", "team_logo_espn", "team_logo", "logo", "logo_url"])

    if not abbr_col or not logo_col:
        print("Could not find expected columns.", file=sys.stderr)
        print("Headers:", headers, file=sys.stderr)
        return 1

    ok = 0
    for row in reader:
        abbr = (row.get(abbr_col) or "").strip().upper()
        url = (row.get(logo_col) or "").strip()
        if not abbr or not url:
            continue

        out_path = os.path.join(OUT_DIR, f"{abbr}{ext_from_url(url)}")
        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            continue

        try:
            data = download(url)
            with open(out_path, "wb") as f:
                f.write(data)
            print(f"saved {abbr} -> {out_path}")
            ok += 1
        except Exception as e:
            print(f"FAILED {abbr}: {e}", file=sys.stderr)

    print(f"done. downloaded {ok} logos into {OUT_DIR}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
