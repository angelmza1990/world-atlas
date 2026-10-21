"""Download every source into data/raw/.

    python3 scripts/fetch_data.py

  data/raw/wb/<CODE>.csv      World Bank indicator: iso3, year, value (countries and the world aggregate)
  data/raw/wb-countries.json  World Bank country list (region, income level, capital)
  data/raw/countries.json     mledoze/countries (ODbL): names, capitals, languages, currencies, borders
  data/raw/countries-50m.json Natural Earth country shapes, as TopoJSON (world-atlas 2.0.2)
  assets/flags/<iso2>.svg     flags from flagcdn.com (public domain)

The files are kept in the repo as a snapshot. A download that comes back much smaller than
the snapshot it would replace is rejected and the old file is kept.
"""

import csv
import io
import json
import sys
import time
import urllib.request
from pathlib import Path

from universe import FIRST_YEAR, INDICATORS, PYRAMID

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
FLAGS = ROOT / "assets" / "flags"
UA = {"User-Agent": "world-atlas/1.0 (https://github.com/angelmza1990/world-atlas)"}


def get(url, timeout=90, tries=3):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:
            print(f"  retry {url[:90]}: {type(e).__name__}")
            time.sleep(5 * (attempt + 1))
    return None


def keep_or_replace(path, data, min_ratio=0.9):
    if path.exists() and len(data) < path.stat().st_size * min_ratio:
        print(f"  ! {path.name}: new file is much smaller than the snapshot; keeping the snapshot")
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    tmp.write_bytes(data)
    tmp.replace(path)
    return True


def fetch_indicator(code):
    url = (f"https://api.worldbank.org/v2/country/all/indicator/{code}"
           f"?format=json&per_page=20000&date={FIRST_YEAR}:2030")
    body = get(url)
    if body is None:
        return False
    payload = json.loads(body)
    if len(payload) < 2 or not payload[1]:
        print(f"  ! {code}: empty response")
        return False
    rows = [(r["countryiso3code"], r["date"], r["value"]) for r in payload[1]
            if r["value"] is not None and r["countryiso3code"]]
    rows.sort()
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["iso3", "year", "value"])
    for iso, year, v in rows:
        w.writerow([iso, year, f"{v:.6g}" if isinstance(v, float) else v])
    ok = keep_or_replace(RAW / "wb" / f"{code}.csv", out.getvalue().encode())
    if ok:
        print(f"  {code}: {len(rows)} values")
    return ok


def main():
    failed = []
    print("World Bank indicators")
    for code in [c for _, c, *_ in INDICATORS] + [c for _, c in PYRAMID]:
        if not fetch_indicator(code):
            failed.append(code)

    print("Country metadata")
    for name, url in [
        ("wb-countries.json", "https://api.worldbank.org/v2/country?format=json&per_page=400"),
        ("countries.json", "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"),
        ("countries-50m.json", "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json"),
    ]:
        body = get(url)
        if body is None or not keep_or_replace(RAW / name, body):
            failed.append(name)
        else:
            print(f"  {name}: {len(body) / 1024:.0f} KB")

    print("Flags")
    countries = json.loads((RAW / "countries.json").read_text())
    new = 0
    for c in countries:
        iso2 = c["cca2"].lower()
        path = FLAGS / f"{iso2}.svg"
        if path.exists():
            continue
        body = get(f"https://flagcdn.com/{iso2}.svg", timeout=10, tries=1)  # only missing flags; they rarely change
        if body and body.lstrip().startswith(b"<"):
            keep_or_replace(path, body)
            new += 1
    print(f"  {new} new flags")

    if failed:
        print("Not updated:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
