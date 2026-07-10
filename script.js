// ---------- Config ----------

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const STORAGE_KEY = 'tripWeatherBoard.cities';
const UNIT_KEY = 'tripWeatherBoard.unit';
const MAX_CITIES = 8;

// WMO weather codes grouped into a status tier and a short label.
// Reference: https://open-meteo.com/en/docs (weathercode table)
const WEATHER_CODES = {
  0: { label: 'Clear sky', tier: 'good', icon: '☀️' },
  1: { label: 'Mostly clear', tier: 'good', icon: '🌤️' },
  2: { label: 'Partly cloudy', tier: 'mixed', icon: '⛅' },
  3: { label: 'Overcast', tier: 'mixed', icon: '☁️' },
  45: { label: 'Fog', tier: 'mixed', icon: '🌫️' },
  48: { label: 'Icy fog', tier: 'poor', icon: '🌫️' },
  51: { label: 'Light drizzle', tier: 'mixed', icon: '🌦️' },
  53: { label: 'Drizzle', tier: 'mixed', icon: '🌦️' },
  55: { label: 'Heavy drizzle', tier: 'poor', icon: '🌧️' },
  61: { label: 'Light rain', tier: 'mixed', icon: '🌦️' },
  63: { label: 'Rain', tier: 'poor', icon: '🌧️' },
  65: { label: 'Heavy rain', tier: 'poor', icon: '🌧️' },
  71: { label: 'Light snow', tier: 'mixed', icon: '🌨️' },
  73: { label: 'Snow', tier: 'poor', icon: '🌨️' },
  75: { label: 'Heavy snow', tier: 'poor', icon: '❄️' },
  80: { label: 'Rain showers', tier: 'poor', icon: '🌧️' },
  81: { label: 'Rain showers', tier: 'poor', icon: '🌧️' },
  82: { label: 'Violent showers', tier: 'poor', icon: '⛈️' },
  95: { label: 'Thunderstorm', tier: 'poor', icon: '⛈️' },
  96: { label: 'Storm w/ hail', tier: 'poor', icon: '⛈️' },
  99: { label: 'Severe storm', tier: 'poor', icon: '⛈️' },
};

const STATUS_TAG = {
  good: 'ON TIME',
  mixed: 'BOARDING',
  poor: 'DELAYED',
};

// ---------- State ----------

// cities: [{ id, name, country, admin1, lat, lon, status: 'loading'|'ready'|'error', data }]
let cities = [];
let unit = localStorage.getItem(UNIT_KEY) === 'F' ? 'F' : 'C';

// ---------- DOM ----------

const searchForm = document.getElementById('searchForm');
const citySearchInput = document.getElementById('citySearch');
const searchResultsEl = document.getElementById('searchResults');
const searchStatusEl = document.getElementById('searchStatus');
const boardBody = document.getElementById('boardBody');
const cityCountEl = document.getElementById('cityCount');
const emptyStateEl = document.getElementById('emptyState');
const unitCBtn = document.getElementById('unitC');
const unitFBtn = document.getElementById('unitF');
const detailPanel = document.getElementById('detailPanel');
const detailContent = document.getElementById('detailContent');
const closeDetailBtn = document.getElementById('closeDetail');
const liveClockEl = document.getElementById('liveClock');

// ---------- Helpers ----------

function celsiusToDisplay(tempC) {
  if (tempC === null || tempC === undefined || Number.isNaN(tempC)) return '--';
  const value = unit === 'F' ? (tempC * 9) / 5 + 32 : tempC;
  return `${Math.round(value)}°`;
}

function weatherInfo(code) {
  return WEATHER_CODES[code] || { label: 'Unknown', tier: 'mixed', icon: '❔' };
}

function dayLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function saveCitiesToStorage() {
  const toSave = cities.map(({ id, name, country, admin1, lat, lon }) => ({
    id, name, country, admin1, lat, lon,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function loadCitiesFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ---------- Geocoding ----------

async function searchCity(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding request failed');
  const data = await res.json();
  return data.results || [];
}

// ---------- Forecast ----------

async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current_weather: 'true',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode',
    timezone: 'auto',
    forecast_days: '3',
  });
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error('Forecast request failed');
  return res.json();
}

// ---------- Rendering: search results ----------

function renderSearchResults(results) {
  searchResultsEl.innerHTML = '';
  if (!results.length) {
    searchResultsEl.hidden = true;
    return;
  }
  results.forEach((place) => {
    const row = document.createElement('div');
    row.className = 'search-result';

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'search-result__name';
    name.textContent = place.name;
    const meta = document.createElement('div');
    meta.className = 'search-result__meta';
    meta.textContent = [place.admin1, place.country].filter(Boolean).join(', ');
    info.appendChild(name);
    info.appendChild(meta);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add';
    addBtn.addEventListener('click', () => addCity(place));

    row.appendChild(info);
    row.appendChild(addBtn);
    searchResultsEl.appendChild(row);
  });
  searchResultsEl.hidden = false;
}

// ---------- Rendering: board ----------

function renderBoard() {
  boardBody.innerHTML = '';
  cityCountEl.textContent = cities.length;
  emptyStateEl.classList.toggle('is-visible', cities.length === 0);

  cities.forEach((city) => {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `View 3 day detail for ${city.name}`);

    if (city.status === 'loading') {
      row.classList.add('row-skeleton');
      row.innerHTML = `
        <span class="col col--city">
          <span class="city-name">${city.name}</span>
          <span class="city-country">${[city.admin1, city.country].filter(Boolean).join(', ')}</span>
        </span>
        <span class="col col--temp">--</span>
        <span class="col col--range">loading forecast&hellip;</span>
        <span class="col col--status">&nbsp;</span>
        <span class="col col--action"></span>
      `;
    } else if (city.status === 'error') {
      row.innerHTML = `
        <span class="col col--city">
          <span class="city-name">${city.name}</span>
          <span class="city-country">${[city.admin1, city.country].filter(Boolean).join(', ')}</span>
        </span>
        <span class="row-error">
          Couldn't load weather for this city.
          <button type="button" class="retry-btn" data-retry="${city.id}">Retry</button>
        </span>
        <span class="col col--action">
          <button type="button" class="remove-btn" data-remove="${city.id}" aria-label="Remove ${city.name}">&times;</button>
        </span>
      `;
    } else {
      const { current_weather, daily } = city.data;
      const info = weatherInfo(current_weather.weathercode);
      const lo = Math.min(...daily.temperature_2m_min);
      const hi = Math.max(...daily.temperature_2m_max);

      row.innerHTML = `
        <span class="col col--city">
          <span class="city-name">${info.icon} ${city.name}</span>
          <span class="city-country">${[city.admin1, city.country].filter(Boolean).join(', ')}</span>
        </span>
        <span class="col col--temp">${celsiusToDisplay(current_weather.temperature)}</span>
        <span class="col col--range">${celsiusToDisplay(lo)} &ndash; ${celsiusToDisplay(hi)}</span>
        <span class="col col--status status--${info.tier}">${STATUS_TAG[info.tier]}</span>
        <span class="col col--action">
          <button type="button" class="remove-btn" data-remove="${city.id}" aria-label="Remove ${city.name}">&times;</button>
        </span>
      `;
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) return;
        openDetail(city);
      });
      row.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-remove]')) {
          e.preventDefault();
          openDetail(city);
        }
      });
    }

    boardBody.appendChild(row);
  });

  boardBody.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeCity(btn.dataset.remove);
    });
  });

  boardBody.querySelectorAll('[data-retry]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const city = cities.find((c) => c.id === btn.dataset.retry);
      if (city) loadWeatherFor(city);
    });
  });
}

// ---------- Detail view ----------

