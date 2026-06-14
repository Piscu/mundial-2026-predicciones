const API = '/api';
let fixturesData = [];
let predictionsCache = {};
let oddsCache = {};
let currentFixtureId = null;

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

async function apiFetch(endpoint, params = {}) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const url = `${API}${endpoint}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status) {
  const labels = {
    'TBD': 'Por definir', 'NS': 'Programado', '1H': '1er tiempo',
    'HT': 'Medio tiempo', '2H': '2do tiempo', 'ET': 'Tiempo extra',
    'BT': 'Penales', 'P': 'Postergado', 'SUSP': 'Suspendido',
    'INT': 'Interrumpido', 'FT': 'Finalizado', 'AET': 'Finalizado (TE)',
    'PEN': 'Finalizado (Pen)'
  };
  return labels[status] || status;
}

function buildWhatsAppUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function getFlagEmoji(teamName) {
  const flags = {
    'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷',
    'Czech Republic': '🇨🇿', 'Canada': '🇨🇦', 'Bosnia & Herzegovina': '🇧🇦',
    'Spain': '🇪🇸', 'Cabo Verde': '🇨🇻', 'Saudi Arabia': '🇸🇦',
    'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Congo DR': '🇨🇩',
    'Uzbekistan': '🇺🇿', 'Panama': '🇵🇦', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'DR Congo': '🇨🇩', 'Colombia': '🇨🇴', 'Portugal': '🇵🇹',
    'Algeria': '🇩🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
    'Argentina': '🇦🇷', 'Qatar': '🇶🇦', 'Ecuador': '🇪🇨',
    'Iran': '🇮🇷', 'USA': '🇺🇸', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    'France': '🇫🇷', 'Australia': '🇦🇺', 'Denmark': '🇩🇰',
    'Tunisia': '🇹🇳', 'Germany': '🇩🇪', 'Japan': '🇯🇵',
    'Costa Rica': '🇨🇷', 'Belgium': '🇧🇪', 'Croatia': '🇭🇷',
    'Brazil': '🇧🇷', 'Serbia': '🇷🇸', 'Switzerland': '🇨🇭',
    'Cameroon': '🇨🇲', 'Uruguay': '🇺🇾', 'Ghana': '🇬🇭',
    'Netherlands': '🇳🇱', 'Senegal': '🇸🇳', 'Poland': '🇵🇱',
    'Nigeria': '🇳🇬', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Iraq': '🇮🇶',
    'New Zealand': '🇳🇿', 'Curacao': '🇨🇼', 'Cape Verde': '🇨🇻',
    'Ivory Coast': '🇨🇮', 'Egypt': '🇪🇬', 'Norway': '🇳🇴',
    'Sweden': '🇸🇪', 'Paraguay': '🇵🇾', 'Türkiye': '🇹🇷',
    'Turkey': '🇹🇷', 'Peru': '🇵🇪', 'Chile': '🇨🇱',
    'Venezuela': '🇻🇪', 'Bolivia': '🇧🇴', 'Hungary': '🇭🇺',
    'Greece': '🇬🇷', 'Romania': '🇷🇴', 'Slovakia': '🇸🇰',
    'Slovenia': '🇸🇮', 'Ukraine': '🇺🇦', 'Finland': '🇫🇮',
    'Iceland': '🇮🇸', 'North Macedonia': '🇲🇰', 'Montenegro': '🇲🇪',
    'Albania': '🇦🇱', 'Armenia': '🇦🇲', 'Belarus': '🇧🇾',
    'Cyprus': '🇨🇾', 'Estonia': '🇪🇪', 'Faroe Islands': '🇫🇴',
    'Georgia': '🇬🇪', 'Israel': '🇮🇱', 'Kazakhstan': '🇰🇿',
    'Latvia': '🇱🇻', 'Lithuania': '🇱🇹', 'Luxembourg': '🇱🇺',
    'Malta': '🇲🇹', 'Moldova': '🇲🇩', 'San Marino': '🇸🇲',
    'Liberia': '🇱🇷', 'Madagascar': '🇲🇬', 'Malawi': '🇲🇼',
    'Mali': '🇲🇱', 'Mauritania': '🇲🇷', 'Mauritius': '🇲🇺',
    'Mozambique': '🇲🇿', 'Namibia': '🇳🇦', 'Niger': '🇳🇪',
    'Rwanda': '🇷🇼', 'Sao Tome': '🇸🇹', 'Seychelles': '🇸🇨',
    'Sierra Leone': '🇸🇱', 'Somalia': '🇸🇴', 'South Sudan': '🇸🇸',
    'Sudan': '🇸🇩', 'Eswatini': '🇸🇿', 'Tanzania': '🇹🇿',
    'Togo': '🇹🇬', 'Uganda': '🇺🇬', 'Zambia': '🇿🇲',
    'Zimbabwe': '🇿🇼', 'Angola': '🇦🇴', 'Benin': '🇧🇯',
    'Botswana': '🇧🇼', 'Burkina Faso': '🇧🇫', 'Burundi': '🇧🇮',
    'Central African Republic': '🇨🇫', 'Chad': '🇹🇩', 'Comoros': '🇰🇲',
    'Congo': '🇨🇬', 'Djibouti': '🇩🇯', 'Equatorial Guinea': '🇬🇶',
    'Eritrea': '🇪🇷', 'Ethiopia': '🇪🇹', 'Gabon': '🇬🇦',
    'Gambia': '🇬🇲', 'Guinea': '🇬🇳', 'Guinea-Bissau': '🇬🇼',
    'Kenya': '🇰🇪', 'Lesotho': '🇱🇸', 'Libya': '🇱🇾',
    'China': '🇨🇳', 'India': '🇮🇳', 'Indonesia': '🇮🇩',
    'Malaysia': '🇲🇾', 'Maldives': '🇲🇻', 'Mongolia': '🇲🇳',
    'Myanmar': '🇲🇲', 'Nepal': '🇳🇵', 'North Korea': '🇰🇵',
    'Oman': '🇴🇲', 'Pakistan': '🇵🇰', 'Palestine': '🇵🇸',
    'Philippines': '🇵🇭', 'Singapore': '🇸🇬', 'Sri Lanka': '🇱🇰',
    'Syria': '🇸🇾', 'Tajikistan': '🇹🇯', 'Thailand': '🇹🇭',
    'Timor-Leste': '🇹🇱', 'Turkmenistan': '🇹🇲', 'United Arab Emirates': '🇦🇪',
    'Vietnam': '🇻🇳', 'Yemen': '🇾🇪', 'Afghanistan': '🇦🇫',
    'Bahrain': '🇧🇭', 'Bangladesh': '🇧🇩', 'Bhutan': '🇧🇹',
    'Brunei': '🇧🇳', 'Cambodia': '🇰🇭', 'Hong Kong': '🇭🇰',
    'Kuwait': '🇰🇼', 'Kyrgyzstan': '🇰🇬', 'Laos': '🇱🇦',
    'Lebanon': '🇱🇧', 'Macau': '🇲🇴', 'Taiwan': '🇹🇼'
  };
  return flags[teamName] || '';
}

function generateShareText(fixture) {
  const { fixture: f, teams, goals, league } = fixture;
  const homeGoal = goals.home !== null ? goals.home : '?';
  const awayGoal = goals.away !== null ? goals.away : '?';
  const homeFlag = getFlagEmoji(teams.home.name);
  const awayFlag = getFlagEmoji(teams.away.name);

  let text = `⚽ *MUNDIAL 2026*\n`;
  text += `🏆 ${league.round || ''}\n`;
  text += `📅 ${formatDate(f.date)} ${formatTime(f.date)}\n`;

  if (f.venue?.name) {
    text += `📍 ${f.venue.name}${f.venue?.city ? ` (${f.venue.city})` : ''}\n`;
  }

  text += `\n*${homeFlag} ${teams.home.name} ${homeGoal} - ${awayGoal} ${teams.away.name} ${awayFlag}*\n`;

  const pred = predictionsCache[f.id];
  if (pred && pred.predictions.percent) {
    const p = pred.predictions;
    text += `\n🔮 *Predicción*\n`;
    text += `${homeFlag} ${teams.home.name}: ${p.percent.home}\n`;
    text += `🤝 Empate: ${p.percent.draw}\n`;
    text += `${awayFlag} ${teams.away.name}: ${p.percent.away}\n`;
    if (p.advice && p.advice !== 'No predictions available') {
      text += `💡 ${p.advice}\n`;
    }
  }

  const oddsData = oddsCache[f.id];
  const bkm = (oddsData && oddsData[0]?.bookmakers) || [];
  if (bkm.length > 0) {
    const avg = calculateAverageOdds(bkm);
    text += `\n📊 *Cuotas (media ${avg ? avg.count : bkm.length} casas)*\n`;
    if (avg) {
      text += `📈 ${homeFlag} ${teams.home.name}: ${avg.home} | 🤝 Empate: ${avg.draw} | ${awayFlag} ${teams.away.name}: ${avg.away}\n`;
    }
  }

  text += `\n📲 *Compartido desde App Predicciones WA*`;
  return text;
}

const statusOrder = { 'LIVE': 0, '1H': 0, '2H': 0, 'HT': 0, 'ET': 0, 'BT': 0, 'INT': 0, 'NS': 1, 'TBD': 2, 'FT': 3, 'AET': 3, 'PEN': 3 };

function sortFixtures(a, b) {
  const aOrder = statusOrder[a.fixture.status.short] || 9;
  const bOrder = statusOrder[b.fixture.status.short] || 9;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return new Date(a.fixture.date) - new Date(b.fixture.date);
}

function createMatchCard(fixture) {
  const { fixture: f, teams, goals, league } = fixture;
  const homeGoal = goals.home !== null ? goals.home : '-';
  const awayGoal = goals.away !== null ? goals.away : '-';
  const isLive = ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'INT'].includes(f.status.short);
  const isFinished = ['FT', 'AET', 'PEN'].includes(f.status.short);
  const statusClass = isLive ? 'LIVE' : (isFinished ? 'FT' : f.status.short || 'NS');

  const card = document.createElement('div');
  card.className = 'match-card';
  card.dataset.fixtureId = f.id;

  card.innerHTML = `
    <div class="match-header">
      <span class="match-round">${league.round || ''}</span>
      <span class="match-status status-${statusClass}">
        ${isLive ? '🔴 EN VIVO' : (isFinished ? '✅ Finalizado' : getStatusLabel(f.status.short))}
      </span>
    </div>
    <div class="match-teams">
      <div class="team home">
        <img class="team-logo" src="${teams.home.logo}" alt="${teams.home.name}" loading="lazy">
        <span class="team-name">${teams.home.name}</span>
      </div>
      <div class="match-score">
        <span>${homeGoal}</span>
        <span class="score-x">-</span>
        <span>${awayGoal}</span>
      </div>
      <div class="team away">
        <img class="team-logo" src="${teams.away.logo}" alt="${teams.away.name}" loading="lazy">
        <span class="team-name">${teams.away.name}</span>
      </div>
    </div>
    <div class="match-actions">
      <span style="color:var(--text2);font-size:0.8rem;flex:1">
        ${formatDate(f.date)} ${formatTime(f.date)}
      </span>
      <button class="btn btn-detail" data-fixture-id="${f.id}">Detalles</button>
      <a class="btn btn-whatsapp" target="_blank" href="${buildWhatsAppUrl(generateShareText(fixture))}">
        Compartir
      </a>
    </div>
  `;
  return card;
}

async function loadFixtures(filter = 'all') {
  const container = $('#fixtures-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando partidos...</p></div>';
  try {
    let fixtures;
    if (filter === 'live') {
      const data = await apiFetch('/fixtures', { live: 'all' });
      fixtures = data.response || [];
    } else {
      const data = await apiFetch('/fixtures', { league: 1, season: 2026 });
      fixtures = data.response || [];
    }
    fixtures.sort(sortFixtures);
    fixturesData = fixtures;

    if (filter !== 'all') {
      if (filter === 'live') {
        fixtures = fixtures.filter(f => ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'INT'].includes(f.fixture.status.short));
      } else if (filter === 'NS') {
        fixtures = fixtures.filter(f => f.fixture.status.short === 'NS' || f.fixture.status.short === 'TBD');
      } else if (filter === 'FT') {
        fixtures = fixtures.filter(f => ['FT', 'AET', 'PEN'].includes(f.fixture.status.short));
      }
    }

    if (fixtures.length === 0) {
      container.innerHTML = '<div class="error-msg">No se encontraron partidos</div>';
      return;
    }

    container.innerHTML = '';
    fixtures.forEach(f => container.appendChild(createMatchCard(f)));
  } catch (err) {
    container.innerHTML = `<div class="error-msg">Error al cargar partidos: ${err.message}</div>`;
  }
}

async function loadStandings() {
  const container = $('#standings-view');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando grupos...</p></div>';
  try {
    const data = await apiFetch('/standings', { league: 1, season: 2026 });
    if (data.plan_limited) {
      container.innerHTML = `<div class="error-msg">${data.message || 'Grupos no disponibles en plan gratuito'}. <a href="https://dashboard.api-football.com/" target="_blank" style="color:var(--accent)">Actualiza tu plan</a> para ver los grupos del Mundial 2026.</div>`;
      return;
    }
    const standings = data.response?.[0]?.league?.standings || [];
    if (standings.length === 0) {
      container.innerHTML = '<div class="error-msg">No hay datos de grupos disponibles</div>';
      return;
    }
    container.innerHTML = '';
    standings.forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'standing-group';
      const groupName = group[0]?.group || 'Grupo';
      groupDiv.innerHTML = `<h3>${groupName}</h3>`;
      const table = document.createElement('table');
      table.className = 'standing-table';
      table.innerHTML = `
        <thead><tr>
          <th></th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th>
        </tr></thead>
        <tbody>
          ${group.map((t, i) => {
            const top = i < 2 ? 'top' : '';
            return `<tr class="${top}">
              <td class="rank">${t.rank}</td>
              <td><div class="team-cell"><img src="${t.team.logo}" alt="">${t.team.name}</div></td>
              <td>${t.all.played}</td>
              <td>${t.all.win}</td>
              <td>${t.all.draw}</td>
              <td>${t.all.lose}</td>
              <td>${t.all.goals.for}</td>
              <td>${t.all.goals.against}</td>
              <td>${t.goalsDiff}</td>
              <td class="pts">${t.points}</td>
            </tr>`;
          }).join('')}
        </tbody>
      `;
      groupDiv.appendChild(table);
      container.appendChild(groupDiv);
    });
  } catch (err) {
    container.innerHTML = `<div class="error-msg">Error al cargar grupos: ${err.message}</div>`;
  }
}

async function loadPredictions(refresh) {
  const container = $('#predictions-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando predicciones...</p></div>';
  try {
    if (refresh || fixturesData.length === 0) {
      const fd = await apiFetch('/fixtures', { league: 1, season: 2026, ...(refresh ? { _refresh: 1 } : {}) });
      fixturesData = fd.response || [];
    }
    const fixtures = fixturesData;
    if (fixtures.length === 0) {
      container.innerHTML = '<div class="error-msg">No hay partidos disponibles</div>';
      return;
    }
    if (refresh) predictionsCache = {};
    container.innerHTML = '';
    const fixturesToShow = fixtures.slice(0, 20);
    const predPromises = fixturesToShow.map(f =>
      apiFetch('/predictions', { fixture: f.fixture.id, ...(refresh ? { _refresh: 1 } : {}) })
        .then(d => {
          if (d.results > 0) {
            predictionsCache[f.fixture.id] = d.response[0];
            return { fixture: f, prediction: d.response[0] };
          }
          return { fixture: f, prediction: null };
        })
        .catch(() => ({ fixture: f, prediction: null }))
    );
    const results = await Promise.all(predPromises);
    results.forEach(({ fixture, prediction }) => {
      container.appendChild(createPredictionCard(fixture, prediction));
    });
  } catch (err) {
    container.innerHTML = `<div class="error-msg">Error al cargar predicciones: ${err.message}</div>`;
  }
}

function createPredictionCard(fixture, prediction) {
  const { fixture: f, teams, goals, league } = fixture;
  const card = document.createElement('div');
  card.className = 'match-card';
  card.dataset.fixtureId = f.id;
  card.innerHTML = `
    <div class="match-header">
      <span class="match-round">${league.round || ''}</span>
      <span style="color:var(--text2);font-size:0.8rem">${formatDate(f.date)} ${formatTime(f.date)}</span>
    </div>
    <div class="match-teams">
      <div class="team home">
        <img class="team-logo" src="${teams.home.logo}" alt="" loading="lazy">
        <span class="team-name">${teams.home.name}</span>
      </div>
      <div class="match-score" style="font-size:0.9rem;font-weight:400;color:var(--text2);min-width:auto">vs</div>
      <div class="team away">
        <img class="team-logo" src="${teams.away.logo}" alt="" loading="lazy">
        <span class="team-name">${teams.away.name}</span>
      </div>
    </div>
    ${prediction ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <div class="prediction-bar">
          <div class="bar-home" style="width:${prediction.predictions.percent.home}">${prediction.predictions.percent.home}</div>
          <div class="bar-draw" style="width:${prediction.predictions.percent.draw}">${prediction.predictions.percent.draw}</div>
          <div class="bar-away" style="width:${prediction.predictions.percent.away}">${prediction.predictions.percent.away}</div>
        </div>
        <div class="prediction-advice">💡 ${prediction.predictions.advice === 'No predictions available' ? 'Sin predicción disponible' : prediction.predictions.advice || 'Sin consejo disponible'}</div>
      </div>
    ` : `
      <div class="error-msg" style="margin-top:8px">Sin predicción disponible</div>
    `}
    <div class="match-actions">
      <span style="flex:1"></span>
      <button class="btn btn-detail" data-fixture-id="${f.id}">Detalles</button>
      <a class="btn btn-whatsapp" target="_blank" href="${buildWhatsAppUrl(generateShareText({ fixture: f, teams, goals, league }))}">Compartir</a>
    </div>
  `;
  return card;
}

