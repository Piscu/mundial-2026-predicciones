const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data.sqlite');

let db = null;

async function initDb() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`CREATE TABLE IF NOT EXISTS teams (
    api_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    flag TEXT,
    elo_rating REAL DEFAULT 1500,
    fifa_ranking INTEGER,
    last_updated TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS matches (
    fixture_id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    home_id INTEGER NOT NULL,
    away_id INTEGER NOT NULL,
    home_goals INTEGER,
    away_goals INTEGER,
    status TEXT,
    league_id INTEGER,
    season INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS predictions (
    fixture_id INTEGER PRIMARY KEY,
    home_pct REAL,
    draw_pct REAL,
    away_pct REAL,
    elo_home REAL,
    elo_away REAL,
    fifa_home INTEGER,
    fifa_away INTEGER,
    home_form TEXT,
    away_form TEXT,
    predicted_score TEXT,
    confidence REAL,
    updated_at TEXT
  )`);
  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) buffer[i] = data[i];
  try {
    fs.writeFileSync(DB_PATH, buffer, { flag: 'w' });
  } catch (err) {
    // Windows may lock the file; data remains in memory
    console.warn('DB persist skipped:', err.code);
  }
}

function getDb() {
  return db;
}

// Team operations
function upsertTeam(team) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO teams (api_id, name, code, flag, elo_rating, fifa_ranking, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  stmt.run([team.api_id, team.name, team.code || '', team.flag || '',
    team.elo_rating || 1500, team.fifa_ranking || 0, new Date().toISOString()]);
  stmt.free();
  saveDb();
}

function getTeamByApiId(apiId) {
  const stmt = db.prepare(`SELECT * FROM teams WHERE api_id = ?`);
  stmt.bind([apiId]);
  const hasRow = stmt.step();
  if (!hasRow) { stmt.free(); return null; }
  const row = stmt.getAsObject();
  stmt.free();
  return row && row.api_id ? row : null;
}

function getAllTeams() {
  const stmt = db.prepare(`SELECT * FROM teams ORDER BY name`);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function updateElo(apiId, elo) {
  db.run(`UPDATE teams SET elo_rating = ?, last_updated = ? WHERE api_id = ?`, [elo, new Date().toISOString(), apiId]);
  saveDb();
}

function updateFifaRanking(apiId, rank) {
  db.run(`UPDATE teams SET fifa_ranking = ?, last_updated = ? WHERE api_id = ?`, [rank, new Date().toISOString(), apiId]);
  saveDb();
}

// Match operations
function upsertMatch(match) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO matches
    (fixture_id, date, home_id, away_id, home_goals, away_goals, status, league_id, season)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run([match.fixture_id, match.date, match.home_id, match.away_id,
    match.home_goals, match.away_goals, match.status || 'FT',
    match.league_id || null, match.season || null]);
  stmt.free();
  saveDb();
}

function getLastMatches(teamApiId, limit = 10) {
  const stmt = db.prepare(`SELECT * FROM matches
    WHERE (home_id = ? OR away_id = ?) AND status = 'FT'
    ORDER BY date DESC LIMIT ?`);
  stmt.bind([teamApiId, teamApiId, limit]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getMatchByFixtureId(fixtureId) {
  const stmt = db.prepare(`SELECT * FROM matches WHERE fixture_id = ?`);
  stmt.bind([fixtureId]);
  const hasRow = stmt.step();
  if (!hasRow) { stmt.free(); return null; }
  const row = stmt.getAsObject();
  stmt.free();
  return row && row.fixture_id ? row : null;
}

function countMatches() {
  const stmt = db.prepare(`SELECT COUNT(*) as cnt FROM matches`);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row.cnt;
}

// Prediction operations
function upsertPrediction(pred) {
  const stmt = db.prepare(`INSERT OR REPLACE INTO predictions
    (fixture_id, home_pct, draw_pct, away_pct, elo_home, elo_away,
     fifa_home, fifa_away, home_form, away_form, predicted_score, confidence, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run([pred.fixture_id, pred.home_pct, pred.draw_pct, pred.away_pct,
    pred.elo_home, pred.elo_away, pred.fifa_home, pred.fifa_away,
    pred.home_form, pred.away_form, pred.predicted_score, pred.confidence,
    new Date().toISOString()]);
  stmt.free();
  saveDb();
}

function getPrediction(fixtureId) {
  const stmt = db.prepare(`SELECT * FROM predictions WHERE fixture_id = ?`);
  stmt.bind([fixtureId]);
  const hasRow = stmt.step();
  if (!hasRow) { stmt.free(); return null; }
  const row = stmt.getAsObject();
  stmt.free();
  return row && row.fixture_id ? row : null;
}

function countPredictions() {
  const stmt = db.prepare(`SELECT COUNT(*) as cnt FROM predictions`);
  stmt.step();
  const row = stmt.getAsObject();
  stmt.free();
  return row.cnt;
}

module.exports = { initDb, getDb, upsertTeam, getTeamByApiId, getAllTeams,
  updateElo, updateFifaRanking, upsertMatch, getLastMatches, getMatchByFixtureId,
  countMatches, upsertPrediction, getPrediction, countPredictions };