function openDetail(city) {
  const { daily } = city.data;
  const scored = daily.time.map((date, i) => {
    const info = weatherInfo(daily.weathercode[i]);
    const precip = daily.precipitation_probability_max[i];
    // Lower precipitation chance and a "good" tier score best; used only to
    // flag the best of the three days shown, not a scientific forecast score.
    const tierScore = { good: 0, mixed: 1, poor: 2 }[info.tier];
    const score = tierScore * 100 + precip;
    return {
      date,
      hi: daily.temperature_2m_max[i],
      lo: daily.temperature_2m_min[i],
      precip,
      info,
      score,
    };
  });
  const bestDate = scored.reduce((best, day) => (day.score < best.score ? day : best), scored[0]).date;

  detailContent.innerHTML = `
    <h2 class="detail-title">${city.name}</h2>
    <p class="detail-sub">${[city.admin1, city.country].filter(Boolean).join(', ')}</p>
    ${scored.map((day) => `
      <div class="detail-day ${day.date === bestDate ? 'detail-day--best' : ''}">
        <span class="detail-day__label">${dayLabel(day.date)}</span>
        <span>${day.info.icon} ${day.info.label}</span>
        <span>${celsiusToDisplay(day.lo)} / ${celsiusToDisplay(day.hi)}</span>
        <span>${day.precip}% rain</span>
      </div>
    `).join('')}
    <span class="detail-best-tag">Best day to land: ${dayLabel(bestDate)}</span>
  `;
  detailPanel.hidden = false;
  closeDetailBtn.focus();
}

closeDetailBtn.addEventListener('click', () => {
  detailPanel.hidden = true;
});

detailPanel.addEventListener('click', (e) => {
  if (e.target === detailPanel) detailPanel.hidden = true;
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !detailPanel.hidden) detailPanel.hidden = true;
});

// ---------- City list management ----------

function addCity(place) {
  const id = `${place.latitude}-${place.longitude}`;
  if (cities.some((c) => c.id === id)) {
    setSearchStatus(`${place.name} is already on the board.`, 'is-error');
    return;
  }
  if (cities.length >= MAX_CITIES) {
    setSearchStatus(`You can compare up to ${MAX_CITIES} cities at a time. Remove one first.`, 'is-error');
    return;
  }

  const city = {
    id,
    name: place.name,
    country: place.country,
    admin1: place.admin1,
    lat: place.latitude,
    lon: place.longitude,
    status: 'loading',
    data: null,
  };
  cities.push(city);
  saveCitiesToStorage();
  renderBoard();
  loadWeatherFor(city);

  searchResultsEl.hidden = true;
  searchResultsEl.innerHTML = '';
  citySearchInput.value = '';
  setSearchStatus('');
}

function removeCity(id) {
  cities = cities.filter((c) => c.id !== id);
  saveCitiesToStorage();
  renderBoard();
}

async function loadWeatherFor(city) {
  city.status = 'loading';
  renderBoard();
  try {
    const data = await fetchForecast(city.lat, city.lon);
    city.data = data;
    city.status = 'ready';
  } catch (err) {
    city.status = 'error';
  }
  renderBoard();
}

// ---------- Search form ----------

function setSearchStatus(message, className) {
  searchStatusEl.textContent = message;
  searchStatusEl.className = 'search-status' + (className ? ' ' + className : '');
}

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = citySearchInput.value.trim();
  if (!query) return;

  setSearchStatus('Searching…', 'is-loading');
  searchResultsEl.hidden = true;

  try {
    const results = await searchCity(query);
    if (!results.length) {
      setSearchStatus(`No cities found for "${query}". Try a different spelling.`, 'is-error');
      return;
    }
    setSearchStatus('');
    renderSearchResults(results);
  } catch (err) {
    setSearchStatus('Something went wrong reaching the weather service. Try again in a moment.', 'is-error');
  }
});

// ---------- Unit toggle ----------

function setUnit(newUnit) {
  unit = newUnit;
  localStorage.setItem(UNIT_KEY, unit);
  unitCBtn.classList.toggle('is-active', unit === 'C');
  unitFBtn.classList.toggle('is-active', unit === 'F');
  renderBoard();
}

unitCBtn.addEventListener('click', () => setUnit('C'));
unitFBtn.addEventListener('click', () => setUnit('F'));

// ---------- Live clock (board flavor) ----------

function tickClock() {
  const now = new Date();
  liveClockEl.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
tickClock();
setInterval(tickClock, 1000 * 30);

// ---------- Init ----------

function init() {
  setUnit(unit);

  const saved = loadCitiesFromStorage();
  cities = saved.map((c) => ({ ...c, status: 'loading', data: null }));
  renderBoard();
  cities.forEach((city) => loadWeatherFor(city));
}

init();