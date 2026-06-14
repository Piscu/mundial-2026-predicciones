#!/usr/bin/env python3
"""
Scraper de datos de selecciones desde eloratings.net.
Alimenta data.sqlite usada por el servidor Node.js.
"""
import sqlite3, os, csv, io, logging, sys
from datetime import datetime
from urllib.request import urlopen, Request

logging.basicConfig(level=logging.INFO, format='%(message)s')
log = logging.getLogger(__name__)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.sqlite')

CODE_TO_URL = {
    'MX': 'Mexico', 'ZA': 'South_Africa', 'KR': 'South_Korea',
    'CZ': 'Czech_Republic', 'CA': 'Canada', 'BA': 'Bosnia_and_Herzegovina',
    'IR': 'Iran', 'ES': 'Spain', 'AR': 'Argentina', 'FR': 'France',
    'EN': 'England', 'PT': 'Portugal', 'CO': 'Colombia', 'BR': 'Brazil',
    'NL': 'Netherlands', 'EC': 'Ecuador', 'DE': 'Germany', 'UY': 'Uruguay',
    'IT': 'Italy', 'HR': 'Croatia', 'MA': 'Morocco', 'HU': 'Hungary',
    'DK': 'Denmark', 'JP': 'Japan', 'CH': 'Switzerland', 'UA': 'Ukraine',
    'SE': 'Sweden', 'AT': 'Austria', 'US': 'United_States', 'BE': 'Belgium',
    'NO': 'Norway', 'PL': 'Poland', 'SN': 'Senegal', 'RS': 'Serbia',
    'CM': 'Cameroon', 'RO': 'Romania', 'GR': 'Greece', 'NG': 'Nigeria',
    'SK': 'Slovakia', 'IE': 'Ireland', 'TN': 'Tunisia', 'PE': 'Peru',
    'GH': 'Ghana', 'CI': 'Ivory_Coast', 'CL': 'Chile', 'DZ': 'Algeria',
    'EG': 'Egypt', 'VE': 'Venezuela', 'SI': 'Slovenia', 'AL': 'Albania',
    'ME': 'Montenegro', 'LT': 'Lithuania', 'IS': 'Iceland', 'FI': 'Finland',
    'AU': 'Australia', 'BF': 'Burkina_Faso', 'ML': 'Mali', 'PY': 'Paraguay',
    'BO': 'Bolivia', 'CR': 'Costa_Rica', 'HN': 'Honduras', 'PA': 'Panama',
    'RU': 'Russia', 'CN': 'China', 'SA': 'Saudi_Arabia', 'QA': 'Qatar',
    'AE': 'UAE', 'TN': 'Tunisia', 'MA': 'Morocco',
}

CODE_TO_NAME = {
    'ES': 'Spain', 'AR': 'Argentina', 'FR': 'France', 'EN': 'England',
    'PT': 'Portugal', 'CO': 'Colombia', 'BR': 'Brazil', 'NL': 'Netherlands',
    'EC': 'Ecuador', 'DE': 'Germany', 'UY': 'Uruguay', 'IT': 'Italy',
    'IR': 'Iran', 'HR': 'Croatia', 'MA': 'Morocco', 'HU': 'Hungary',
    'DK': 'Denmark', 'JP': 'Japan', 'CH': 'Switzerland', 'UA': 'Ukraine',
    'SE': 'Sweden', 'AT': 'Austria', 'KR': 'South Korea', 'US': 'USA',
    'BE': 'Belgium', 'MX': 'Mexico', 'NO': 'Norway',
    'PL': 'Poland', 'SN': 'Senegal', 'RS': 'Serbia', 'CM': 'Cameroon',
    'CZ': 'Czech Republic', 'RO': 'Romania', 'GR': 'Greece', 'NG': 'Nigeria',
    'SK': 'Slovakia', 'IE': 'Republic of Ireland', 'TN': 'Tunisia',
    'PE': 'Peru', 'GH': 'Ghana', 'CI': "Ivory Coast", 'CL': 'Chile',
    'CA': 'Canada', 'BF': 'Burkina Faso', 'AU': 'Australia', 'ZA': 'South Africa',
    'DZ': 'Algeria', 'EG': 'Egypt', 'VE': 'Venezuela', 'BA': 'Bosnia and Herzegovina',
    'SI': 'Slovenia', 'AL': 'Albania', 'IS': 'Iceland', 'FI': 'Finland',
    'RU': 'Russia', 'CN': 'China',
}

