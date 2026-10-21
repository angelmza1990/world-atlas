// Country profile: facts, ranks, locator map, pyramids and series since 1960.
(function () {
  const { fmt, esc, flagImg, countryLink, compact } = WA;
  MH.shell("countries");

  const SPREAD = new Set(["FRA", "USA", "RUS", "NZL", "NOR", "DNK", "GBR", "NLD", "CHL", "ECU", "ESP", "PRT", "FJI", "KIR"]);
  const TILES = ["population", "density", "birthRate", "deathRate", "fertility", "lifeExp", "infantMort", "age65", "urban", "netMigration",
    "gdp", "gdpPerCap", "gdpPerCapPpp", "gdpGrowth", "inflation", "unemployment", "gini", "internet"];

  Promise.all([MH.load("meta"), MH.load("countries"), MH.load("world")]).then(([meta, countries, world]) => {
    const ind = Object.fromEntries(meta.indicators.map((i) => [i.key, i]));
    const byIso = Object.fromEntries(countries.map((c) => [c.iso3, c]));
    const byName = Object.fromEntries(countries.map((c) => [c.name.toLowerCase(), c]));
    const q = new URLSearchParams(location.search);
    const c = byIso[(q.get("c") || "ARG").toUpperCase()] || byIso.ARG;
    document.title = `${c.name} · World Atlas`;

    // ---------- search ----------
    const dl = document.getElementById("country-list");
    for (const x of countries) dl.append(new Option(x.name));
    const search = document.getElementById("search");
    search.addEventListener("change", () => {
      const hit = byName[search.value.trim().toLowerCase()] || countries.find((x) => x.name.toLowerCase().startsWith(search.value.trim().toLowerCase()));
      if (hit) location.href = countryLink(hit);
    });

    // ---------- head and facts ----------
    document.getElementById("head").innerHTML = `
      ${c.flag ? `<img src="../assets/flags/${c.iso2}.svg" alt="Flag of ${esc(c.name)}">` : ""}
      <div><p class="eyebrow" style="margin:0 0 4px">${esc(c.continent)}${c.subregion && c.subregion !== c.continent ? " · " + esc(c.subregion) : ""}</p>
      <h1 style="margin:0">${esc(c.name)}</h1>
      <p class="lede" style="font-size:15px">${esc(c.official)}</p></div>`;
    const L = c.latest;
    const facts = [
      ["Capital", c.capital.join(", ") || "–"],
      ["Population", L.population ? `${fmt("population", L.population[0], "long")} (${L.population[1]})` : "–"],
      ["Surface area", L.surfaceArea ? fmt("surfaceArea", L.surfaceArea[0], "long") : "–"],
      ["Land area", L.landArea ? fmt("landArea", L.landArea[0], "long") : "–"],
      ["Density", L.density ? `${fmt("density", L.density[0], "long")} of land` : "–"],
      ["Languages", c.languages.join(", ") || "–"],
      ["Currencies", c.currencies.join(", ") || "–"],
      ["People", c.demonym || "–"],
      ["Income group", c.income || "–"],
      ["World Bank region", c.wbRegion],
      ["Coast", c.landlocked ? "Landlocked" : "Has a coastline"],
      ["UN member", c.unMember ? "Yes" : "No"],
      ["Borders", c.borders.length ? c.borders.map((b) => `<a href="${countryLink(byIso[b])}">${flagImg(byIso[b], 12)} ${esc(byIso[b].name)}</a>`).join(", ") : "None (no land borders)"],
    ];
    document.getElementById("facts").innerHTML = facts.map(([k, v]) => `<dt>${k}</dt><dd>${k === "Borders" ? v : esc(v)}</dd>`).join("");

    // locator map: the country, its neighbours, its continent
    const neighbours = new Set(c.borders);
    const byNum = {};
    for (const x of countries) if (x.ccn3) byNum[x.ccn3] = x;
    WA.drawMap(document.getElementById("locator"), {
      byNum, highlight: c.iso3, label: `Location of ${c.name}`,
      // Frame the country's continent. Shapes that include far-off territories (French Guiana, Alaska,
      // Svalbard, Galápagos...) would stretch the frame, so they are left out of it; Russia spans two
      // continents and keeps the whole world.
      fitTo: c.iso3 === "RUS" ? undefined : (x) => x.continent === c.continent && !SPREAD.has(x.iso3),
      value: (x) => (x.iso3 === c.iso3 ? 3 : neighbours.has(x.iso3) ? 2 : x.continent === c.continent ? 1 : null),
      color: (v) => ["", "var(--pos-1)", "var(--pos-2)", "var(--pos-3)"][v],
      onClick: (x) => { location.href = countryLink(x); },
      tip: (evt, x) => MH.showTip(evt, x.name, [{ value: x.continent, label: "" }]),
    });
    document.getElementById("neighbours-note").innerHTML = `<span class="legend" style="margin:0"><span class="key"><span class="sw" style="background:var(--pos-3)"></span>${esc(c.name)}</span>` +
      (neighbours.size ? `<span class="key"><span class="sw" style="background:var(--pos-2)"></span>Neighbours</span>` : "") +
      `<span class="key"><span class="sw" style="background:var(--pos-1)"></span>Rest of ${esc(c.continent)}</span></span>`;

    // ---------- tiles with ranks ----------
    const at = (rows, year) => { let v = null; for (const [y, x] of rows || []) if (y <= year) v = x; return v; };
    const cont = world[c.continent].series, ws = world.world.series;
    document.getElementById("tiles").innerHTML = TILES.filter((k) => L[k]).map((k) => {
      const [v, y] = L[k];
      const ranked = countries.filter((x) => x.latest[k]).sort((a, b) => b.latest[k][0] - a.latest[k][0]);
      const rank = ranked.findIndex((x) => x.iso3 === c.iso3) + 1;
      const cv = at(cont[k], y), wv = at(ws[k], y);
      const cmp = [cv != null ? `${esc(c.continent)}: ${fmt(k, cv)}` : "", wv != null ? `World: ${fmt(k, wv)}` : ""].filter(Boolean).join("<br>");
      return `<div class="tile"><p class="label">${esc(ind[k].label)}, ${y}</p><div class="value">${fmt(k, v)}</div>
        <div class="rank">#${rank} of ${ranked.length} · ${esc(ind[k].unit)}</div>${cmp ? `<div class="cmp">${cmp}</div>` : ""}</div>`;
    }).join("");

    MH.load(`series/${c.iso3}`).then((S) => {
      pyramids(S, meta, c);
      charts(S, c, cont, ws, ind);
    }).catch(MH.fail);
  }).catch(MH.fail);

  function pyramids(S, meta, c) {
    const years = Object.keys(S.pyramids).map(Number).sort((a, b) => a - b);
    if (!years.length) { document.getElementById("pyr-sub").textContent = "No age data for this country."; return; }
    const last = years.at(-1);
    const sel = document.getElementById("pyr-year");
    for (const y of years.slice(0, -1).reverse()) sel.append(new Option(String(y), String(y)));
    const first = years.includes(1990) ? 1990 : years[0];
    sel.value = String(first);
    const draw = () => {
      const a = +sel.value;
      const share = (d) => Math.max(...d.flat()) / (d3.sum(d[0]) + d3.sum(d[1]));
      const max = Math.max(share(S.pyramids[a]), share(S.pyramids[last]));
      document.getElementById("pyr-a-title").textContent = `${a} · ${compact(d3.sum(S.pyramids[a].flat()), 1)} people`;
      document.getElementById("pyr-b-title").textContent = `${last} · ${compact(d3.sum(S.pyramids[last].flat()), 1)} people`;
      WA.pyramid(document.getElementById("pyr-a"), S.pyramids[a], meta.ageGroups, { max, label: `${c.name} population pyramid ${a}` });
      WA.pyramid(document.getElementById("pyr-b"), S.pyramids[last], meta.ageGroups, { max, label: `${c.name} population pyramid ${last}` });
    };
    sel.addEventListener("change", draw);
    draw();
  }

  function charts(S, c, cont, ws, ind) {
    const D = WA.toDates;
    const s = S.series;
    const trio = (k) => [
      { id: c.iso3, name: c.name, short: c.name, color: "var(--s1)", values: D(s[k] || []) },
      { id: "cont", name: c.continent, short: c.continent, color: "var(--s2)", values: D(cont[k] || []) },
      { id: "world", name: "World", short: "World", color: "var(--muted)", values: D(ws[k] || []), width: 1.5 },
    ];
    const f = (k) => (v) => fmt(k, v);
    const defs = [
      { title: "Population", meta: "people", series: [{ id: "p", name: c.name, color: "var(--s1)", values: D(s.population) }], y: f("population"), area: true, baseline: 0 },
      { title: "Births and deaths", meta: "per 1,000 people; the gap is the natural increase", series: [
        { id: "b", name: "Birth rate", short: "Births", color: "var(--s1)", values: D(s.birthRate) },
        { id: "d", name: "Death rate", short: "Deaths", color: "var(--s2)", values: D(s.deathRate) }], y: f("birthRate"), baseline: 0 },
      { title: "Fertility", meta: "births per woman; 2.1 keeps a population stable without migration", series: trio("fertility"), y: f("fertility"), baseline: 2.1 },
      { title: "Life expectancy", meta: "years at birth", series: trio("lifeExp"), y: f("lifeExp") },
      { title: "GDP per capita", meta: "current US$, log scale", series: trio("gdpPerCap"), y: (v) => "$" + compact(v, 0), tip: f("gdpPerCap"), log: true },
      { title: "Age structure", meta: "% of population", series: [
        { id: "a", name: "Aged 0–14", short: "0–14", color: "var(--s1)", values: D(s.age0014) },
        { id: "b", name: "Aged 15–64", short: "15–64", color: "var(--s2)", values: D(s.age1564) },
        { id: "c", name: "Aged 65+", short: "65+", color: "var(--s3)", values: D(s.age65) }], y: (v) => v.toFixed(0) + "%", tip: f("age65") },
      { title: "Urban population", meta: "% of population", series: trio("urban"), y: (v) => v.toFixed(0) + "%", tip: f("urban") },
      { title: "Economic structure", meta: "value added, % of GDP", series: [
        { id: "s", name: "Services", short: "Services", color: "var(--s1)", values: D(s.services) },
        { id: "i", name: "Industry", short: "Industry", color: "var(--s2)", values: D(s.industry) },
        { id: "a", name: "Agriculture", short: "Agriculture", color: "var(--s3)", values: D(s.agriculture) }], y: (v) => v.toFixed(0) + "%", tip: f("services") },
    ];
    const wrap = document.getElementById("charts");
    const first = (s.population || [])[0];
    document.getElementById("since-sub").textContent = `${c.name} next to ${c.continent} and the world where the comparison applies. Each series starts when its data does${first ? ` (population from ${first[0]})` : ""}.`;
    for (const d of defs) {
      const series = d.series.filter((x) => x.values.length);
      if (!series.length || !series[0].values.length) continue;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<h3>${esc(d.title)}</h3><p class="meta">${esc(d.meta)}</p><div class="chart"></div>` +
        (series.length > 1 ? `<div class="legend">${series.map((x) => `<span class="key"><span class="ln" style="background:${x.color}"></span>${esc(x.name)}</span>`).join("")}</div>` : "");
      wrap.append(card);
      MH.lineChart(card.querySelector(".chart"), {
        series, height: 240, endLabels: false, log: d.log, area: d.area, baseline: d.baseline,
        yFormat: d.y, tipFormat: d.tip || d.y, tipDate: d3.timeFormat("%Y"), label: d.title,
      });
    }
    // GDP growth as yearly bars
    if (s.gdpGrowth && s.gdpGrowth.length) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<h3>GDP growth</h3><p class="meta">real change on the previous year</p><div class="chart"></div>`;
      wrap.append(card);
      MH.barChart(card.querySelector(".chart"), { data: s.gdpGrowth.map(([y, v]) => ({ year: y, value: v / 100 })), name: "GDP growth", height: 240, label: "GDP growth" });
    }
  }
})();
