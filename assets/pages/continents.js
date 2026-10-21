// Continents: shares of the world, a comparison table, series since 1960 and pyramids.
(function () {
  const { fmt, esc, flagImg, countryLink, compact, CONTINENT_COLOR } = WA;
  MH.shell("continents");

  Promise.all([MH.load("meta"), MH.load("countries"), MH.load("world")]).then(([meta, countries, world]) => {
    const conts = meta.continents;
    const ind = Object.fromEntries(meta.indicators.map((i) => [i.key, i]));
    document.getElementById("updated").textContent = `World Bank data through ${meta.updated}.`;

    // latest year every continent has, so the comparison uses one year
    const common = (k) => Math.min(...conts.map((c) => (world[c].series[k] || []).at(-1)?.[0] ?? -Infinity));
    const at = (c, k, y) => (world[c].series[k] || []).find((r) => r[0] === y)?.[1] ?? null;

    // ---------- shares ----------
    const rows = [["population", "Population"], ["surfaceArea", "Surface area"], ["gdp", "GDP"]].map(([k, label]) => {
      const y = common(k);
      const vals = conts.map((c) => ({ c, v: at(c, k, y) }));
      const total = d3.sum(vals, (d) => d.v);
      return { k, label, y, vals: vals.map((d) => ({ ...d, s: d.v / total })), total };
    });
    const sh = document.getElementById("shares");
    for (const r of rows) {
      const div = document.createElement("div");
      div.className = "share-row";
      div.innerHTML = `<div class="lbl"><span>${r.label}, ${r.y}</span><span class="muted">World: ${fmt(r.k, r.total, "long")}</span></div><div class="stack"></div>`;
      const st = div.querySelector(".stack");
      for (const d of r.vals) {
        const sp = document.createElement("span");
        sp.style.flex = `${d.s} 1 0`;
        sp.style.background = CONTINENT_COLOR[d.c];
        if (d.s > 0.07) sp.textContent = `${d.c} ${MH.pct(d.s, 0)}`;
        else if (d.s > 0.035) sp.textContent = MH.pct(d.s, 0);
        sp.addEventListener("pointermove", (evt) => MH.showTip(evt, `${d.c}, ${r.y}`, [{ value: MH.pct(d.s, 1), label: `of world ${r.label.toLowerCase()}` }, { value: fmt(r.k, d.v, "long"), label: "" }]));
        sp.addEventListener("pointerleave", MH.hideTip);
        st.append(sp);
      }
      sh.append(div);
    }
    const lg = `${conts.map((c) => `<span class="key"><span class="sw" style="background:${CONTINENT_COLOR[c]}"></span>${c}</span>`).join("")}`;
    document.getElementById("shares-legend").innerHTML = lg;

    // ---------- table ----------
    const cols = ["population", "surfaceArea", "density", "gdp", "gdpPerCap", "birthRate", "fertility", "lifeExp", "age65", "urban"];
    const years = Object.fromEntries(cols.map((k) => [k, common(k)]));
    const popTotal = d3.sum(conts, (c) => at(c, "population", years.population));
    const tops = Object.fromEntries(conts.map((c) => [c, countries.filter((x) => x.continent === c && x.latest.population).sort((a, b) => b.latest.population[0] - a.latest.population[0])]));
    document.getElementById("table").innerHTML = `<thead><tr><th>Continent</th><th>Countries</th>${cols.map((k) => `<th>${esc(ind[k].label)}<br><span style="font-weight:400">${years[k]}</span></th>`).join("")}<th>Share of people</th></tr></thead><tbody>` +
      conts.map((c) => `<tr><td><span class="dot" style="background:${CONTINENT_COLOR[c]}"></span>${c}</td><td>${world[c].members}</td>
        ${cols.map((k) => `<td>${fmt(k, at(c, k, years[k]))}</td>`).join("")}<td>${MH.pct(at(c, "population", years.population) / popTotal)}</td></tr>`).join("") +
      `<tr style="font-weight:600"><td>World</td><td>${world.world.members}</td>${cols.map((k) => `<td>${fmt(k, (world.world.series[k] || []).find((r) => r[0] === years[k])?.[1])}</td>`).join("")}<td>100%</td></tr></tbody>`;

    // ---------- charts ----------
    const D = WA.toDates;
    const popByYear = (y) => d3.sum(conts, (c) => at(c, "population", y));
    const shareSeries = (c) => world[c].series.population.map(([y, v]) => [y, (v / popByYear(y)) * 100]).filter(([, v]) => isFinite(v));
    const defs = [
      { k: "population", title: "Population", meta: "people", y: (v) => compact(v, 1), tip: (v) => fmt("population", v, "long") },
      { k: "share", title: "Share of world population", meta: "%", y: (v) => v.toFixed(0) + "%", tip: (v) => v.toFixed(1) + "%", custom: shareSeries },
      { k: "birthRate", title: "Birth rate", meta: "births per 1,000 people", y: (v) => v.toFixed(0), tip: (v) => fmt("birthRate", v, "long"), world: true },
      { k: "fertility", title: "Fertility", meta: "births per woman; 2.1 is replacement level", y: (v) => v.toFixed(1), tip: (v) => fmt("fertility", v), world: true, baseline: 2.1 },
      { k: "lifeExp", title: "Life expectancy", meta: "years at birth", y: (v) => v.toFixed(0), tip: (v) => fmt("lifeExp", v, "long"), world: true },
      { k: "gdpPerCap", title: "GDP per capita", meta: "current US$, log scale", y: (v) => "$" + compact(v, 0), tip: (v) => fmt("gdpPerCap", v), world: true, log: true },
      { k: "age65", title: "Population aged 65 and over", meta: "% of population", y: (v) => v.toFixed(0) + "%", tip: (v) => fmt("age65", v), world: true },
      { k: "urban", title: "Urban population", meta: "% of population", y: (v) => v.toFixed(0) + "%", tip: (v) => fmt("urban", v), world: true },
    ];
    const wrap = document.getElementById("charts");
    for (const d of defs) {
      const series = conts.map((c) => ({ id: c, name: c, short: c, color: CONTINENT_COLOR[c], values: D(d.custom ? d.custom(c) : world[c].series[d.k] || []) }));
      if (d.world) series.push({ id: "world", name: "World", short: "World", color: "var(--ink-2)", values: D(world.world.series[d.k] || []), width: 1.25 });
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<h3>${esc(d.title)}</h3><p class="meta">${esc(d.meta)}</p><div class="chart"></div>`;
      wrap.append(card);
      MH.lineChart(card.querySelector(".chart"), { series, height: 240, endLabels: false, log: d.log, baseline: d.baseline, yFormat: d.y, tipFormat: d.tip, tipDate: d3.timeFormat("%Y"), label: d.title });
    }
    document.getElementById("charts-legend").innerHTML = lg + `<span class="key"><span class="ln" style="background:var(--ink-2)"></span>World</span>`;

    // ---------- pyramids ----------
    const py = Math.min(...conts.map((c) => Math.max(...Object.keys(world[c].pyramids).map(Number))));
    document.getElementById("pyr-sub").textContent = `Population pyramids, ${py}. Men left, women right, as a share of each continent's population, on the same scale. The top bar is everyone aged 80 and over.`;
    const max = Math.max(...conts.map((c) => { const p = world[c].pyramids[py]; return Math.max(...p.flat()) / d3.sum(p.flat()); }));
    const pw = document.getElementById("pyrs");
    for (const c of conts) {
      const card = document.createElement("div");
      card.className = "card";
      const p = world[c].pyramids[py];
      card.innerHTML = `<h3><span class="dot" style="background:${CONTINENT_COLOR[c]}"></span>${c}</h3>
        <p class="meta">${compact(d3.sum(p.flat()), 2)} people · ${fmt("age65", at(c, "age65", py) ?? null)} aged 65+</p><div class="chart"></div>
        <ul class="top-list">${tops[c].slice(0, 3).map((x) => `<li><a href="${countryLink(x)}">${flagImg(x, 11)} ${esc(x.name)}</a><span class="muted">${compact(x.latest.population[0], 1)}</span></li>`).join("")}</ul>`;
      pw.append(card);
      WA.pyramid(card.querySelector(".chart"), p, meta.ageGroups, { max, row: 11, label: `${c} population pyramid ${py}` });
    }
  }).catch(MH.fail);
})();
