const db = require('./db');

function computeForm(matches, teamId) {
  if (!matches || matches.length === 0) {
    return { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, streak: '' };
  }
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
  const results = [];
  for (const m of matches) {
    const isHome = m.home_id === teamId;
    const gfTeam = isHome ? m.home_goals : m.away_goals;
    const gaTeam = isHome ? m.away_goals : m.home_goals;
    if (gfTeam !== null && gaTeam !== null) {
      gf += gfTeam;
      ga += gaTeam;
      if (gfTeam > gaTeam) { wins++; results.push('W'); }
      else if (gfTeam === gaTeam) { draws++; results.push('D'); }
      else { losses++; results.push('L'); }
    }
  }
  const total = wins + draws + losses || 1;
  return {
    wins, draws, losses,
    winPct: Math.round((wins / total) * 100),
    drawPct: Math.round((draws / total) * 100),
    lossPct: Math.round((losses / total) * 100),
    gf, ga,
    avgGF: total > 0 ? (gf / total).toFixed(2) : '0.00',
    avgGA: total > 0 ? (ga / total).toFixed(2) : '0.00',
    streak: results.slice(0, 5).join(''),
    count: total
  };
}

function eloWinProbability(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

// Draw probability based on Elo difference: ~25% for equal teams, ~10% for 200pt diff
function eloDrawProbability(eloDiff) {
  return Math.max(0.08, 0.28 - 0.0009 * Math.abs(eloDiff));
}

function adjustEloForHome(eloHome, isNeutral) {
  return isNeutral ? eloHome : eloHome + 100;
}

function predictScore(homePct, drawPct, awayPct, homeForm, awayForm) {
  const homeAvgGF = parseFloat(homeForm.avgGF) || 1;
  const awayAvgGF = parseFloat(awayForm.avgGF) || 1;
  const homeAvgGA = parseFloat(homeForm.avgGA) || 1;
  const awayAvgGA = parseFloat(awayForm.avgGA) || 1;
  const expectedHomeGoals = Math.max(0, (homeAvgGF + awayAvgGA) / 2);
  const expectedAwayGoals = Math.max(0, (awayAvgGF + homeAvgGA) / 2);
  return `${Math.round(expectedHomeGoals)}-${Math.round(expectedAwayGoals)}`;
}

function computeConfidence(homePct, awayPct, matchCount) {
  const spread = Math.abs(homePct - awayPct);
  const dataFactor = Math.min(1, matchCount / 10);
  return Math.min(100, Math.round(spread * dataFactor));
}

async function generatePredictionFromIds(homeApiId, awayApiId, fixtureId) {
  const homeTeam = await db.getTeamByApiId(homeApiId);
  const awayTeam = await db.getTeamByApiId(awayApiId);
  if (!homeTeam || !awayTeam) return null;

  const eloHome = homeTeam.elo_rating || 1500;
  const eloAway = awayTeam.elo_rating || 1500;
  const fifaHome = homeTeam.fifa_ranking || null;
  const fifaAway = awayTeam.fifa_ranking || null;

  const adjustedEloHome = eloHome + 100;
  const eloDiff = adjustedEloHome - eloAway;

  const rawHomePct = eloWinProbability(adjustedEloHome, eloAway);
  const rawAwayPct = eloWinProbability(eloAway, adjustedEloHome);
  const rawDrawPct = eloDrawProbability(eloDiff);

  // Scale win probs so home + away + draw = 1
  const winScale = 1 - rawDrawPct;
  const scaledHomePct = rawHomePct * winScale / (rawHomePct + rawAwayPct);
  const scaledAwayPct = rawAwayPct * winScale / (rawHomePct + rawAwayPct);

  const homeMatches = await db.getLastMatches(homeApiId, 15);
  const awayMatches = await db.getLastMatches(awayApiId, 15);
  const homeForm = computeForm(homeMatches, homeApiId);
  const awayForm = computeForm(awayMatches, awayApiId);

  const formFactorHome = (homeForm.winPct - awayForm.winPct) / 200;
  const adjustedHomePct = Math.max(0.01, Math.min(0.98, scaledHomePct + formFactorHome));
  const adjustedAwayPct = Math.max(0.01, Math.min(0.98, scaledAwayPct - formFactorHome));
  const adjustedDrawPct = Math.max(0.01, 1 - adjustedHomePct - adjustedAwayPct);
  const total = adjustedHomePct + adjustedDrawPct + adjustedAwayPct;

  const homePct = Math.round((adjustedHomePct / total) * 100);
  const drawPct = Math.round((adjustedDrawPct / total) * 100);
  const awayPct = Math.round((adjustedAwayPct / total) * 100);

  const homeFormStr = `${homeForm.wins}V ${homeForm.draws}E ${homeForm.losses}D`;
  const awayFormStr = `${awayForm.wins}V ${awayForm.draws}E ${awayForm.losses}D`;
  const predictedScore = predictScore(homePct, drawPct, awayPct, homeForm, awayForm);
  const confidence = computeConfidence(homePct, awayPct, Math.max(1, homeForm.count + awayForm.count));

  const prediction = {
    fixture_id: fixtureId || Math.abs(((homeApiId * 1000 + awayApiId) * 1000 + 20260614)) >>> 0,
    home_pct: homePct,
    draw_pct: drawPct,
    away_pct: awayPct,
    elo_home: Math.round(eloHome),
    elo_away: Math.round(eloAway),
    fifa_home: fifaHome,
    fifa_away: fifaAway,
    home_form: homeFormStr,
    away_form: awayFormStr,
    predicted_score: predictedScore,
    confidence,
    home_name: homeTeam.name,
    away_name: awayTeam.name,
    home_code: homeTeam.code,
    away_code: awayTeam.code,
  };

  await db.upsertPrediction(prediction);
  return prediction;
}

async function generatePrediction(fixture, teams) {
  const fixtureId = fixture.fixture.id;
  const homeId = fixture.teams.home.id;
  const awayId = fixture.teams.away.id;

  const homeTeam = await db.getTeamByApiId(homeId);
  const awayTeam = await db.getTeamByApiId(awayId);

  const eloHome = homeTeam ? homeTeam.elo_rating : 1500;
  const eloAway = awayTeam ? awayTeam.elo_rating : 1500;
  const fifaHome = homeTeam ? homeTeam.fifa_ranking : null;
  const fifaAway = awayTeam ? awayTeam.fifa_ranking : null;

  const isNeutral = !fixture.fixture.venue;
  const adjustedEloHome = adjustEloForHome(eloHome, isNeutral);
  const eloDiff = adjustedEloHome - eloAway;

  const rawHomePct = eloWinProbability(adjustedEloHome, eloAway);
  const rawAwayPct = eloWinProbability(eloAway, adjustedEloHome);
  const rawDrawPct = eloDrawProbability(eloDiff);

  const winScale = 1 - rawDrawPct;
  const scaledHomePct = rawHomePct * winScale / (rawHomePct + rawAwayPct);
  const scaledAwayPct = rawAwayPct * winScale / (rawHomePct + rawAwayPct);

  const homeMatches = await db.getLastMatches(homeId, 10);
  const awayMatches = await db.getLastMatches(awayId, 10);
  const homeForm = computeForm(homeMatches, homeId);
  const awayForm = computeForm(awayMatches, awayId);

  const formFactorHome = (homeForm.winPct - awayForm.winPct) / 200;
  const adjustedHomePct = Math.max(0.01, Math.min(0.98, scaledHomePct + formFactorHome));
  const adjustedAwayPct = Math.max(0.01, Math.min(0.98, scaledAwayPct - formFactorHome));
  const adjustedDrawPct = Math.max(0.01, 1 - adjustedHomePct - adjustedAwayPct);
  const total = adjustedHomePct + adjustedDrawPct + adjustedAwayPct;

  const homePct = Math.round((adjustedHomePct / total) * 100);
  const drawPct = Math.round((adjustedDrawPct / total) * 100);
  const awayPct = Math.round((adjustedAwayPct / total) * 100);

  const homeFormStr = `${homeForm.wins}V ${homeForm.draws}E ${homeForm.losses}D`;
  const awayFormStr = `${awayForm.wins}V ${awayForm.draws}E ${awayForm.losses}D`;
  const predictedScore = predictScore(homePct, drawPct, awayPct, homeForm, awayForm);
  const confidence = computeConfidence(homePct, awayPct, Math.max(1, homeForm.count + awayForm.count));

  const prediction = {
    fixture_id: fixtureId,
    home_pct: homePct,
    draw_pct: drawPct,
    away_pct: awayPct,
    elo_home: Math.round(eloHome),
    elo_away: Math.round(eloAway),
    fifa_home: fifaHome,
    fifa_away: fifaAway,
    home_form: homeFormStr,
    away_form: awayFormStr,
    predicted_score: predictedScore,
    confidence,
    home_form_detail: homeForm,
    away_form_detail: awayForm
  };

  await db.upsertPrediction(prediction);
  return prediction;
}

async function refreshAllPredictions(fixtures) {
  const results = [];
  for (const f of fixtures) {
    try {
      const pred = await generatePrediction(f, null);
      results.push(pred);
    } catch (err) {
      console.error(`Error predicting fixture ${f.fixture.id}:`, err.message);
    }
  }
  return results;
}

async function getPredictionForFixture(fixtureId) {
  const cached = await db.getPrediction(fixtureId);
  return cached;
}

module.exports = { generatePrediction, generatePredictionFromIds, refreshAllPredictions, getPredictionForFixture, computeForm };