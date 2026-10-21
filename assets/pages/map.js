// World map: choropleth of any indicator by year, world totals and a ranking of every country.
(function () {
  const { fmt, esc, flagImg, countryLink } = WA;
  MH.shell("map");

  const GROUPS = [
    ["Population", ["population", "popGrowth", "birthRate", "deathRate", "fertility", "lifeExp", "infantMort", "age0014", "age65", "urban", "netMigration"]],
    ["Land", ["landArea", "density"]],
    ["Economy", ["gdp", "gdpPerCap", "gdpPerCapPpp", "gdpGrowth", "inflation", "unemployment", "gini", "agriculture", "industry", "services", "exports"]],
    ["Society", ["internet"]],
  ];
  const TILES = ["population", "popGrowth", "birthRate", "fertility", "lifeExp", "age65", "urban", "gdp", "gdpPerCap"];

  Promise.all([MH.load("meta"), MH.load("countries"), MH.load("world")]).then(([meta, countries, world]) => {
    const ind = Object.fromEntries(meta.indicators.map((i) => [i.key, i]));
    const byNum = {};
    for (const c of countries) if (c.ccn3) byNum[c.ccn3] = c;
    document.getElementById("updated").textContent = `World Bank data through ${meta.updated}. ${countries.length} countries.`;

    // ---------- world tiles ----------
    const ws = world.world.series;
    document.getElementById("tiles").innerHTML = TILES.map((k) => {
      const s = ws[k];
      if (!s || !s.length) return "";
      const [y, v] = s.at(-1);
      const prev = s.find((r) => r[0] === y - 10);
      const change = prev ? (k === "population" || k === "gdp" ? `${MH.spct(v / prev[1] - 1, 0)} in 10 years` : `${fmt(k, prev[1])} in ${y - 10}`) : "";
      return `<div class="tile"><p class="label">${esc(ind[k].label)}, ${y}</p><div class="value">${fmt(k, v)}</div><div class="delta"><span>${esc(/^(people|current|%)/.test(ind[k].unit) ? change : `${ind[k].unit}${change ? "; " + change : ""}`)}</span></div></div>`;
    }).join("");

    // ---------- controls ----------
    const sel = document.getElementById("indicator");
    for (const [g, keys] of GROUPS) {
      const og = document.createElement("optgroup");
      og.label = g;
      for (const k of keys) og.append(new Option(ind[k].label, k));
      sel.append(og);
    }
    const q = new URLSearchParams(location.search);
    const state = { key: ind[q.get("i")] ? q.get("i") : "population", year: +q.get("y") || null, cont: "All", dir: -1 };
    sel.value = state.key;
    const slider = document.getElementById("year");
    sel.addEventListener("change", () => { state.key = sel.value; state.year = null; update(); });
    slider.addEventListener("input", () => { state.year = +slider.value; document.getElementById("year-label").textContent = slider.value; draw(); });
    MH.seg(document.getElementById("cont-filter"), [["All", "All"]].concat(meta.continents.map((c) => [c, c])), "All", (c) => { state.cont = c; table(); });

    let rows = {}; // iso3 -> [[year, v]]
    function update() {
      MH.load(`indicators/${state.key}`).then((r) => {
        rows = r;
        const years = Object.values(rows).flatMap((s) => s.map((p) => p[0]));
        const lo = Math.min(...years), hi = ind[state.key].latest;
        slider.min = lo;
        slider.max = hi;
        if (!state.year || state.year > hi || state.year < lo) state.year = hi;
        slider.value = state.year;
        document.getElementById("year-label").textContent = state.year;
        draw();
      }).catch(MH.fail);
    }

    // value for a year, or the most recent one in the four years before
    function valueAt(iso, year) {
      const s = rows[iso];
      if (!s) return null;
      for (let i = s.length - 1; i >= 0; i--) {
        if (s[i][0] <= year) return year - s[i][0] <= 4 ? { v: s[i][1], y: s[i][0] } : null;
      }
      return null;
    }

    let current = [];
    function draw() {
      const k = state.key, y = state.year, meta_ = ind[k];
      history.replaceState(null, "", `?i=${k}${y !== meta_.latest ? `&y=${y}` : ""}`);
      current = countries.map((c) => ({ c, ...(valueAt(c.iso3, y) || { v: null, y: null }) }));
      const scale = WA.scaleFor(k, current.map((d) => d.v));
      const val = Object.fromEntries(current.map((d) => [d.c.iso3, d]));
      document.getElementById("map-title").textContent = `${meta_.label}, ${y}`;
      document.getElementById("map-sub").textContent = meta_.unit;
      document.getElementById("legend").innerHTML = WA.legendHTML(scale.bins, WA.DIVERGING.has(k) ? "" : "Seven groups with the same number of countries.");
      WA.drawMap(document.getElementById("map"), {
        byNum, label: `${meta_.label} by country`,
        value: (c) => val[c.iso3]?.v ?? null,
        color: scale.color,
        onClick: (c) => { location.href = countryLink(c); },
        tip: (evt, c, v) => {
          const d = val[c.iso3];
          MH.showTip(evt, c.name, [{ value: fmt(k, v, "long"), label: d && d.y && d.y !== y ? `in ${d.y}` : "" }, { value: c.continent, label: "" }]);
        },
      });
      table();
    }

    function table() {
      const k = state.key, meta_ = ind[k];
      const list = current.filter((d) => d.v != null && (state.cont === "All" || d.c.continent === state.cont))
        .sort((a, b) => (b.v - a.v) * -state.dir); // dir -1: largest first
      const share = meta_.agg === "sum" && k !== "netMigration";
      const total = share ? d3.sum(current, (d) => (d.v > 0 ? d.v : 0)) : null;
      const max = d3.max(list, (d) => Math.abs(d.v)) || 1;
      document.getElementById("rank-title").textContent = `${meta_.label}: ranking, ${state.year}`;
      const tbl = document.getElementById("ranking");
      tbl.innerHTML = `<thead><tr><th style="width:40px">#</th><th style="text-align:left">Country</th><th style="text-align:left">Continent</th>
        <th data-sort="v" aria-sort="${state.dir < 0 ? "descending" : "ascending"}" style="cursor:pointer">${esc(meta_.label)}</th>
        ${share ? "<th>Share of world</th>" : ""}<th style="width:130px"></th></tr></thead><tbody>` +
        list.map((d, i) => `<tr>
          <td class="muted">${i + 1}</td>
          <td style="text-align:left"><a href="${countryLink(d.c)}">${flagImg(d.c)} ${esc(d.c.name)}</a></td>
          <td style="text-align:left" class="muted">${esc(d.c.continent)}</td>
          <td>${fmt(k, d.v)}${d.y !== state.year ? ` <span class="muted">(${d.y})</span>` : ""}</td>
          ${share ? `<td>${MH.pct(d.v / total, d.v / total < 0.001 ? 2 : 1)}</td>` : ""}
          <td style="text-align:left"><span class="share-bar" style="width:${(Math.abs(d.v) / max) * 120}px;${d.v < 0 ? "background:var(--neg-3)" : ""}"></span></td></tr>`).join("") +
        `</tbody>`;
      tbl.querySelector("th[data-sort]").onclick = () => { state.dir = -state.dir; table(); };
    }

    update();
  }).catch(MH.fail);
})();
