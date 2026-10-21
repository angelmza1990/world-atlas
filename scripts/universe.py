"""The indicators the site covers, all from the World Bank's World Development Indicators.

Each entry: (key, World Bank code, label, unit, how continents aggregate it)
  sum       - add up the countries (population, GDP, area)
  weighted  - population-weighted average of the countries (rates per person)
  ratio     - computed from two sums on the build side (density, GDP per capita)
  none      - shown per country only
"""

INDICATORS = [
    # population
    ("population", "SP.POP.TOTL", "Population", "people", "sum"),
    ("popGrowth", "SP.POP.GROW", "Population growth", "% per year", "weighted"),
    ("female", "SP.POP.TOTL.FE.IN", "Female population", "people", "sum"),
    ("male", "SP.POP.TOTL.MA.IN", "Male population", "people", "sum"),
    ("birthRate", "SP.DYN.CBRT.IN", "Birth rate", "per 1,000 people", "weighted"),
    ("deathRate", "SP.DYN.CDRT.IN", "Death rate", "per 1,000 people", "weighted"),
    ("fertility", "SP.DYN.TFRT.IN", "Fertility rate", "births per woman", "weighted"),
    ("lifeExp", "SP.DYN.LE00.IN", "Life expectancy", "years", "weighted"),
    ("infantMort", "SP.DYN.IMRT.IN", "Infant mortality", "per 1,000 live births", "weighted"),
    ("age0014", "SP.POP.0014.TO.ZS", "Population aged 0-14", "% of population", "weighted"),
    ("age1564", "SP.POP.1564.TO.ZS", "Population aged 15-64", "% of population", "weighted"),
    ("age65", "SP.POP.65UP.TO.ZS", "Population aged 65+", "% of population", "weighted"),
    ("urban", "SP.URB.TOTL.IN.ZS", "Urban population", "% of population", "weighted"),
    ("netMigration", "SM.POP.NETM", "Net migration", "people per year", "sum"),
    # land
    ("landArea", "AG.LND.TOTL.K2", "Land area", "km²", "sum"),
    ("surfaceArea", "AG.SRF.TOTL.K2", "Surface area", "km²", "sum"),
    ("density", "EN.POP.DNST", "Population density", "people per km² of land", "ratio"),
    # economy
    ("gdp", "NY.GDP.MKTP.CD", "GDP", "current US$", "sum"),
    ("gdpPerCap", "NY.GDP.PCAP.CD", "GDP per capita", "current US$", "ratio"),
    ("gdpPpp", "NY.GDP.MKTP.PP.CD", "GDP, PPP", "current international $", "sum"),
    ("gdpPerCapPpp", "NY.GDP.PCAP.PP.CD", "GDP per capita, PPP", "current international $", "ratio"),
    ("gdpGrowth", "NY.GDP.MKTP.KD.ZG", "GDP growth", "% per year, real", "none"),
    ("inflation", "FP.CPI.TOTL.ZG", "Inflation", "% per year, consumer prices", "none"),
    ("unemployment", "SL.UEM.TOTL.ZS", "Unemployment", "% of labour force", "none"),
    ("gini", "SI.POV.GINI", "Gini index", "0 (equal) to 100 (unequal)", "none"),
    ("agriculture", "NV.AGR.TOTL.ZS", "Agriculture", "% of GDP", "none"),
    ("industry", "NV.IND.TOTL.ZS", "Industry", "% of GDP", "none"),
    ("services", "NV.SRV.TOTL.ZS", "Services", "% of GDP", "none"),
    ("exports", "NE.EXP.GNFS.ZS", "Exports", "% of GDP", "none"),
    ("internet", "IT.NET.USER.ZS", "Internet users", "% of population", "weighted"),
]

# Five-year age groups by sex, as a share of that sex's population: for population pyramids.
AGE_GROUPS = ["0004", "0509", "1014", "1519", "2024", "2529", "3034", "3539", "4044",
              "4549", "5054", "5559", "6064", "6569", "7074", "7579", "80UP"]
PYRAMID = [(f"{sex}{g}", f"SP.POP.{g}.{sex.upper()}.5Y") for sex in ("fe", "ma") for g in AGE_GROUPS]

FIRST_YEAR = 1960

# Continents from the countries dataset's region and subregion.
def continent(region, subregion):
    if region == "Americas":
        return "South America" if subregion == "South America" else "North America"
    if region in ("Africa", "Asia", "Europe", "Oceania"):
        return region
    return None  # Antarctic

CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"]
