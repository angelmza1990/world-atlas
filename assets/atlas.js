// World Atlas — indicator formatting, continent colours, flags, the choropleth map and population pyramids.
(function () {
  const { ROOT } = MH;
  const MINUS = "−";

  // Continents keep the same colour everywhere (fixed categorical order).
  const CONTINENT_COLOR = {
    Asia: "var(--s1)", Africa: "var(--s2)", Europe: "var(--s3)",
    "North America": "var(--s4)", "South America": "var(--s5)", Oceania: "var(--s6)",
  };
  const SEQ = ["#e3eefb", "#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
  const DIV_NEG = ["#a32727", "#d03b3b", "#f0a59d"];
  const DIV_POS = ["#9ec5f4", "#2a78d6", "#104281"];
  const DIVERGING = new Set(["popGrowth", "gdpGrowth", "netMigration"]);

  // ---------- formatting ----------
  function compact(v, d = 1) {
    const a = Math.abs(v);
    const s = a >= 1e12 ? (a / 1e12).toFixed(d) + "T" : a >= 1e9 ? (a / 1e9).toFixed(d) + "B" : a >= 1e6 ? (a / 1e6).toFixed(d) + "M" : a >= 1e3 ? (a / 1e3).toFixed(d) + "K" : a.toFixed(0);
    return (v < 0 ? MINUS : "") + s;
  }
  const fixed = (v, d) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", MINUS);
  const PCT = new Set(["popGrowth", "age0014", "age1564", "age65", "urban", "gdpGrowth", "inflation", "unemployment", "agriculture", "industry", "services", "exports", "internet"]);

  /** Format a value of an indicator. style: "short" (tables, map) or "long" (tiles, tooltips). */
  function fmt(key, v, style = "short") {
    if (v == null || !isFinite(v)) return "–";
    const long = style === "long";
    switch (key) {
      case "population": case "female": case "male": return long ? compact(v, 2) : compact(v, 1);
      case "netMigration": return (v > 0 ? "+" : "") + compact(v, 1);
      case "landArea": case "surfaceArea": return long ? `${fixed(v, 0)} km²` : `${compact(v, 2)} km²`;
      case "density": return `${fixed(v, v < 10 ? 1 : 0)}${long ? " per km²" : ""}`;
      case "gdp": case "gdpPpp": return "$" + compact(v, v >= 1e12 ? 2 : 1);
      case "gdpPerCap": case "gdpPerCapPpp": return "$" + fixed(v, 0);
      case "birthRate": case "deathRate": case "infantMort": return fixed(v, 1) + (long ? " per 1,000" : "");
      case "fertility": return fixed(v, 2) + (long ? " births per woman" : "");
      case "lifeExp": return fixed(v, 1) + (long ? " years" : "");
      case "gini": return fixed(v, 1);
    }
    if (PCT.has(key)) return (key === "popGrowth" || key === "gdpGrowth" || key === "inflation") && v > 0 && long ? "+" + fixed(v, 1) + "%" : fixed(v, 1) + "%";
    return fixed(v, 2);
  }

  // Indicators where a lower value ranks first ("highest" means "best" only in a neutral sense; ranks are by size).
  const flagImg = (c, h = 14) => c && c.flag ? `<img src="${ROOT}/assets/flags/${c.iso2}.svg" alt="" width="${Math.round(h * 1.5)}" height="${h}" style="border-radius:2px;vertical-align:-2px;object-fit:cover;box-shadow:0 0 0 1px var(--line)" loading="lazy">` : "";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const countryLink = (c) => `${ROOT}/countries/?c=${c.iso3}`;

  // ---------- colour scales ----------
  /** Returns { color(v), bins: [[label, color], ...] } for a set of values. */
  function scaleFor(key, values) {
    const vals = values.filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
    if (!vals.length) return { color: () => "var(--bg)", bins: [] };
    if (DIVERGING.has(key)) {
      const neg = vals.filter((v) => v < 0).map(Math.abs).sort((a, b) => a - b);
      const pos = vals.filter((v) => v >= 0);
      const q = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : 0;
      const nt = [q(neg, 1 / 3), q(neg, 2 / 3)], pt = [q(pos, 1 / 3), q(pos, 2 / 3)];
      const color = (v) => {
        if (v == null || !isFinite(v)) return null;
        if (v < 0) { const a = -v; return a <= nt[0] ? DIV_NEG[2] : a <= nt[1] ? DIV_NEG[1] : DIV_NEG[0]; }
        return v <= pt[0] ? DIV_POS[0] : v <= pt[1] ? DIV_POS[1] : DIV_POS[2];
      };
      const bins = [];
      if (neg.length) bins.push([`below ${fmt(key, -nt[1])}`, DIV_NEG[0]], [`${fmt(key, -nt[1])} to ${fmt(key, -nt[0])}`, DIV_NEG[1]], [`${fmt(key, -nt[0])} to 0`, DIV_NEG[2]]);
      bins.push([`0 to ${fmt(key, pt[0])}`, DIV_POS[0]], [`${fmt(key, pt[0])} to ${fmt(key, pt[1])}`, DIV_POS[1]], [`above ${fmt(key, pt[1])}`, DIV_POS[2]]);
      return { color, bins };
    }
    // seven equal-count bins
    const cuts = SEQ.slice(0, -1).map((_, k) => vals[Math.min(vals.length - 1, Math.floor(((k + 1) * vals.length) / SEQ.length))]);
    const color = (v) => {
      if (v == null || !isFinite(v)) return null;
      let k = 0;
      while (k < cuts.length && v >= cuts[k]) k++;
      return SEQ[k];
    };
    const bins = SEQ.map((c, k) => [k === 0 ? `below ${fmt(key, cuts[0])}` : k === SEQ.length - 1 ? `${fmt(key, cuts[k - 1])} or more` : `${fmt(key, cuts[k - 1])} to ${fmt(key, cuts[k])}`, c]);
    return { color, bins };
  }
  function legendHTML(bins, note) {
    return bins.map(([l, c]) => `<span class="key"><span class="sw" style="background:${c}"></span>${esc(l)}</span>`).join("") +
      `<span class="key"><span class="sw" style="background:var(--bg);box-shadow:inset 0 0 0 1px var(--line-2)"></span>No data</span>` + (note ? `<span class="muted">${esc(note)}</span>` : "");
  }

  // ---------- map ----------
  let shapes;
  const loadShapes = () => (shapes = shapes || MH.load("map").then((topo) => topojson.feature(topo, topo.objects.countries)));

  /**
   * opts: byNum (ccn3 -> country), value(country) -> number|null, color(v), onClick(country),
   * tip(evt, country, v), highlight iso3 (optional outline)
   */
  function drawMap(el, opts) {
    return loadShapes().then((geo) => {
      const features = geo.features.filter((f) => f.id !== "010"); // Antarctica
      return MH.responsive(el, (W) => {
        // fit the width, then size the height to the land actually drawn (no Antarctica)
        const fc = { type: "FeatureCollection", features };
        const projection = d3.geoEqualEarth().fitWidth(W, fc);
        const path = d3.geoPath(projection);
        const [[, y0], [, y1]] = path.bounds(fc);
        projection.translate([projection.translate()[0], projection.translate()[1] - y0]);
        const H = Math.ceil(y1 - y0);
        const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", opts.label || "World map");
        svg.append("g").selectAll("path").data(features).join("path")
          .attr("d", path)
          .attr("fill", (f) => {
            const c = opts.byNum[f.id];
            const v = c ? opts.value(c) : null;
            return (v != null && opts.color(v)) || "var(--bg)";
          })
          .attr("stroke", "var(--surface)").attr("stroke-width", 0.5)
          .style("cursor", (f) => (opts.byNum[f.id] ? "pointer" : "default"))
          .on("pointermove", function (evt, f) {
            const c = opts.byNum[f.id];
            d3.select(this).attr("stroke", "var(--ink)").attr("stroke-width", 1.2).raise();
            if (c) opts.tip(evt, c, opts.value(c));
            else MH.showTip(evt, f.properties.name, [{ value: "No data", label: "" }]);
          })
          .on("pointerleave", function (evt, f) {
            const hl = opts.highlight && opts.byNum[f.id] && opts.byNum[f.id].iso3 === opts.highlight;
            d3.select(this).attr("stroke", hl ? "var(--ink)" : "var(--surface)").attr("stroke-width", hl ? 1.5 : 0.5);
            MH.hideTip();
          })
          .on("click", (evt, f) => { const c = opts.byNum[f.id]; if (c && opts.onClick) opts.onClick(c); });
        if (opts.highlight) {
          svg.select("g").selectAll("path").filter((f) => opts.byNum[f.id] && opts.byNum[f.id].iso3 === opts.highlight)
            .attr("stroke", "var(--ink)").attr("stroke-width", 1.5).raise();
        }
        el.replaceChildren(svg.node());
      });
    });
  }

  // ---------- population pyramid ----------
  // data: [female counts by age group, male counts]; groups: labels. Mirrored bars, men left, women right.
  function pyramid(el, data, groups, opts = {}) {
    return MH.responsive(el, (W) => {
      const n = groups.length, row = opts.row || 16;
      const H = n * row + 34;
      const total = d3.sum(data[0]) + d3.sum(data[1]);
      const share = data.map((side) => side.map((v) => v / total));
      const max = opts.max || d3.max(share.flat());
      const mid = W / 2, lab = 36, half = mid - lab / 2 - 8;
      const x = d3.scaleLinear().domain([0, max]).range([0, half]);
      const svg = d3.create("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("role", "img").attr("aria-label", opts.label || "Population pyramid");
      const g = svg.append("g").attr("transform", "translate(0,6)");
      const y = (i) => (n - 1 - i) * row;
      const bh = row - 3;
      for (let i = 0; i < n; i++) {
        const m = share[1][i], f = share[0][i];
        g.append("rect").attr("x", mid - lab / 2 - x(m)).attr("y", y(i)).attr("width", x(m)).attr("height", bh).attr("rx", 2).attr("fill", "var(--s1)");
        g.append("rect").attr("x", mid + lab / 2).attr("y", y(i)).attr("width", x(f)).attr("height", bh).attr("rx", 2).attr("fill", "var(--s2)");
        g.append("text").attr("x", mid).attr("y", y(i) + bh - 3).attr("text-anchor", "middle").style("font-size", "10.5px").text(groups[i]);
        g.append("rect").attr("x", 0).attr("y", y(i) - 1).attr("width", W).attr("height", row).attr("fill", "transparent")
          .on("pointermove", (evt) => MH.showTip(evt, `Age ${groups[i]}`, [
            { color: "var(--s1)", value: `${MH.pct(m, 1)} · ${compact(data[1][i], 2)}`, label: "men" },
            { color: "var(--s2)", value: `${MH.pct(f, 1)} · ${compact(data[0][i], 2)}`, label: "women" },
          ]))
          .on("pointerleave", MH.hideTip);
      }
      const ticks = x.ticks(W < 400 ? 2 : 4).filter((t) => t > 0);
      const axisY = n * row + 6;
      g.append("line").attr("x1", 0).attr("x2", W).attr("y1", axisY - 4).attr("y2", axisY - 4).attr("stroke", "var(--line-2)");
      for (const t of ticks) {
        for (const xx of [mid - lab / 2 - x(t), mid + lab / 2 + x(t)]) g.append("text").attr("x", xx).attr("y", axisY + 10).attr("text-anchor", "middle").text(MH.pct(t, t < 0.01 ? 1 : 0));
      }
      g.append("text").attr("x", 4).attr("y", axisY + 10).style("fill", "var(--ink-2)").text("Men");
      g.append("text").attr("x", W - 4).attr("y", axisY + 10).attr("text-anchor", "end").style("fill", "var(--ink-2)").text("Women");
      el.replaceChildren(svg.node());
    });
  }

  // series [[year, v]] -> [[Date, v]]
  const toDates = (rows) => rows.map(([y, v]) => [new Date(y, 6, 1), v]);

  window.WA = { CONTINENT_COLOR, fmt, compact, flagImg, esc, countryLink, scaleFor, legendHTML, drawMap, pyramid, toDates, DIVERGING };
})();