CODE_TO_API_ID = {
    'MX': 30, 'ZA': 3948, 'KR': 15, 'CZ': 56, 'CA': 44, 'BA': 82,
    'ES': 9, 'AR': 26, 'FR': 16, 'EN': 10, 'PT': 27, 'CO': 31,
    'BR': 13, 'NL': 15, 'EC': 38, 'DE': 7, 'UY': 21, 'IT': 6,
    'IR': 24, 'HR': 20, 'MA': 23, 'HU': 19, 'DK': 18, 'JP': 28,
    'CH': 12, 'UA': 34, 'SE': 14, 'AT': 8, 'US': 35, 'BE': 11,
    'NO': 40, 'PL': 25, 'SN': 33, 'RS': 32, 'CM': 4,
    'RO': 29, 'GR': 17, 'NG': 39, 'SK': 36, 'IE': 22, 'TN': 37,
    'PE': 41, 'GH': 16, 'CI': 30, 'CL': 42, 'DZ': 43, 'EG': 44,
    'VE': 45, 'SI': 46, 'AL': 47, 'IS': 48, 'FI': 49,
    'AU': 50, 'BF': 51, 'ML': 52, 'RU': 53, 'CN': 54,
    'PY': 55, 'BO': 56, 'CR': 57, 'HN': 58, 'PA': 59,
}

TARGET_CODES = list(CODE_TO_API_ID.keys())


def db_init():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS teams (api_id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT, flag TEXT, elo_rating REAL DEFAULT 1500, fifa_ranking INTEGER, last_updated TEXT);
        CREATE TABLE IF NOT EXISTS matches (fixture_id INTEGER PRIMARY KEY, date TEXT NOT NULL, home_id INTEGER NOT NULL, away_id INTEGER NOT NULL, home_goals INTEGER, away_goals INTEGER, status TEXT, league_id INTEGER, season INTEGER);
        CREATE TABLE IF NOT EXISTS predictions (fixture_id INTEGER PRIMARY KEY, home_pct REAL, draw_pct REAL, away_pct REAL, elo_home REAL, elo_away REAL, fifa_home INTEGER, fifa_away INTEGER, home_form TEXT, away_form TEXT, predicted_score TEXT, confidence REAL, updated_at TEXT);
    ''')
    conn.commit()
    return conn


def fetch_tsv(url):
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    resp = urlopen(req, timeout=30)
    text = resp.read().decode('utf-8')
    return [r for r in csv.reader(io.StringIO(text), delimiter='\t') if r]


def step1_elo(conn):
    """Scrape World.tsv and store Elo ratings."""
    log.info("FASE 1: Elo ratings...")
    rows = fetch_tsv('https://www.eloratings.net/World.tsv')
    count = 0
    for parts in rows:
        if len(parts) < 4: continue
        code = parts[2].strip()
        if code not in TARGET_CODES: continue
        try:
            elo = float(parts[3])
        except: elo = 1500
        api_id = CODE_TO_API_ID[code]
        name = CODE_TO_NAME.get(code, code)
        conn.execute("INSERT OR REPLACE INTO teams (api_id, name, code, flag, elo_rating, fifa_ranking, last_updated) VALUES (?,?,?,?,?,?,?)",
                     (api_id, name, code, '', elo, None, datetime.utcnow().isoformat()))
        conn.commit()
        count += 1
    log.info(f"  -> {count} equipos actualizados")
    return count


def step2_matches(conn):
    """Scrape per-team TSV for match history."""
    teams = conn.execute("SELECT code, name FROM teams WHERE code != ''").fetchall()
    log.info(f"FASE 2: Historial de partidos ({len(teams)} equipos)...")
    total = 0
    for code, name in teams:
        url_name = CODE_TO_URL.get(code)
        if not url_name: continue
        url = f'https://www.eloratings.net/{url_name}.tsv'
        try:
            rows = fetch_tsv(url)
        except Exception as e:
            log.warning(f"  X {code}: {e}")
            continue
        mcount = 0
        for parts in rows:
            if len(parts) < 8: continue
            try:
                y, mo, d = int(parts[0]), int(parts[1]), int(parts[2])
                hc, ac = parts[3].strip(), parts[4].strip()
                hg, ag = int(parts[5]), int(parts[6])
            except: continue
            hapi = CODE_TO_API_ID.get(hc)
            aapi = CODE_TO_API_ID.get(ac)
            if not hapi or not aapi: continue
            fid = abs(hash(f"{y}{mo}{d}{hc}{ac}{hg}{ag}")) % (2**31)
            ds = f"{y:04d}-{mo:02d}-{d:02d}"
            try:
                conn.execute("INSERT OR REPLACE INTO matches (fixture_id, date, home_id, away_id, home_goals, away_goals, status) VALUES (?,?,?,?,?,?,?)",
                           (fid, ds, hapi, aapi, hg, ag, 'FT'))
                conn.commit()
                mcount += 1
            except: pass
        total += mcount
    log.info(f"  -> {total} partidos insertados")
    return total


def main():
    conn = db_init()
    c1 = step1_elo(conn)
    c2 = step2_matches(conn)
    tc = conn.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
    mc = conn.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
    log.info(f"\nRESUMEN: {tc} equipos, {mc} partidos, DB: {DB_PATH}")
    conn.close()

if __name__ == '__main__':
    main()