async function loadOdds(refresh) {
  const container = $('#odds-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando cuotas...</p></div>';
  try {
    if (refresh || fixturesData.length === 0) {
      const fd = await apiFetch('/fixtures', { league: 1, season: 2026, ...(refresh ? { _refresh: 1 } : {}) });
      fixturesData = fd.response || [];
    }
    const fixtures = fixturesData;
    if (fixtures.length === 0) {
      container.innerHTML = '<div class="error-msg">No hay partidos disponibles</div>';
      return;
    }
    if (refresh) oddsCache = {};
    container.innerHTML = '';
    const fixturesToShow = fixtures.slice(0, 20);
    const oddsPromises = fixturesToShow.map(f =>
      apiFetch('/odds', { fixture: f.fixture.id, ...(refresh ? { _refresh: 1 } : {}) })
        .then(d => {
          if (d.results > 0) {
            oddsCache[f.fixture.id] = d.response;
            return { fixture: f, odds: d.response };
          }
          return { fixture: f, odds: null };
        })
        .catch(() => ({ fixture: f, odds: null }))
    );
    const results = await Promise.all(oddsPromises);
    results.forEach(({ fixture, odds }) => {
      container.appendChild(createOddsCard(fixture, odds));
    });
  } catch (err) {
    container.innerHTML = `<div class="error-msg">Error al cargar cuotas: ${err.message}</div>`;
  }
}

function createOddsCard(fixture, odds) {
  const { fixture: f, teams, goals, league } = fixture;
  const card = document.createElement('div');
  card.className = 'match-card';
  card.dataset.fixtureId = f.id;
  let oddsHtml = '';
  const bookmakers = (odds && odds[0]?.bookmakers) || [];
  if (bookmakers.length > 0) {
    const avg = calculateAverageOdds(bookmakers);
    oddsHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <table class="odds-table">
        <thead><tr><th>Casa</th><th>1</th><th>X</th><th>2</th></tr></thead>
        <tbody>
          ${avg ? `<tr style="background:var(--surface2);font-weight:700"><td class="bookmaker-name">📊 Media (${avg.count})</td>
            <td class="odds-value" style="color:var(--accent)">${avg.home}</td>
            <td class="odds-value">${avg.draw}</td>
            <td class="odds-value" style="color:var(--green)">${avg.away}</td></tr>` : ''}
          ${bookmakers.slice(0, 5).map(b => {
            const bet = b.bets?.find(x => x.id === 1) || b.bets?.[0];
            const vals = bet?.values || [];
            const home = vals.find(v => v.value === 'Home' || v.value === '1');
            const draw = vals.find(v => v.value === 'Draw' || v.value === 'X');
            const away = vals.find(v => v.value === 'Away' || v.value === '2');
            return `<tr>
              <td class="bookmaker-name">${b.name}</td>
              <td class="odds-value">${home ? home.odd : '-'}</td>
              <td class="odds-value">${draw ? draw.odd : '-'}</td>
              <td class="odds-value">${away ? away.odd : '-'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  } else {
    oddsHtml = '<div class="error-msg" style="margin-top:8px">Sin cuotas disponibles</div>';
  }
  card.innerHTML = `
    <div class="match-header">
      <span class="match-round">${league.round || ''}</span>
      <span style="color:var(--text2);font-size:0.8rem">${formatDate(f.date)} ${formatTime(f.date)}</span>
    </div>
    <div class="match-teams">
      <div class="team home">
        <img class="team-logo" src="${teams.home.logo}" alt="" loading="lazy">
        <span class="team-name">${teams.home.name}</span>
      </div>
      <div class="match-score" style="font-size:0.9rem;font-weight:400;color:var(--text2);min-width:auto">vs</div>
      <div class="team away">
        <img class="team-logo" src="${teams.away.logo}" alt="" loading="lazy">
        <span class="team-name">${teams.away.name}</span>
      </div>
    </div>
    ${oddsHtml}
    <div class="match-actions">
      <span style="flex:1"></span>
      <button class="btn btn-detail" data-fixture-id="${f.id}">Detalles</button>
      <a class="btn btn-whatsapp" target="_blank" href="${buildWhatsAppUrl(generateShareText({ fixture: f, teams, goals, league }))}">Compartir</a>
    </div>
  `;
  return card;
}

async function openMatchDetail(fixtureId) {
  currentFixtureId = fixtureId;
  const fixture = fixturesData.find(f => f.fixture.id === fixtureId);
  if (!fixture) return;
  const modal = $('#match-modal');
  const body = $('#modal-body');
  const { f, teams, goals, league } = fixture;

  body.innerHTML = `
    <div class="modal-match-header">
      <div class="modal-info">${formatDate(f.date)} ${formatTime(f.date)} · ${league.round || ''}</div>
      <div class="modal-teams">
        <div class="modal-team">
          <img class="modal-team-logo" src="${teams.home.logo}" alt="">
          <span class="modal-team-name">${teams.home.name}</span>
        </div>
        <div class="modal-score">${goals.home !== null ? goals.home : '-'} - ${goals.away !== null ? goals.away : '-'}</div>
        <div class="modal-team">
          <img class="modal-team-logo" src="${teams.away.logo}" alt="">
          <span class="modal-team-name">${teams.away.name}</span>
        </div>
      </div>
      <div class="modal-info">${f.venue?.name || ''} ${f.venue?.city ? '· ' + f.venue.city : ''}</div>
    </div>
    <div class="modal-section" id="modal-prediction">
      <h3>🔮 Predicción</h3>
      <div class="loading" style="padding:12px"><div class="spinner"></div></div>
    </div>
    <div class="modal-section" id="modal-odds">
      <h3>📊 Cuotas</h3>
      <div class="loading" style="padding:12px"><div class="spinner"></div></div>
    </div>
    <div class="share-section">
      <a class="btn btn-whatsapp" target="_blank" id="modal-share-wa" href="#">Compartir en WhatsApp</a>
      <button class="btn btn-copy" id="modal-copy">Copiar texto</button>
    </div>
  `;
  modal.classList.remove('hidden');

  // Update share links after data loads
  function updateShareLinks() {
    const url = buildWhatsAppUrl(generateShareText(fixture));
    const waBtn = $('#modal-share-wa');
    if (waBtn) waBtn.href = url;
  }

  try {
    const predData = await apiFetch('/predictions', { fixture: fixtureId });
    if (predData.results > 0) {
      predictionsCache[fixtureId] = predData.response[0];
      renderPredictionDetail(predData.response[0]);
    } else {
      $('#modal-prediction').querySelector('.loading').outerHTML = '<div class="error-msg">No hay predicción disponible</div>';
    }
  } catch {
    $('#modal-prediction').querySelector('.loading').outerHTML = '<div class="error-msg">Error al cargar predicción</div>';
  }
  updateShareLinks();

  try {
    const oddsData = await apiFetch('/odds', { fixture: fixtureId });
    if (oddsData.results > 0) {
      oddsCache[fixtureId] = oddsData.response;
      renderOddsDetail(oddsData.response);
    } else {
      $('#modal-odds').querySelector('.loading').outerHTML = '<div class="error-msg">No hay cuotas disponibles</div>';
    }
  } catch {
    $('#modal-odds').querySelector('.loading').outerHTML = '<div class="error-msg">Error al cargar cuotas</div>';
  }
  updateShareLinks();
}

function renderPredictionDetail(data) {
  const container = $('#modal-prediction');
  const { predictions, teams, comparison } = data;
  container.innerHTML = `
    <h3>🔮 Predicción</h3>
    <div class="prediction-bar">
      <div class="bar-home" style="width:${predictions.percent.home}">${predictions.percent.home}</div>
      <div class="bar-draw" style="width:${predictions.percent.draw}">${predictions.percent.draw}</div>
      <div class="bar-away" style="width:${predictions.percent.away}">${predictions.percent.away}</div>
    </div>
    <div class="prediction-advice">💡 ${predictions.advice === 'No predictions available' ? 'Sin predicción disponible' : predictions.advice || 'Sin consejo disponible'}</div>
    <div style="margin-top:16px">
      <h3>📊 Comparativa</h3>
      <div class="comparison-grid">
        ${renderComparison('Forma', comparison.form.home, comparison.form.away)}
        ${renderComparison('Ataque', comparison.att.home, comparison.att.away)}
        ${renderComparison('Defensa', comparison.def.home, comparison.def.away)}
        ${renderComparison('Poisson', comparison.poisson_distribution?.home, comparison.poisson_distribution?.away)}
        ${renderComparison('H2H', comparison.h2h?.home, comparison.h2h?.away)}
        ${renderComparison('Goles', comparison.goals?.home, comparison.goals?.away)}
      </div>
    </div>
  `;
}

function renderComparison(label, home, away) {
  const h = parseFloat(home) || 0;
  const a = parseFloat(away) || 0;
  const total = h + a || 1;
  const hPct = (h / total) * 100;
  const aPct = (a / total) * 100;
  return `
    <div class="comparison-item">
      <span class="val-home">${home || '0%'}</span>
      <span class="label">${label}</span>
      <span class="val-away">${away || '0%'}</span>
    </div>
    <div class="comparison-bar-wrapper">
      <div class="comparison-bar-track">
        <div class="comparison-bar-fill" style="width:${hPct}%;background:var(--accent);float:left"></div>
      </div>
      <div class="comparison-bar-track">
        <div class="comparison-bar-fill" style="width:${aPct}%;background:var(--green);float:right"></div>
      </div>
    </div>
  `;
}

function calculateAverageOdds(bookmakers) {
  if (!bookmakers || bookmakers.length === 0) return null;
  let homeSum = 0, drawSum = 0, awaySum = 0, count = 0;
  bookmakers.forEach(b => {
    const bet = b.bets?.find(x => x.id === 1) || b.bets?.[0];
    if (!bet) return;
    const vals = bet.values || [];
    const home = parseFloat(vals.find(v => v.value === 'Home' || v.value === '1')?.odd);
    const draw = parseFloat(vals.find(v => v.value === 'Draw' || v.value === 'X')?.odd);
    const away = parseFloat(vals.find(v => v.value === 'Away' || v.value === '2')?.odd);
    if (home && draw && away && !isNaN(home) && !isNaN(draw) && !isNaN(away)) {
      homeSum += home; drawSum += draw; awaySum += away; count++;
    }
  });
  if (count === 0) return null;
  return { home: (homeSum / count).toFixed(2), draw: (drawSum / count).toFixed(2), away: (awaySum / count).toFixed(2), count };
}

function renderOddsDetail(odds) {
  const container = $('#modal-odds');
  const bookmakers = (odds && odds[0]?.bookmakers) || [];
  const avg = calculateAverageOdds(bookmakers);
  let html = `<h3>📊 Cuotas <span style="font-size:0.8rem;color:var(--text2);font-weight:400">(${bookmakers.length} casas)</span></h3>`;
  html += `<table class="odds-table"><thead><tr><th>Casa</th><th>1</th><th>X</th><th>2</th></tr></thead><tbody>`;
  if (avg) {
    html += `<tr style="background:var(--surface2);font-weight:700"><td class="bookmaker-name">📊 Media (${avg.count})</td>
      <td class="odds-value" style="color:var(--accent)">${avg.home}</td>
      <td class="odds-value">${avg.draw}</td>
      <td class="odds-value" style="color:var(--green)">${avg.away}</td></tr>`;
  }
  bookmakers.slice(0, 10).forEach(b => {
    const bet = b.bets?.find(x => x.id === 1) || b.bets?.[0];
    const vals = bet?.values || [];
    const home = vals.find(v => v.value === 'Home' || v.value === '1');
    const draw = vals.find(v => v.value === 'Draw' || v.value === 'X');
    const away = vals.find(v => v.value === 'Away' || v.value === '2');
    html += `<tr><td class="bookmaker-name">${b.name}</td>
      <td class="odds-value">${home ? home.odd : '-'}</td>
      <td class="odds-value">${draw ? draw.odd : '-'}</td>
      <td class="odds-value">${away ? away.odd : '-'}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function loadAdvancedPredictions() {
  const container = $('#advanced-list');
  container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Cargando predicciones...</p></div>';
  try {
    // Populate team selectors
    populateTeamSelects();

    // Load pre-computed predictions from DB first
    const resp = await fetch('/api/predictions-all');
    const data = await resp.json();
    if (data.predictions && data.predictions.length > 0) {
      container.innerHTML = '';
      data.predictions.slice(0, 30).forEach(pred => {
        container.appendChild(createSimpleAdvancedCard(pred));
      });
    } else {
      container.innerHTML = '<div class="error-msg">No hay predicciones. Usá "⭐ Sincronizar Elo" para generarlas.</div>';
    }
  } catch (err) {
    container.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
  }
}

function populateTeamSelects() {
  const homeSel = $('#sel-home-team');
  const awaySel = $('#sel-away-team');
  if (!homeSel || homeSel.options.length > 1) return;
  const teams = []; // We'll populate from DB via fetch
  fetch('/api/teams-list').then(r => r.json()).then(data => {
    const teams = data.teams || [];
    homeSel.innerHTML = '<option value="">Seleccioná equipo local</option>' + teams.map(t => `<option value="${t.api_id}">${t.name} (Elo: ${t.elo_rating})</option>`).join('');
    awaySel.innerHTML = '<option value="">Seleccioná equipo visitante</option>' + teams.map(t => `<option value="${t.api_id}">${t.name} (Elo: ${t.elo_rating})</option>`).join('');
  }).catch(() => {});
}

function createSimpleAdvancedCard(pred) {
  const card = document.createElement('div');
  card.className = 'match-card';
  card.innerHTML = `
    <div class="match-header">
      <span style="color:var(--text2);font-size:0.8rem">⭐ Elo: ${pred.elo_home || '?'} vs ${pred.elo_away || '?'}</span>
      <span style="color:var(--text2);font-size:0.8rem">🎯 ${pred.confidence || 0}% confianza</span>
    </div>
    <div class="match-teams">
      <div class="team home">
        <span class="team-name" style="font-weight:700;color:var(--accent)">${pred.home_name || pred.home_code || 'Local'}</span>
      </div>
      <div class="match-score" style="font-weight:700;font-size:1.1rem">${pred.predicted_score || '?-?'}</div>
      <div class="team away">
        <span class="team-name" style="font-weight:700">${pred.away_name || pred.away_code || 'Visitante'}</span>
      </div>
    </div>
    <div class="prediction-bar" style="margin-bottom:4px">
      <div class="bar-home" style="width:${pred.home_pct}%">${pred.home_pct}%</div>
      <div class="bar-draw" style="width:${pred.draw_pct}%">${pred.draw_pct}%</div>
      <div class="bar-away" style="width:${pred.away_pct}%">${pred.away_pct}%</div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text2)">
      <span>📊 ${pred.home_form || '—'}</span>
      <span>📊 ${pred.away_form || '—'}</span>
    </div>
  `;
  return card;
}

function createAdvancedCard(fixture, pred) {
  const { fixture: f, teams, goals, league } = fixture;
  const card = document.createElement('div');
  card.className = 'match-card';
  card.dataset.fixtureId = f.id;
  card.innerHTML = `
    <div class="match-header">
      <span class="match-round">${league.round || ''}</span>
      <span style="color:var(--text2);font-size:0.8rem">${formatDate(f.date)} ${formatTime(f.date)}</span>
    </div>
    <div class="match-teams">
      <div class="team home">
        <img class="team-logo" src="${teams.home.logo}" alt="" loading="lazy">
        <span class="team-name">${teams.home.name}</span>
      </div>
      <div class="match-score" style="font-size:0.9rem;font-weight:400;color:var(--text2);min-width:auto">vs</div>
      <div class="team away">
        <img class="team-logo" src="${teams.away.logo}" alt="" loading="lazy">
        <span class="team-name">${teams.away.name}</span>
      </div>
    </div>
    ${pred ? `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text2);margin-bottom:8px">
        <span>⭐ Elo: ${pred.elo_home || '?'} vs ${pred.elo_away || '?'}</span>
        ${pred.fifa_home ? `<span>🏆 FIFA: #${pred.fifa_home} vs #${pred.fifa_away}</span>` : ''}
        <span>🎯 ${pred.confidence || 0}% confianza</span>
      </div>
      <div class="prediction-bar" style="margin-bottom:6px">
        <div class="bar-home" style="width:${pred.home_pct}%">${pred.home_pct}%</div>
        <div class="bar-draw" style="width:${pred.draw_pct}%">${pred.draw_pct}%</div>
        <div class="bar-away" style="width:${pred.away_pct}%">${pred.away_pct}%</div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text2)">
        <span>📊 ${pred.home_form || '—'}</span>
        <span style="font-weight:700;color:var(--accent)">${pred.predicted_score || '?'}</span>
        <span>📊 ${pred.away_form || '—'}</span>
      </div>
    </div>` : `
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);text-align:center;color:var(--text2);font-size:0.8rem">
      Sin datos. <button class="btn btn-refresh" onclick="syncElo()" style="padding:4px 10px">Sincronizar Elo</button>
    </div>`}
    <div class="match-actions" style="margin-top:8px">
      <span style="flex:1"></span>
      <button class="btn btn-detail" data-fixture-id="${f.id}">Detalles</button>
    </div>
  `;
  return card;
}

async function predictMatchup(homeId, awayId) {
  const resultDiv = $('#matchup-result');
  resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const resp = await fetch(`/api/predictions-advanced?home=${homeId}&away=${awayId}`);
    const data = await resp.json();
    if (data.prediction) {
      const p = data.prediction;
      resultDiv.innerHTML = `
        <div class="match-card" style="border-color:var(--accent)">
          <div class="match-header">
            <span style="color:var(--text2);font-size:0.8rem">⭐ Elo: ${p.elo_home} vs ${p.elo_away}</span>
            <span style="color:var(--text2);font-size:0.8rem">🎯 ${p.confidence}% confianza</span>
          </div>
          <div class="match-teams">
            <div class="team home">
              <span class="team-name" style="font-weight:700;color:var(--accent)">${p.home_name || p.home_code || 'Local'}</span>
            </div>
            <div class="match-score" style="font-weight:700;font-size:1.2rem">${p.predicted_score || '?-?'}</div>
            <div class="team away">
              <span class="team-name" style="font-weight:700">${p.away_name || p.away_code || 'Visitante'}</span>
            </div>
          </div>
          <div class="prediction-bar">
            <div class="bar-home" style="width:${p.home_pct}%">${p.home_pct}%</div>
            <div class="bar-draw" style="width:${p.draw_pct}%">${p.draw_pct}%</div>
            <div class="bar-away" style="width:${p.away_pct}%">${p.away_pct}%</div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text2);margin-top:8px">
            <span>📊 ${p.home_form || '—'}</span>
            <span>📊 ${p.away_form || '—'}</span>
          </div>
        </div>`;
    } else {
      resultDiv.innerHTML = '<div class="error-msg">No se pudo generar predicción</div>';
    }
  } catch (err) {
    resultDiv.innerHTML = `<div class="error-msg">Error: ${err.message}</div>`;
  }
}

async function syncElo() {
  const btn = $('#btn-sync-elo');
  if (btn) { btn.disabled = true; btn.textContent = '⭐ Sincronizando...'; }
  try {
    const res = await fetch('/api/refresh-data?secret=refresh2026', { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      alert(`✅ Elo sincronizado: ${data.elo_seeded} equipos, ${data.total_predictions} predicciones generadas`);
      loadAdvancedPredictions();
    } else throw new Error(data.error || 'Error');
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
  if (btn) { btn.disabled = false; btn.textContent = '⭐ Sincronizar Elo'; }
}

async function copyShareText(fixtureId) {
  const fixture = fixturesData.find(f => f.fixture.id === fixtureId);
  if (!fixture) return;
  const text = generateShareText(fixture);
  try {
    await navigator.clipboard.writeText(text);
    const btn = $('#modal-copy');
    if (btn) { btn.textContent = '✓ Copiado'; btn.style.borderColor = 'var(--green)'; setTimeout(() => { btn.textContent = 'Copiar texto'; btn.style.borderColor = ''; }, 2000); }
  } catch {
    prompt('Copia este texto:', text);
  }
}

async function enviarSugerencia() {
  const textarea = $('#sugerencia-text');
  const contacto = $('#sugerencia-contacto');
  const status = $('#sugerencia-status');
  const btn = $('#btn-enviar-sugerencia');
  const mensaje = textarea.value.trim();
  if (mensaje.length < 3) {
    status.textContent = '❌ Escribí al menos 3 caracteres';
    status.style.color = 'var(--red)';
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  status.textContent = '';
  try {
    const res = await fetch('/api/sugerencia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, contacto: contacto.value.trim() || undefined })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    status.textContent = '✅ ¡Gracias! Sugerencia enviada';
    status.style.color = 'var(--green)';
    textarea.value = '';
    contacto.value = '';
    setTimeout(() => {
      $('#sugerencia-modal').classList.add('hidden');
      status.textContent = '';
      btn.disabled = false;
      btn.textContent = 'Enviar';
    }, 2000);
  } catch (err) {
    status.textContent = `❌ Error: ${err.message}`;
    status.style.color = 'var(--red)';
    btn.disabled = false;
    btn.textContent = 'Enviar';
  }
}

// Event delegation for dynamic content
document.addEventListener('click', (e) => {
  const sugerenciaFab = e.target.closest('#btn-sugerencia') || e.target.closest('#btn-sugerencia-footer');
  if (sugerenciaFab) {
    $('#sugerencia-modal').classList.remove('hidden');
    $('#sugerencia-text').focus();
    return;
  }

  const sugerenciaSend = e.target.closest('#btn-enviar-sugerencia');
  if (sugerenciaSend) {
    enviarSugerencia();
    return;
  }

  const sugerenciaCancel = e.target.closest('#btn-cancelar-sugerencia');
  if (sugerenciaCancel) {
    $('#sugerencia-modal').classList.add('hidden');
    $('#sugerencia-status').textContent = '';
    return;
  }

  const refreshBtn = e.target.closest('.btn-refresh');
  if (refreshBtn) {
    const tab = refreshBtn.dataset.tab;
    refreshBtn.disabled = true;
    refreshBtn.textContent = '🔄 Actualizando...';
    const reloadFn = tab === 'predictions' ? loadPredictions(true) : tab === 'advanced' ? loadAdvancedPredictions() : loadOdds(true);
    Promise.resolve(reloadFn).then(() => {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 Actualizar';
    }).catch(() => {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '🔄 Actualizar';
    });
    return;
  }

  const syncBtn = e.target.closest('#btn-sync-elo');
  if (syncBtn) { syncElo(); return; }

  const predictBtn = e.target.closest('#btn-predict-matchup');
  if (predictBtn) {
    const homeId = $('#sel-home-team').value;
    const awayId = $('#sel-away-team').value;
    if (!homeId || !awayId) { alert('Seleccioná ambos equipos'); return; }
    predictMatchup(homeId, awayId);
    return;
  }

  const copyBtn = e.target.closest('#modal-copy');
  if (copyBtn) {
    if (currentFixtureId !== null) copyShareText(currentFixtureId);
    return;
  }

  const filterBtn = e.target.closest('.filter-btn');
  if (filterBtn) {
    $$('.filter-btn').forEach(b => b.classList.remove('active'));
    filterBtn.classList.add('active');
    loadFixtures(filterBtn.dataset.status);
    return;
  }

  const tabBtn = e.target.closest('.tab');
  if (tabBtn) {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(t => t.classList.remove('active'));
    tabBtn.classList.add('active');
    const target = $(`#tab-${tabBtn.dataset.tab}`);
    if (target) target.classList.add('active');
    switch (tabBtn.dataset.tab) {
      case 'fixtures': loadFixtures('all'); break;
      case 'standings': loadStandings(); break;
      case 'predictions': loadPredictions(); break;
      case 'odds': loadOdds(); break;
      case 'advanced': loadAdvancedPredictions(); break;
    }
    return;
  }

  const backdrop = e.target.closest('.modal-backdrop');
  const closeBtn = e.target.closest('.modal-close');
  if (backdrop || closeBtn) {
    const modal = (backdrop || closeBtn).closest('.modal');
    if (modal) {
      modal.classList.add('hidden');
      if (modal.id === 'sugerencia-modal') $('#sugerencia-status').textContent = '';
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $('#match-modal').classList.add('hidden');
    const sg = $('#sugerencia-modal');
    if (!sg.classList.contains('hidden')) {
      sg.classList.add('hidden');
      $('#sugerencia-status').textContent = '';
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadFixtures('all');
});
