// Compare: a scatter of any two indicators for every country, sized by population, by year.
(function () {
  const { fmt, esc, compact, countryLink, CONTINENT_COLOR } = WA;
  MH.shell("compare");

  const KEYS = ["population", "popGrowth", "birthRate", "deathRate", "fertility", "lifeExp", "infantMort", "age0014", "age65", "urban", "netMigration",
    "landArea", "density", "gdp", "gdpPerCap", "gdpPerCapPpp", "gdpGrowth", "inflation", "unemployment", "gini", "agriculture", "industry", "services", "exports", "internet"];
  const LOG = new Set(["population", "landArea", "density", "gdp", "gdpPerCap", "gdpPerCapPpp", "infantMort"]);
  const PRESETS = [
    ["Fertility and income", "gdpPerCap", "fertility"],
    ["Life expectancy and income", "gdpPerCapPpp", "lifeExp"],
    ["Cities and births", "urban", "birthRate"],
    ["Ageing and income", "gdpPerCap", "age65"],
    ["Land and people", "landArea", "population"],
  ];

  Promise.all([MH.load("meta"), MH.load("countries")]).then(([meta, countries]) => {
    const ind = Object.fromEntries(meta.indicators.map((i) => [i.key, i]));
    const q = new URLSearchParams(location.search);
    const state = {
      x: ind[q.get("x")] ? q.get("x") : "gdpPerCap", y: ind[q.get("y")] ? q.get("y") : "fertility",
      year: +q.get("year") || null, view: q.get("view") === "facets" ? "facets" : "one", focus: "All",
    };
    state.logX = LOG.has(state.x);
    state.logY = LOG.has(state.y);

    const xs = document.getElementById("x"), ys = document.getElementById("y");
    for (const k of KEYS) { xs.append(new Option(ind[k].label, k)); ys.append(new Option(ind[k].label, k)); }
    xs.value = state.x; ys.value = state.y;
    xs.addEventListener("change", () => { state.x = xs.value; state.logX = LOG.has(state.x); controls(); load(); });
    ys.addEventListener("change", () => { state.y = ys.value; state.logY = LOG.has(state.y); controls(); load(); });
    const presets = document.getElementById("presets");
    presets.className = "chips";
    for (const [label, x, y] of PRESETS) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = label;
      b.addEventListener("click", () => { state.x = xs.value = x; state.y = ys.value = y; state.logX = LOG.has(x); state.logY = LOG.has(y); controls(); load(); });
      presets.append(b);
    }
    const slider = document.getElementById("year");
    slider.addEventListener("input", () => { state.year = +slider.value; document.getElementById("year-label").textContent = slider.value; draw(); });

    function controls() {
      MH.seg(document.getElementById("scale-x"), [["ll", "Log × log"], ["lx", "Log horizontal"], ["ly", "Log vertical"], ["nn", "Linear"]],
        (state.logX ? "l" : "n") + (state.logY ? "l" : "n") === "ll" ? "ll" : state.logX ? "lx" : state.logY ? "ly" : "nn",
        (v) => { state.logX = v === "ll" || v === "lx"; state.logY = v === "ll" || v === "ly"; draw(); });
      MH.seg(document.getElementById("view"), [["one", "One chart"], ["facets", "By continent"]], state.view, (v) => { state.view = v; draw(); });
      MH.seg(document.getElementById("focus"), [["All", "None"]].concat(meta.continents.map((c) => [c, c])), state.focus, (v) => { state.focus = v; draw(); });
    }
    controls();

    let data = {};
    function load() {
      Promise.all([MH.load(`indicators/${state.x}`), MH.load(`indicators/${state.y}`), MH.load("indicators/population")]).then(([X, Y, Pp]) => {
        data = { X, Y, P: Pp };
        const first = (rows) => Math.min(...Object.values(rows).map((s) => s[0][0]));
        const lo = Math.max(first(X), first(Y)), hi = Math.min(ind[state.x].latest, ind[state.y].latest);
        slider.min = lo; slider.max = hi;
        if (!state.year || state.year > hi || state.year < lo) state.year = hi;
        slider.value = state.year;
        document.getElementById("year-label").textContent = state.year;
        draw();
      }).catch(MH.fail);
    }

    const valueAt = (rows, iso, year) => {
      const s = rows[iso];
      if (!s) return null;
      for (let i = s.length - 1; i >= 0; i--) if (s[i][0] <= year) return year - s[i][0] <= 4 ? s[i][1] : null;
      return null;
    };

    function draw() {
      const { x: kx, y: ky, year } = state;
      history.replaceState(null, "", `?x=${kx}&y=${ky}&year=${year}${state.view === "facets" ? "&view=facets" : ""}`);
      document.getElementById("focus-wrap").style.display = state.view === "one" ? "" : "none";
      let dropped = 0;
      const pts = [];
      for (const c of countries) {
        const x = valueAt(data.X, c.iso3, year), y = valueAt(data.Y, c.iso3, year), p = valueAt(data.P, c.iso3, year);
        if (x == null || y == null) continue;
        if ((state.logX && x <= 0) || (state.logY && y <= 0)) { dropped++; continue; }
        pts.push({ c, x, y, p: p || 0 });
      }
      pts.sort((a, b) => b.p - a.p); // big circles first, so small ones stay on top
      const out = document.getElementById("out");
      const domX = d3.extent(pts, (d) => d.x), domY = d3.extent(pts, (d) => d.y);
      const rMax = d3.max(pts, (d) => d.p);
      document.getElementById("note").textContent = `${pts.length} countries in ${year}, sized by population; the most recent figure from the four years before is used where ${year} is missing.` +
        (dropped ? ` ${dropped} with zero or negative values are left off the log scale.` : "") + " Click a circle for the country.";
      if (state.view === "one") {
        out.innerHTML = `<div class="card"><h2>${esc(ind[ky].label)} against ${esc(ind[kx].label)}, ${year}</h2><div class="chart scatter"></div><div class="legend"></div></div>`;
        const color = (d) => (state.focus === "All" ? "var(--s1)" : d.c.continent === state.focus ? CONTINENT_COLOR[d.c.continent] : "var(--line-2)");
        const label = (state.focus === "All" ? pts : pts.filter((d) => d.c.continent === state.focus)).slice(0, 10);
        scatter(out.querySelector(".chart"), pts, { domX, domY, rMax, color, label, height: 520, rLimit: 30,
          dim: (d) => state.focus !== "All" && d.c.continent !== state.focus });
        out.querySelector(".legend").innerHTML = state.focus === "All"
          ? `<span class="muted">Choose a continent under Highlight to pick out its countries, or switch to the view by continent.</span>`
          : `<span class="key"><span class="sw" style="background:${CONTINENT_COLOR[state.focus]}"></span>${state.focus}</span><span class="key"><span class="sw" style="background:var(--line-2)"></span>Rest of the world</span>`;
      } else {
        out.innerHTML = `<div class="facets">${meta.continents.map((c) => `<div class="card"><h3>${c}</h3><div class="chart scatter" data-c="${c}"></div></div>`).join("")}</div>`;
        out.querySelectorAll(".chart").forEach((el) => {
          const cont = el.dataset.c;
          scatter(el, pts, { domX, domY, rMax, height: 260, rLimit: 16, compact: true,
            color: (d) => (d.c.continent === cont ? CONTINENT_COLOR[cont] : "var(--line-2)"),
            dim: (d) => d.c.continent !== cont, label: pts.filter((d) => d.c.continent === cont).slice(0, 3) });
        });
      }
    }

    function scatter(el, pts, o) {
      MH.responsive(el, (W) => {
        const H = W < 500 ? Math.min(o.height, 360) : o.height;
        const m = { t: 10, r: 14, b: 34, l: o.compact ? 44 : 56 };
        const iw = W - m.l - m.r, ih = H - m.t - m.b;
        // a scatter compares positions, so the linear axis spans the data instead of starting at zero
        const mk = (log, dom, range) => (log ? d3.scaleLog() : d3.scaleLinear()).domain(dom).range(range).nice();
        const x = mk(state.logX, o.domX, [0, iw]), y = mk(state.logY, o.domY, [ih, 0]);
        const r = d3.scaleSqrt().domain([0, o.rMax]).range([2, o.rLimit]);
        const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", `${ind[state.y].label} against ${ind[state.x].label}`);
        const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
        const tk = (s, n) => (s.base ? s.ticks(n).filter((v, i, a) => a.length < 8 || Math.log10(v) % 1 === 0) : s.ticks(n));
        const xt = tk(x, o.compact ? 4 : 8), yt = tk(y, o.compact ? 4 : 7);
        g.append("g").attr("class", "grid").selectAll("line").data(yt).join("line").attr("x1", 0).attr("x2", iw).attr("y1", y).attr("y2", y);
        g.append("g").attr("class", "grid").selectAll("line").data(xt).join("line").attr("y1", 0).attr("y2", ih).attr("x1", x).attr("x2", x);
        g.append("g").attr("class", "axis").call(d3.axisLeft(y).tickValues(yt).tickFormat((v) => fmt(state.y, v)).tickSize(0).tickPadding(6));
        g.append("g").attr("class", "axis").attr("transform", `translate(0,${ih})`).call(d3.axisBottom(x).tickValues(xt).tickFormat((v) => fmt(state.x, v)).tickSize(0).tickPadding(8));
        if (!o.compact) {
          g.append("text").attr("x", iw).attr("y", ih + 30).attr("text-anchor", "end").style("fill", "var(--ink-2)").text(`${ind[state.x].label} (${ind[state.x].unit}) →`);
          g.append("text").attr("x", 4).attr("y", 4).style("fill", "var(--ink-2)").text(`↑ ${ind[state.y].label} (${ind[state.y].unit})`);
        }
        const ordered = pts.filter((d) => o.dim(d)).concat(pts.filter((d) => !o.dim(d)));
        g.append("g").selectAll("circle").data(ordered).join("circle")
          .attr("cx", (d) => x(d.x)).attr("cy", (d) => y(d.y)).attr("r", (d) => r(d.p))
          .attr("fill", o.color).attr("fill-opacity", (d) => (o.dim(d) ? 0.45 : 0.75))
          .attr("stroke", "var(--surface)").attr("stroke-width", 1);
        const lab = g.append("g");
        const boxes = []; // skip a label that would overlap one already placed
        const fs = o.compact ? 10 : 11;
        for (const d of o.label) {
          const w = d.c.name.length * fs * 0.58, cx = x(d.x), cy = y(d.y) - r(d.p) - 3;
          const box = [cx - w / 2, cy - fs, cx + w / 2, cy + 2];
          if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
          boxes.push(box);
          lab.append("text").attr("x", cx).attr("y", cy).attr("text-anchor", "middle")
            .style("fill", "var(--ink)").style("font-size", o.compact ? "10px" : "11px").style("paint-order", "stroke")
            .style("stroke", "var(--surface)").style("stroke-width", "3px").text(d.c.name);
        }
        // nearest-circle hover: the pointer only has to be closest, not on the circle
        const delaunay = d3.Delaunay.from(pts, (d) => x(d.x), (d) => y(d.y));
        const ring = g.append("circle").attr("fill", "none").attr("stroke", "var(--ink)").attr("stroke-width", 1.5).style("display", "none");
        let near = null;
        g.append("rect").attr("width", iw).attr("height", ih).attr("fill", "transparent").style("cursor", "pointer")
          .on("pointermove", (evt) => {
            const [px, py] = d3.pointer(evt);
            const d = pts[delaunay.find(px, py)];
            if (!d || Math.hypot(x(d.x) - px, y(d.y) - py) > Math.max(24, r(d.p) + 8)) { near = null; ring.style("display", "none"); MH.hideTip(); return; }
            near = d;
            ring.style("display", null).attr("cx", x(d.x)).attr("cy", y(d.y)).attr("r", r(d.p) + 2);
            MH.showTip(evt, `${d.c.name}, ${state.year}`, [
              { value: fmt(state.y, d.y, "long"), label: ind[state.y].label },
              { value: fmt(state.x, d.x, "long"), label: ind[state.x].label },
              { value: compact(d.p, 1), label: `people · ${d.c.continent}` },
            ]);
          })
          .on("pointerleave", () => { near = null; ring.style("display", "none"); MH.hideTip(); })
          .on("click", () => { if (near) location.href = countryLink(near.c); });
        el.replaceChildren(svg.node());
      });
    }

    load();
  }).catch(MH.fail);
})();
