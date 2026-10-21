"""Build the site's datasets from data/raw/.

    python3 scripts/build_data.py

  data/meta.json               indicators, continents, latest year of each indicator
  data/countries.json          every country: facts and the latest value of each indicator
  data/indicators/<key>.json   one indicator for every country and year (map and rankings)
  data/series/<ISO3>.json      one country: every indicator by year and its population pyramids
  data/world.json              the world and the six continents: every indicator by year, pyramids
  data/map.json                country shapes (TopoJSON)

Continents are computed from their countries. Sums add countries up; rates are weighted by
population; per-person ratios divide two sums. A continent-year is published only when the
countries with data hold at least 90% of the continent's population, so a gap in the data
never shows up as a fall.
"""

import csv
import json
import shutil
import sys
from collections import defaultdict
from pathlib import Path

from universe import AGE_GROUPS, CONTINENTS, INDICATORS, PYRAMID, continent

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data"
COVERAGE = 0.9

# World Bank economies whose codes differ from the countries dataset, or that it lacks.
WB_TO_CCA3 = {"XKX": "UNK"}
FALLBACK = {  # iso3: (name, continent, subregion, iso2)
    "CHI": ("Channel Islands", "Europe", "Northern Europe", None),
}


def read_wb(code):
    out = defaultdict(dict)
    with (RAW / "wb" / f"{code}.csv").open() as f:
        for r in csv.DictReader(f):
            out[r["iso3"]][int(r["year"])] = float(r["value"])
    return out


def rnd(v):
    if v is None:
        return None
    a = abs(v)
    return round(v) if a >= 1000 else round(v, 2) if a >= 10 else round(v, 3)


