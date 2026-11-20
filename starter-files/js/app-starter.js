// STARTER FILE: where are the most-watched Netflix titles made?
// Goal: take the top Netflix movies and TV shows, ask TMDB which countries
// produced each one, count the titles per country, and colour Part A's
// world map by that count (a choropleth). Hover a country to see its titles.
//
// Before you start: paste your token into js/config.js (same as Lab 5).
//
// When this file first runs you should see a gray world map with outlines
// (Part A, pre-filled) and the movies and shows in the console.

async function main() {
  // ---- PRE-FILLED: Part A's map --------------------------------------------
  const countries = await d3.json('../data/countries.geojson')
  const map = L.map('map').setView([100, 0], 2)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  // ---- PRE-FILLED: load both Netflix files ---------------------------------
  // Movies use the tconst column; TV uses imdb_id. We give both the same
  // field names so the rest of the code doesn't care which is which.
  // (Loaded from pre-fetched static JSON so it runs instantly without exposing TMDB_TOKEN)
  const looked_up = await d3.json('../data/netflix_geocoded.json')
  d3.select('#loader').classed('hidden', true)
  console.log('looked up', looked_up.length)


  // ---- STEP 1: keep the most-watched ---------------------------------------
  // Every title is two requests. Start with 20 of each; try 100 later.
  // (Already filtered to top 50 movies + top 50 shows in netflix_geocoded.json)


  // ---- STEP 2: which countries made it? -----------------------------------
  // This step is in the countriesFor() function at the BOTTOM of this file.
  // Scroll down, fill in its blank, then come back for Step 3.


  // ---- STEP 3: ask TMDB about each title ----------------------------------
  // Lab 5's for...of loop. TMDB gives a list like
  //   [{ iso_3166_1: 'KR', name: 'South Korea' }]
  // We keep only the names, because the map's countries have names too.
  // (Saved in ../data/netflix_geocoded.json)


  // ---- STEP 4: group the titles by country --------------------------------
  // One title can have SEVERAL countries, so it goes in each one's list.
  // A Map is like Lab 4's rollup result: country name -> list of titles.
  //
  const nameFix = {
    'Hong Kong': 'Hong Kong S.A.R.',
  }

  function byCountry(list) {
    const groups = new Map()
    for (const t of list) {
      for (const rawCountry of t.countries) {
        const country = nameFix[rawCountry] || rawCountry
        if (!groups.has(country)) groups.set(country, [])
        groups.get(country).push(t)
      }
    }
    return groups
  }

  // Which TMDB names are NOT on our map? Read this list in the console.
  const map_names = new Set(countries.features.map((f) => f.properties.ADMIN))
  const all_groups = byCountry(looked_up)
  console.log('not on the map:', [...all_groups.keys()].filter((n) => !map_names.has(n)))


  // ---- STEP 5: colour the countries ---------------------------------------
  // A sequential colour scale: few titles = pale, many = dark.
  // renderMap draws the layer again whenever we filter (Step 7).
  //
  let currentType = 'all'
  let currentMetric = 'count' // 'count' or 'views'
  let country_layer = null

  const formatViews = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : d3.format(',')(v))

  function renderMap() {
    const filtered =
      currentType === 'all'
        ? looked_up
        : looked_up.filter((t) => t.type === currentType)

    const groups = byCountry(filtered)

    const getMetricValue = (items) =>
      currentMetric === 'views' ? d3.sum(items, (d) => d.views) : items.length

    const values = [...groups.values()].map((v) => getMetricValue(v)).sort(d3.ascending)
    const minVal = values[0] || 1
    const maxVal = values[values.length - 1] || 1

    // 4-stop logarithmic scale in pure reds
    const color = d3
      .scaleLog()
      .domain([
        minVal,
        Math.pow(minVal, 0.66) * Math.pow(maxVal, 0.34),
        Math.pow(minVal, 0.33) * Math.pow(maxVal, 0.67),
        maxVal,
      ])
      .range(['#b5b5b5', '#cd8c8c', '#a72424', '#690606'])

    if (country_layer) map.removeLayer(country_layer)
    country_layer = L.geoJSON(countries, {
      style: (feature) => {
        const made = groups.get(feature.properties.ADMIN) || []
        const val = getMetricValue(made)
        return {
          color: '#ffffff',
          weight: 0.7,
          fillColor: made.length > 0 ? color(val) : '#e5e7eb',
          fillOpacity: made.length > 0 ? 0.85 : 0.4,
        }
      },
      onEachFeature: (feature, layer) => {
        // ---- STEP 6: hover for the titles ---------------------------------------
        // Inside onEachFeature: a tooltip with the country, the count, and up to
        // 10 titles. Countries with no titles get no tooltip.
        const made = groups.get(feature.properties.ADMIN) || []
        if (made.length === 0) return

        const sortedMade = [...made].sort((a, b) => d3.descending(a.views, b.views))
        const totalViews = d3.sum(made, (d) => d.views)
        const items = sortedMade
          .slice(0, 10)
          .map((t) => `<li>${t.title} <small>(${formatViews(t.views)})</small></li>`)
          .join('')

        layer.bindTooltip(
          `<h3>${feature.properties.ADMIN}</h3>
           <div class="count">
             <strong>${made.length}</strong> title${made.length === 1 ? '' : 's'} · 
             <strong>${formatViews(totalViews)}</strong> views
           </div>
           <ul>${items}</ul>`,
          { sticky: true }
        )
      },
    }).addTo(map)
  }
  renderMap()


  // ---- STEP 7: All / Movies / TV buttons & Metric toggle ------------------
  // Each button keeps only one type or metric, then draws the map again.
  //
  function setType(button, type) {
    d3.selectAll('#btn-all, #btn-movie, #btn-tv').classed('active', false)
    d3.select(button).classed('active', true)
    currentType = type
    renderMap()
  }

  function setMetric(button, metric) {
    d3.selectAll('#btn-metric-count, #btn-metric-views').classed('active', false)
    d3.select(button).classed('active', true)
    currentMetric = metric
    renderMap()
  }

  d3.select('#btn-all').on('click', (event) => setType(event.target, 'all'))
  d3.select('#btn-movie').on('click', (event) => setType(event.target, 'movie'))
  d3.select('#btn-tv').on('click', (event) => setType(event.target, 'tv'))

  d3.select('#btn-metric-count').on('click', (event) => setMetric(event.target, 'count'))
  d3.select('#btn-metric-views').on('click', (event) => setMetric(event.target, 'views'))


  // ---- IF YOU FINISH EARLY (and toward Exercise 4) ------------------------
  // 1. Fix a name that is "not on the map": e.g. rename 'Hong Kong' to
  //    'Hong Kong S.A.R.' before grouping. Which others do you find?
  // 2. Try 100 titles of each type. Does the map change?
  // 3. The US dominates. Show the SHARE of each country's titles that are
  //    TV shows instead of the count (a rate, as in the choropleth report).
  // 4. Put a circle on each country sized by its count, with d3.scaleSqrt
  //    (the bubble map report). Hint: L.circleMarker(layer.getBounds().getCenter())
  // 5. Save looked_up as a CSV (Lab 5, Step 5) so you never wait for it again.
}

// ---- STEP 2: which countries made it? ---------------------------------------
// Lab 5's find-by-ID tells us the title's TMDB id and whether it's a movie
// or a TV show. A second request for its details includes the list of
// production countries. Which field holds it? (Expand `details` in the
// console to look.)
async function countriesFor(imdb_id) {
  const options = {
    method: 'GET',
    headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_TOKEN}` },
  }
  const found = await (await fetch(
    `https://api.themoviedb.org/3/find/${imdb_id}?external_source=imdb_id`, options
  )).json()
  const match = found.movie_results?.[0] || found.tv_results?.[0]
  if (!match) return []
  const type = found.movie_results?.[0] ? 'movie' : 'tv'

  const details = await (await fetch(
    `https://api.themoviedb.org/3/${type}/${match.id}`, options
  )).json()
  return details.production_countries || []
}

// ---- PRE-FILLED HELPER ------------------------------------------------------
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main()