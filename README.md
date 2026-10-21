# World Atlas

Population, demography and economy of every country and continent: population and its distribution, birth and death rates, fertility, life expectancy, age structure, density, area, GDP and more, for 217 countries and six continents since 1960.

**Live site:** https://angelmza1990.github.io/world-atlas/

## Pages

- **[World map](https://angelmza1990.github.io/world-atlas/)**: world totals, a choropleth of 25 indicators for any year since 1960, and a ranking of every country, filterable by continent.
- **[Countries](https://angelmza1990.github.io/world-atlas/countries/?c=ARG)**: a profile of each country with its capital, area, languages, currencies and neighbours, a locator map, its rank in the world for 18 indicators next to its continent and the world, population pyramids then and now, and series since 1960 (population, births and deaths, fertility, life expectancy, GDP per capita, age structure, urbanization, economic structure, GDP growth).
- **[Continents](https://angelmza1990.github.io/world-atlas/continents/)**: each continent's share of the world's people, land and GDP, a side-by-side table, series since 1960 and population pyramids.
- **[Compare](https://angelmza1990.github.io/world-atlas/compare/)**: any two indicators against each other for every country, sized by population, by year, in one chart or by continent.
- **[Method](https://angelmza1990.github.io/world-atlas/method/)**: sources, definitions and limitations.

## Data

- [World Bank, World Development Indicators](https://datatopics.worldbank.org/world-development-indicators/) (CC BY 4.0): 30 indicators plus population by five-year age group and sex.
- [mledoze/countries](https://github.com/mledoze/countries) (ODbL): names, capitals, languages, currencies, borders, regions.
- [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas): country shapes.
- [flagcdn.com](https://flagcdn.com): flags.

Continents are built from their countries: totals add up, rates are weighted by population, and a continent-year is shown only when countries holding 90% of its population have data.

## How it works

Static HTML, CSS and JavaScript with [D3.js](https://d3js.org/) and topojson-client (vendored in `assets/vendor/`), served by GitHub Pages.

```
scripts/universe.py     indicators and continent rules
scripts/fetch_data.py   downloads every source into data/raw/ (kept as a snapshot)
scripts/build_data.py   builds data/meta.json, countries.json, world.json, indicators/, series/
scripts/check_pages.mjs opens every page in headless Chrome
```

A weekly workflow refreshes the sources and commits any change; another checks every page on each push.

## Run it locally

```sh
python3 scripts/fetch_data.py   # optional: refresh the snapshot
python3 scripts/build_data.py
python3 -m http.server 8080     # then open http://localhost:8080
```

## License

Code: MIT. Data belongs to its providers under the licenses above.