def main():
    wb_meta = json.loads((RAW / "wb-countries.json").read_text())[1]
    rc = {c["cca3"]: c for c in json.loads((RAW / "countries.json").read_text())}
    flags = {p.stem for p in (ROOT / "assets" / "flags").glob("*.svg")}

    countries = {}
    for m in wb_meta:
        if m["region"]["value"] == "Aggregates":
            continue
        iso3 = m["id"]
        c = rc.get(WB_TO_CCA3.get(iso3, iso3))
        if c:
            cont = continent(c["region"], c["subregion"])
            iso2 = c["cca2"].lower()
            info = {
                "name": c["name"]["common"],
                "official": c["name"]["official"],
                "iso2": iso2,
                "ccn3": c.get("ccn3") or None,
                "capital": c.get("capital") or ([m["capitalCity"]] if m["capitalCity"] else []),
                "continent": cont,
                "subregion": c.get("subregion") or None,
                "languages": sorted((c.get("languages") or {}).values()),
                "currencies": [f"{v['name']} ({k})" for k, v in (c.get("currencies") or {}).items()],
                "borders": [b for b in c.get("borders", [])],
                "landlocked": c.get("landlocked", False),
                "unMember": c.get("unMember", False),
                "latlng": c.get("latlng"),
                "demonym": ((c.get("demonyms") or {}).get("eng") or {}).get("m"),
                "flag": iso2 in flags,
            }
        elif iso3 in FALLBACK:
            name, cont, sub, iso2 = FALLBACK[iso3]
            info = {"name": name, "official": name, "iso2": iso2, "ccn3": None, "capital": [], "continent": cont,
                    "subregion": sub, "languages": [], "currencies": [], "borders": [], "landlocked": False,
                    "unMember": False, "latlng": None, "demonym": None, "flag": False}
        else:
            print(f"  ! no metadata for {iso3} {m['name']}; skipped")
            continue
        if not info["continent"]:
            continue
        info.update({"iso3": iso3, "wbRegion": m["region"]["value"].strip(), "income": m["incomeLevel"]["value"]})
        countries[iso3] = info
    # borders use the countries dataset's codes; map them back to World Bank codes
    back = {v: k for k, v in WB_TO_CCA3.items()}
    for c in countries.values():
        c["borders"] = [back.get(b, b) for b in c["borders"] if back.get(b, b) in countries]

    data = {key: read_wb(code) for key, code, *_ in INDICATORS}
    pyr = {key: read_wb(code) for key, code in PYRAMID}
    years = sorted({y for d in data.values() for s in d.values() for y in s})
    last_year = years[-1]

    # ---------- per indicator ----------
    (OUT / "indicators").mkdir(exist_ok=True)
    latest_year = {}
    for key, code, label, unit, agg in INDICATORS:
        d = data[key]
        rows = {iso: [[y, rnd(v)] for y, v in sorted(d[iso].items())] for iso in countries if iso in d}
        (OUT / "indicators" / f"{key}.json").write_text(json.dumps(rows, separators=(",", ":")))
        ys = [y for iso in countries for y in d.get(iso, {})]
        latest_year[key] = max(ys) if ys else None

    # ---------- per country ----------
    (OUT / "series").mkdir(exist_ok=True)
    for iso, c in countries.items():
        series = {key: [[y, rnd(v)] for y, v in sorted(data[key].get(iso, {}).items())] for key, *_ in INDICATORS}
        pyramids = {}
        for y in years:
            fe = [pyr[f"fe{g}"].get(iso, {}).get(y) for g in AGE_GROUPS]
            ma = [pyr[f"ma{g}"].get(iso, {}).get(y) for g in AGE_GROUPS]
            if None in fe or None in ma:
                continue
            nf, nm = data["female"].get(iso, {}).get(y), data["male"].get(iso, {}).get(y)
            if nf is None or nm is None:
                continue
            pyramids[y] = [[round(p * nf / 100) for p in fe], [round(p * nm / 100) for p in ma]]
        (OUT / "series" / f"{iso}.json").write_text(json.dumps({"series": series, "pyramids": pyramids}, separators=(",", ":")))
        c["latest"] = {}
        for key, *_ in INDICATORS:
            s = data[key].get(iso)
            if s:
                y = max(s)
                if y >= last_year - 10:
                    c["latest"][key] = [rnd(s[y]), y]

    # ---------- continents and the world ----------
    def aggregate(members):
        out = {}
        pop = data["population"]
        for key, code, label, unit, agg in INDICATORS:
            if agg == "none":
                continue
            rows = []
            for y in years:
                total_pop = sum(pop[i][y] for i in members if y in pop.get(i, {}))
                if not total_pop:
                    continue
                def covered(keys):
                    have = [i for i in members if all(y in data[k].get(i, {}) for k in keys) and y in pop.get(i, {})]
                    return have, sum(pop[i][y] for i in have) / total_pop
                if agg == "sum":
                    have, cov = covered([key])
                    if cov < COVERAGE:
                        continue
                    rows.append([y, rnd(sum(data[key][i][y] for i in have))])
                elif agg == "weighted":
                    have, cov = covered([key])
                    if cov < COVERAGE:
                        continue
                    w = sum(pop[i][y] for i in have)
                    rows.append([y, rnd(sum(data[key][i][y] * pop[i][y] for i in have) / w)])
                else:  # ratio
                    num_key = {"density": "population", "gdpPerCap": "gdp", "gdpPerCapPpp": "gdpPpp"}[key]
                    den_key = {"density": "landArea", "gdpPerCap": "population", "gdpPerCapPpp": "population"}[key]
                    have, cov = covered([num_key, den_key])
                    if cov < COVERAGE:
                        continue
                    rows.append([y, rnd(sum(data[num_key][i][y] for i in have) / sum(data[den_key][i][y] for i in have))])
            out[key] = rows
        pyramids = {}
        for y in years:
            fe, ma, ok = [0] * len(AGE_GROUPS), [0] * len(AGE_GROUPS), 0
            total = sum(pop[i][y] for i in members if y in pop.get(i, {}))
            for i in members:
                f = [pyr[f"fe{g}"].get(i, {}).get(y) for g in AGE_GROUPS]
                m = [pyr[f"ma{g}"].get(i, {}).get(y) for g in AGE_GROUPS]
                nf, nm = data["female"].get(i, {}).get(y), data["male"].get(i, {}).get(y)
                if None in f or None in m or nf is None or nm is None:
                    continue
                ok += pop[i].get(y, 0)
                for k in range(len(AGE_GROUPS)):
                    fe[k] += f[k] * nf / 100
                    ma[k] += m[k] * nm / 100
            if total and ok / total >= COVERAGE:
                pyramids[y] = [[round(v) for v in fe], [round(v) for v in ma]]
        return {"series": out, "pyramids": pyramids, "members": len(members)}

    world = {"world": aggregate(list(countries))}
    for cont in CONTINENTS:
        world[cont] = aggregate([i for i, c in countries.items() if c["continent"] == cont])
    (OUT / "world.json").write_text(json.dumps(world, separators=(",", ":")))

    # ---------- sanity checks ----------
    wpop = dict(world["world"]["series"]["population"])
    wb_world = data["population"]["WLD"]
    y = max(wpop)
    if abs(wpop[y] / wb_world[y] - 1) > 0.01:
        sys.exit(f"World population {y}: countries add up to {wpop[y]:,}, World Bank total {wb_world[y]:,.0f}")
    for iso, lo, hi in [("CHN", 1.3e9, 1.5e9), ("IND", 1.3e9, 1.6e9), ("ARG", 4e7, 5e7)]:
        p = countries[iso]["latest"]["population"][0]
        if not lo <= p <= hi:
            sys.exit(f"{iso} population {p} outside [{lo}, {hi}]")
    if len(countries) < 210:
        sys.exit(f"only {len(countries)} countries")

    meta = {
        "updated": max(latest_year.values()),
        "indicators": [{"key": k, "code": c, "label": l, "unit": u, "agg": a, "latest": latest_year[k]} for k, c, l, u, a in INDICATORS],
        "continents": CONTINENTS,
        "ageGroups": [g[:2].lstrip("0") + ("+" if g.endswith("UP") else "–" + g[2:].lstrip("0")) if g != "0004" else "0–4" for g in AGE_GROUPS],
    }
    (OUT / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    (OUT / "countries.json").write_text(json.dumps(sorted(countries.values(), key=lambda c: c["name"]), separators=(",", ":"), ensure_ascii=False))
    shutil.copyfile(RAW / "countries-50m.json", OUT / "map.json")
    print(f"{len(countries)} countries; world population {y}: {wpop[y]:,} (World Bank {wb_world[y]:,.0f})")
    for cont in CONTINENTS:
        s = dict(world[cont]["series"]["population"])
        print(f"  {cont:14} {world[cont]['members']:3} countries  population {s.get(y, 0):>14,}")
    size = sum(p.stat().st_size for p in OUT.glob("**/*.json") if "raw" not in p.parts)
    print(f"output: {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
