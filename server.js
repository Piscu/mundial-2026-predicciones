const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_FOOTBALL_KEY || '465fd60b89a831a391066de7add0c670';
const API_BASE = 'https://v3.football.api-sports.io';

const db = require('./db');
const eloRatings = require('./elo_ratings');
const predictor = require('./predictor');

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

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.post('/api/sugerencia', express.json(), async (req, res) => {
  try {
    const { mensaje, contacto } = req.body;
    if (!mensaje || mensaje.trim().length < 3) {
      return res.status(400).json({ error: 'Escribe una sugerencia (mín 3 caracteres)' });
    }
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.status(500).json({ error: 'Telegram no configurado' });
    }
    const text = `💡 *Nueva Sugerencia*\n\n${mensaje}${contacto ? `\n\n📬 *Contacto:* ${contacto}` : ''}\n\n📍 App Predicciones WA`;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const tgRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(TELEGRAM_CHAT_ID), text, parse_mode: 'Markdown' })
    });
    if (!tgRes.ok) {
      const errText = await tgRes.text();
      throw new Error(`Telegram error: ${errText}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Sugerencia error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Advanced prediction endpoints
app.get('/api/predictions-advanced', async (req, res) => {
  try {
    const { fixture, home, away } = req.query;
    if (fixture) {
      const pred = await predictor.getPredictionForFixture(Number(fixture));
      if (pred) return res.json({ cached: true, prediction: pred });
      return res.json({ cached: false, prediction: null, message: 'Predicción no disponible. Usá POST /api/refresh-data para generar.' });
    }
    if (home && away) {
      const homeTeam = db.getTeamByApiId(Number(home));
      const awayTeam = db.getTeamByApiId(Number(away));
      if (!homeTeam || !awayTeam) return res.status(404).json({ error: 'Team not found' });
      const fixtureId = Math.abs(((Number(home) * 1000 + Number(away)) * 1000 + 20260614)) >>> 0;
      const existing = await predictor.getPredictionForFixture(fixtureId);
      if (existing) return res.json({ cached: true, prediction: existing });
      const pred = await predictor.generatePredictionFromIds(Number(home), Number(away));
      return res.json({ cached: false, prediction: pred });
    }
    return res.status(400).json({ error: 'Provide fixture, home+away, or all' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teams-list', async (req, res) => {
  try {
    const teams = db.getAllTeams().map(t => ({ api_id: t.api_id, name: t.name, code: t.code, elo_rating: t.elo_rating }));
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/predictions-all', async (req, res) => {
  try {
    const rows = [];
    const stmt = db.getDb().prepare('SELECT * FROM predictions ORDER BY confidence DESC');
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    res.json({ predictions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/refresh-data', async (req, res) => {
  try {
    const secret = req.query.secret;
    if (secret !== 'refresh2026') return res.status(403).json({ error: 'Invalid secret' });

    const eloData = await eloRatings.fetchEloRatings();
    let seeded = 0;
    for (const entry of eloData) {
      const apiId = eloRatings.CODE_TO_API_ID[entry.code];
      if (apiId) {
        db.upsertTeam({ api_id: apiId, name: eloRatings.getCountryName(entry.code), code: entry.code, elo_rating: entry.elo });
        seeded++;
      }
    }
    // Refresh predictions if API-Football is available
    let predCount = 0;
    try {
      const fixturesData = await fetchFromApi('/fixtures', { date: '2026-06-14' });
      const wcFixtures = (fixturesData.response || []).filter(f => f.league && f.league.id === 1);
      if (wcFixtures.length > 0) {
        await predictor.refreshAllPredictions(wcFixtures);
        predCount = db.countPredictions();
      }
    } catch (fixturesErr) {
      console.warn('API-Football unavailable for fixtures, Elo seeded only:', fixturesErr.message);
    }
    const teamCount = db.getAllTeams().length;
    const matchCount = db.countMatches();
    res.json({ ok: true, elo_seeded: seeded, total_teams: teamCount, total_matches: matchCount, total_predictions: predCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  await db.initDb();
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
