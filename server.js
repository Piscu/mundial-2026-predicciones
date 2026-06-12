const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = '465fd60b89a831a391066de7add0c670';
const API_BASE = 'https://v3.football.api-sports.io';

// TTL-based cache: key -> { data, expiresAt }
const cache = new Map();
const TTL = {
  fixtures: 10 * 60 * 1000,    // 10 min
  predictions: 10 * 60 * 1000,  // 10 min
  odds: 2 * 60 * 1000,          // 2 min (odds change fast)
  standings: 10 * 60 * 1000,    // 10 min
  leagues: 30 * 60 * 1000       // 30 min
};

function getCacheKey(endpoint, params) {
  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  return `${endpoint}?${sorted.map(([k, v]) => `${k}=${v}`).join('&')}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key, data, ttl) {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

// Periodic cleanup every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now >= entry.expiresAt) cache.delete(key);
  }
}, 5 * 60 * 1000);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, try again later' }
});

app.use('/api', apiLimiter);

async function fetchFromApi(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'x-apisports-key': API_KEY }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

function isPlanError(data) {
  return data.errors && data.errors.plan && typeof data.errors.plan === 'string';
}

// Convenience: add days to a date string
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// Fetch fixtures by date and filter for World Cup (league.id === 1)
async function fetchWorldCupFixturesByDate(dateStr) {
  const data = await fetchFromApi('/fixtures', { date: dateStr });
  if (!data.response) return [];
  return data.response.filter(f => f.league && f.league.id === 1);
}

// Try to get fixtures; fall back to date-based queries if league+season fails
app.get('/api/fixtures', async (req, res) => {
  try {
    const refresh = req.query._refresh;
    const { league = 1, season = 2026, status, team, live } = req.query;

    // Only cache the standard league+season+status query
    if (!refresh && !req.query.date && !req.query.id && live !== 'all') {
      const cacheKey = getCacheKey('/fixtures', { league, season, ...(status ? { status } : {}), ...(team ? { team } : {}) });
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
    }

    if (req.query.date) {
      const data = await fetchFromApi('/fixtures', { date: req.query.date });
      return res.json(data);
    }

    if (live === 'all') {
      const data = await fetchFromApi('/fixtures', { live: 'all' });
      return res.json(data);
    }

    if (req.query.id) {
      const data = await fetchFromApi('/fixtures', { id: req.query.id });
      return res.json(data);
    }

    const params = { league, season };
    if (status) params.status = status;
    if (team) params.team = team;
    const data = await fetchFromApi('/fixtures', params);
    if (isPlanError(data)) {
      const today = new Date().toISOString().split('T')[0];
      const dates = [today, addDays(today, 1), addDays(today, 2), addDays(today, 3),
        addDays(today, 4), addDays(today, 5), addDays(today, 6), addDays(today, 7)];
      const allFixtures = [];
      for (const dateStr of dates) {
        const fixtures = await fetchWorldCupFixturesByDate(dateStr);
        allFixtures.push(...fixtures);
      }
      const result = {
        get: 'fixtures',
        parameters: { league, season, fallback: 'date' },
        results: allFixtures.length,
        response: allFixtures
      };
      if (!refresh) {
        const cacheKey = getCacheKey('/fixtures', { league, season, ...(status ? { status } : {}), ...(team ? { team } : {}) });
        setCache(cacheKey, result, TTL.fixtures);
      }
      return res.json(result);
    }
    if (!refresh) {
      const cacheKey = getCacheKey('/fixtures', { league, season, ...(status ? { status } : {}), ...(team ? { team } : {}) });
      setCache(cacheKey, data, TTL.fixtures);
    }
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/predictions', async (req, res) => {
  try {
    const refresh = req.query._refresh;
    const { fixture } = req.query;
    if (fixture) {
      const cacheKey = getCacheKey('/predictions', { fixture });
      if (!refresh) {
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);
      }
      const data = await fetchFromApi('/predictions', { fixture });
      setCache(cacheKey, data, TTL.predictions);
      return res.json(data);
    }
    res.json({ results: 0, response: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/odds', async (req, res) => {
  try {
    const refresh = req.query._refresh;
    const { fixture } = req.query;
    if (fixture) {
      const cacheKey = getCacheKey('/odds', { fixture });
      if (!refresh) {
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);
      }
      const data = await fetchFromApi('/odds', { fixture });
      setCache(cacheKey, data, TTL.odds);
      return res.json(data);
    }
    res.json({ results: 0, response: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leagues', async (req, res) => {
  try {
    const refresh = req.query._refresh;
    const { search, id } = req.query;
    const params = {};
    if (search) params.search = search;
    if (id) params.id = id;
    const cacheKey = getCacheKey('/leagues', params);
    if (!refresh) {
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
    }
    const data = await fetchFromApi('/leagues', params);
    setCache(cacheKey, data, TTL.leagues);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/standings', async (req, res) => {
  try {
    const refresh = req.query._refresh;
    const { league = 1, season = 2026 } = req.query;
    const cacheKey = getCacheKey('/standings', { league, season });
    if (!refresh) {
      const cached = getCached(cacheKey);
      if (cached) return res.json(cached);
    }
    const data = await fetchFromApi('/standings', { league, season });
    if (isPlanError(data)) {
      const result = {
        results: 0,
        plan_limited: true,
        message: 'Los grupos no están disponibles en el plan gratuito para 2026',
        response: []
      };
      setCache(cacheKey, result, TTL.standings);
      return res.json(result);
    }
    setCache(cacheKey, data, TTL.standings);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
