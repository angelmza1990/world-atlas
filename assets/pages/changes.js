// Through time: a race of the most populous countries since 1960, and the largest changes in any indicator.
(function () {
  const { fmt, esc, compact, flagImg, countryLink, CONTINENT_COLOR } = WA;
  MH.shell("changes");
  const $ = (id) => document.getElementById(id);

  const KEYS = ["population", "popGrowth", "birthRate", "deathRate", "fertility", "lifeExp", "infantMort", "age0014", "age65", "urban",
    "density", "gdp", "gdpPerCap", "gdpPerCapPpp", "gdpGrowth", "inflation", "unemployment", "agriculture", "industry", "services", "exports", "internet"];
  // Changes in these are shown as a percentage: a country adding 10 million people is a different story in China and in Chad.
  const RELATIVE = new Set(["population", "density", "gdp", "gdpPerCap", "gdpPerCapPpp"]);

  Promise.all([MH.load("meta"), MH.load("countries"), MH.load("indicators/population")]).then(([meta, countries, pop]) => {
    const ind = Object.fromEntries(meta.indicators.map((i) => [i.key, i]));
    const byIso = Object.fromEntries(countries.map((c) => [c.iso3, c]));
    const at = (rows, iso, year) => {
      const s = rows[iso];
      if (!s) return null;
      for (let i = s.length - 1; i >= 0; i--) if (s[i][0] <= year) return year - s[i][0] <= 4 ? s[i][1] : null;
      return null;
    };

    /* ---------- population race ---------- */
    const TOP = 12, ROW = 34;
    const first = 1960, last = ind.population.latest;
    const frames = {};
    for (let y = first; y <= last; y++) {
      frames[y] = countries.map((c) => ({ c, v: at(pop, c.iso3, y) })).filter((d) => d.v).sort((a, b) => b.v - a.v);
    }
    const race = $("race"), rows = new Map();
    race.style.height = `${TOP * ROW}px`;
    $("race-legend").innerHTML = meta.continents.map((c) => `<span class="key"><span class="sw" style="background:${CONTINENT_COLOR[c]}"></span>${c}</span>`).join("");
    const scrub = $("scrub");
    scrub.min = first; scrub.max = last;
    let year = first, timer = null;

    function show(y) {
      year = y;
      scrub.value = y;
      $("race-year").textContent = y;
      const list = frames[y], top = list.slice(0, TOP), max = top[0].v;
      const keep = new Set(top.map((d) => d.c.iso3));
      for (const [iso, el] of rows) if (!keep.has(iso)) { el.style.opacity = 0; el.style.transform = `translateY(${TOP * ROW}px)`; }
      top.forEach((d, i) => {
        let el = rows.get(d.c.iso3);
        if (!el) {
          el = document.createElement("div");
          el.className = "race-row";
          el.style.opacity = 0;
          el.style.transform = `translateY(${TOP * ROW}px)`;
          el.innerHTML = `<div class="who">${flagImg(d.c, 14)}<span>${esc(d.c.name)}</span></div><div class="track"><div class="bar" style="background:${CONTINENT_COLOR[d.c.continent]}"></div><span class="val"></span></div>`;
          race.append(el);
          rows.set(d.c.iso3, el);
          el.getBoundingClientRect(); // start the transition from below the chart
        }
        const w = (d.v / max) * 100;
        el.style.opacity = 1;
        el.style.transform = `translateY(${i * ROW}px)`;
        el.querySelector(".bar").style.width = `calc(${w}% - 64px * ${w / 100})`;
        const val = el.querySelector(".val");
        val.style.left = `calc(${w}% - 64px * ${w / 100})`;
        val.textContent = compact(d.v, d.v >= 1e9 ? 2 : 0);
      });
      // A note on what changed in the ranking this year.
      const prev = frames[y - 1];
      if (!prev) { $("ticker").textContent = `In ${y}, the ten largest countries held ${share(list, 10)}% of the world's people.`; return; }
      const rank = (l) => new Map(l.slice(0, TOP).map((d, i) => [d.c.iso3, i]));
      const a = rank(prev), b = rank(list);
      const passed = top.filter((d, i) => a.has(d.c.iso3) && a.get(d.c.iso3) > i).map((d) => d.c.name);
      const joined = top.filter((d) => !a.has(d.c.iso3)).map((d) => d.c.name);
      const notes = [];
      if (joined.length) notes.push(`${joined.join(" and ")} ${joined.length > 1 ? "join" : "joins"} the top ${TOP}`);
      if (passed.length) notes.push(`${passed.join(" and ")} ${passed.length > 1 ? "move" : "moves"} up`);
      $("ticker").textContent = notes.length ? `${y}: ${notes.join("; ")}.` : `${y}: the ten largest countries hold ${share(list, 10)}% of the world's people.`;
    }
    const share = (list, k) => Math.round((d3.sum(list.slice(0, k), (d) => d.v) / d3.sum(list, (d) => d.v)) * 100);

    function stop() { clearInterval(timer); timer = null; $("play").textContent = year >= last ? "Replay" : "Play"; }
    function play() {
      if (year >= last) show(first);
      $("play").textContent = "Pause";
      timer = setInterval(() => { if (year >= last) return stop(); show(year + 1); }, 520);
    }
    $("play").addEventListener("click", () => (timer ? stop() : play()));
    scrub.addEventListener("input", () => { stop(); show(+scrub.value); });
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    show(reduce ? last : first);
    stop();
    if (!reduce && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { io.disconnect(); if (year === first) play(); } }, { threshold: 0.5 });
      io.observe(race);
    }

    /* ---------- biggest changes ---------- */
    const q = new URLSearchParams(location.search);
    const state = { key: ind[q.get("i")] ? q.get("i") : "lifeExp", from: +q.get("from") || 1990, to: +q.get("to") || null, cont: "All" };
    const sel = $("ind");
    for (const k of KEYS) sel.append(new Option(ind[k].label, k));
    sel.value = state.key;
    sel.addEventListener("change", () => { state.key = sel.value; load(); });
    $("from").addEventListener("change", () => { state.from = +$("from").value; draw(); });
    $("to").addEventListener("change", () => { state.to = +$("to").value; draw(); });
    MH.seg($("cont"), [["All", "World"]].concat(meta.continents.map((c) => [c, c])), state.cont, (v) => { state.cont = v; draw(); });

    let data = null;
    function load() {
      MH.load(`indicators/${state.key}`).then((rows) => {
        data = rows;
        const lo = Math.min(...Object.values(rows).map((s) => s[0][0])), hi = ind[state.key].latest;
        for (const id of ["from", "to"]) { $(id).min = lo; $(id).max = hi; }
        if (!state.to || state.to > hi) state.to = hi;
        if (state.from < lo || state.from >= state.to) state.from = Math.max(lo, Math.min(1990, state.to - 10));
        draw();
      }).catch(MH.fail);
    }

    function draw() {
      const { key, cont } = state;
      const from = Math.min(state.from, state.to - 1), to = state.to;
      $("from").value = from; $("to").value = to;
      history.replaceState(null, "", `?i=${key}&from=${from}&to=${to}`);
      const rel = RELATIVE.has(key);
      const list = [];
      for (const c of countries) {
        if (cont !== "All" && c.continent !== cont) continue;
        const a = at(data, c.iso3, from), b = at(data, c.iso3, to);
        if (a == null || b == null || (rel && a <= 0)) continue;
        // Very small countries swing wildly in relative terms; leave out those under 100,000 people.
        if ((at(pop, c.iso3, to) || 0) < 1e5) continue;
        list.push({ c, a, b, d: rel ? (b / a - 1) * 100 : b - a });
      }
      list.sort((x, y) => y.d - x.d);
      const up = list.filter((x) => x.d > 0).slice(0, 10), down = list.filter((x) => x.d < 0).reverse().slice(0, 10);
      const maxAbs = d3.max(up.concat(down), (x) => Math.abs(x.d)) || 1;
      const label = ind[key].label.toLowerCase();
      const change = (x) => rel ? `${x.d >= 0 ? "+" : "−"}${Math.abs(x.d).toLocaleString("en-US", { maximumFractionDigits: Math.abs(x.d) >= 100 ? 0 : 1 })}%`
        : `${x.d >= 0 ? "+" : "−"}${fmt(key, Math.abs(x.d))}`;
      const row = (x, color) => `<div class="mover-row">${flagImg(x.c, 13)}<a href="${countryLink(x.c)}">${esc(x.c.name)}</a>
        <div class="track"><i style="width:${(Math.abs(x.d) / maxAbs) * 100}%;background:${color}"></i></div>
        <b>${change(x)}<small>${fmt(key, x.a)} → ${fmt(key, x.b)}</small></b></div>`;
      $("up").innerHTML = up.length ? up.map((x) => row(x, "var(--s1)")).join("") : `<p class="note">No country rose.</p>`;
      $("down").innerHTML = down.length ? down.map((x) => row(x, "var(--neg, #d03b3b)")).join("") : `<p class="note">No country fell.</p>`;
      $("up-title").textContent = `Largest rises, ${from}–${to}`;
      $("down-title").textContent = `Largest falls, ${from}–${to}`;
      $("movers-sub").textContent = `Change in ${label} (${ind[key].unit}) from ${from} to ${to}${rel ? ", as a percentage" : ""}${cont === "All" ? "" : `, ${cont}`}. Pick any indicator and years.`;
      const rose = list.filter((x) => x.d > 0).length;
      $("movers-note").textContent = `${list.length} countries with data in both years: ${rose} rose and ${list.length - rose} fell or stayed level. Countries under 100,000 people are left out; where a year is missing, the most recent figure from the four years before is used.`;
    }
    load();
  }).catch(MH.fail);
})();
